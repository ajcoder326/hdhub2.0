// HDHub4u 2.0 Meta Module - Handles Multiple Page Structures

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

function getMetaData(link, providerContext) {
    console.log("HDHub4u 2.0 getMetaData:", link);

    try {
        var response = axios.get(link, { headers: headers });
        if (!response || !response.data) {
            return createEmptyMeta();
        }

        var $ = cheerio.load(response.data);
        var container = $("main.page-body");

        // Extract title
        var title = "";
        var titleSpan = $("h1.page-title span.material-text");
        if (titleSpan.length > 0) {
            title = titleSpan.text();
        }
        if (!title) {
            title = $("h1.page-title").text() || $("h1").first().text() || "";
        }
        title = title.trim();
        if (title.length > 0 && title.charCodeAt(0) > 10000) {
            title = title.substring(1).trim();
        }
        console.log("Title:", title.substring(0, 40));

        // Determine type
        var type = "movie";
        var isSeries = false;
        if (title) {
            var titleLower = title.toLowerCase();
            if (titleLower.indexOf("season") !== -1 ||
                titleLower.indexOf("series") !== -1 ||
                titleLower.indexOf("episode") !== -1) {
                type = "series";
                isSeries = true;
            }
        }
        console.log("Content type:", type);

        // Extract poster
        var image = $("main.page-body img.aligncenter").first().attr("src") ||
            $("img.aligncenter").first().attr("src") || "";

        // Extract synopsis
        var synopsis = "Watch " + (title || "content") + " in high quality.";
        var bodyText = container.text() || "";
        var storyIdx = bodyText.indexOf("Storyline");
        if (storyIdx === -1) storyIdx = bodyText.indexOf("Synopsis");
        if (storyIdx !== -1) {
            var colonIdx = bodyText.indexOf(":", storyIdx);
            if (colonIdx !== -1 && colonIdx < storyIdx + 30) {
                var synopText = bodyText.substring(colonIdx + 1, colonIdx + 400).trim();
                var cutIdx = synopText.indexOf("Download");
                if (cutIdx > 30) synopText = synopText.substring(0, cutIdx).trim();
                if (synopText.length > 20) synopsis = synopText;
            }
        }

        // Extract IMDB ID
        var imdbId = "";
        var imdbLink = container.find('a[href*="imdb.com/title/tt"]').attr("href");
        if (imdbLink) {
            var ttIdx = imdbLink.indexOf("tt");
            if (ttIdx !== -1) {
                imdbId = imdbLink.substring(ttIdx, ttIdx + 9);
            }
        }

        // ============================================
        // EXTRACT LINKS
        // ============================================
        var linkList = [];

        if (isSeries) {
            linkList = extractSeriesLinks($, container);
        } else {
            linkList = extractMovieLinks($, container);
        }

        console.log("LinkList total groups:", linkList.length);

        return {
            title: title || "Unknown Title",
            synopsis: synopsis,
            image: image,
            poster: image,
            type: type,
            imdbId: imdbId,
            linkList: linkList
        };

    } catch (err) {
        console.error("getMetaData error:", err);
        return createEmptyMeta();
    }
}

/**
 * Extract links for MOVIES
 */
function extractMovieLinks($, container) {
    var linkList = [];
    var allLinks = container.find("a");
    var seenUrls = {};
    var qualityLinks = [];

    for (var i = 0; i < allLinks.length; i++) {
        var anchor = allLinks.eq(i);
        var href = anchor.attr("href") || "";
        var text = anchor.text().trim();

        if (href.indexOf("http") !== 0 || seenUrls[href]) continue;

        var isProvider = href.indexOf("gadgetsweb") !== -1 ||
            href.indexOf("hubdrive") !== -1 ||
            href.indexOf("hubcloud") !== -1;
        if (!isProvider) continue;

        seenUrls[href] = true;
        qualityLinks.push({ title: text || "Download", link: href });
    }

    if (qualityLinks.length > 0) {
        linkList.push({
            title: "Download Options",
            directLinks: qualityLinks
        });
    }

    return linkList;
}

/**
 * Extract links for SERIES - handles two patterns:
 * Pattern A: Episode text is a link itself (<a>EPiSODE 1</a> | <a>WATCH</a>)
 * Pattern B: Episode as header, links follow (<h4>EPiSODE 1</h4> then links)
 */
function extractSeriesLinks($, container) {
    var linkList = [];
    var episodeMap = {};

    // Try Pattern A first (episode text as link)
    var patternAResult = extractPatternA($, container);

    // Try Pattern B (episode as header)
    var patternBResult = extractPatternB($, container);

    // Merge results, preferring whichever found more
    if (patternAResult.length >= patternBResult.length) {
        console.log("Using Pattern A (link-based episodes):", patternAResult.length);
        linkList = patternAResult;
    } else {
        console.log("Using Pattern B (header-based episodes):", patternBResult.length);
        linkList = patternBResult;
    }

    return linkList;
}

/**
 * Pattern A: Episode text is inside anchor tag
 * Example: <h3><a>EPiSODE 1</a> | <a>WATCH</a></h3>
 */
function extractPatternA($, container) {
    var linkList = [];
    var episodeMap = {};
    var seenUrls = {};

    // Find all anchor tags with "EPISODE" in text
    var allLinks = container.find("a");

    for (var i = 0; i < allLinks.length; i++) {
        var anchor = allLinks.eq(i);
        var text = anchor.text().trim();
        var textUpper = text.toUpperCase();
        var href = anchor.attr("href") || "";

        if (href.indexOf("http") !== 0) continue;

        // Skip pack links with file sizes
        if (hasFileSize(text)) continue;

        // Check if this is an episode link
        if (textUpper.indexOf("EPISODE") !== -1 || textUpper.indexOf("EPISOD") !== -1) {
            // Extract episode number
            var epNum = extractEpisodeNumber(text);
            if (!epNum) continue;

            var epKey = "Episode " + epNum;
            if (!episodeMap[epKey]) {
                episodeMap[epKey] = [];
            }

            // Check for provider link
            var isProvider = href.indexOf("gadgetsweb") !== -1 ||
                href.indexOf("hubstream") !== -1 ||
                href.indexOf("hubdrive") !== -1 ||
                href.indexOf("hubcloud") !== -1;

            if (isProvider && !seenUrls[href]) {
                seenUrls[href] = true;
                episodeMap[epKey].push({
                    title: "Download",
                    link: href
                });
            }

            // Also look for sibling WATCH link in same container
            var parent = anchor.parent();
            var siblingLinks = parent.find("a");
            for (var s = 0; s < siblingLinks.length; s++) {
                var sibling = siblingLinks.eq(s);
                var sibText = sibling.text().trim().toUpperCase();
                var sibHref = sibling.attr("href") || "";

                if (sibHref.indexOf("http") !== 0 || seenUrls[sibHref]) continue;

                if (sibText === "WATCH" || sibText.indexOf("WATCH") !== -1) {
                    var sibIsProvider = sibHref.indexOf("hubstream") !== -1 ||
                        sibHref.indexOf("gadgetsweb") !== -1 ||
                        sibHref.indexOf("hubdrive") !== -1;
                    if (sibIsProvider) {
                        seenUrls[sibHref] = true;
                        episodeMap[epKey].push({
                            title: "WATCH",
                            link: sibHref
                        });
                    }
                }
            }
        }
    }

    return convertEpisodeMapToList(episodeMap);
}

/**
 * Pattern B: Episode is a header, links follow in subsequent elements
 * Example: <h4>EPiSODE 1</h4> then <h4>720p - <a>Drive</a> | <a>Instant</a></h4>
 */
function extractPatternB($, container) {
    var linkList = [];
    var currentEpisode = "";
    var episodeMap = {};

    var h4Elements = container.find("h4");

    for (var h = 0; h < h4Elements.length; h++) {
        var h4 = h4Elements.eq(h);
        var h4Text = h4.text().trim();
        var h4TextUpper = h4Text.toUpperCase();

        // Check if this is an episode header
        if (h4TextUpper.indexOf("EPISODE") !== -1 || h4TextUpper.indexOf("EPISOD") !== -1) {
            var epNum = extractEpisodeNumber(h4Text);
            if (epNum) {
                currentEpisode = "Episode " + epNum;
                if (!episodeMap[currentEpisode]) {
                    episodeMap[currentEpisode] = [];
                }
            }
        }
        // If we have a current episode, look for links
        else if (currentEpisode) {
            var h4Links = h4.find("a");
            for (var l = 0; l < h4Links.length; l++) {
                var epLink = h4Links.eq(l);
                var epHref = epLink.attr("href") || "";
                var epText = epLink.text().trim();

                if (epHref.indexOf("http") !== 0) continue;
                if (hasFileSize(epText)) continue;

                var isProvider = epHref.indexOf("gadgetsweb") !== -1 ||
                    epHref.indexOf("hubstream") !== -1 ||
                    epHref.indexOf("hubdrive") !== -1 ||
                    epHref.indexOf("hubcloud") !== -1 ||
                    epHref.indexOf("hubcdn") !== -1;

                if (isProvider && epText) {
                    var quality = "";
                    if (h4TextUpper.indexOf("720") !== -1) quality = "720p";
                    else if (h4TextUpper.indexOf("1080") !== -1) quality = "1080p";
                    else if (h4TextUpper.indexOf("480") !== -1) quality = "480p";

                    var linkTitle = epText;
                    if (quality) linkTitle = quality + " - " + epText;

                    episodeMap[currentEpisode].push({
                        title: linkTitle,
                        link: epHref
                    });
                }
            }
        }
    }

    return convertEpisodeMapToList(episodeMap);
}

/**
 * Convert episode map to sorted linkList
 */
function convertEpisodeMapToList(episodeMap) {
    var linkList = [];
    var episodeKeys = [];

    for (var key in episodeMap) {
        if (episodeMap.hasOwnProperty(key)) {
            episodeKeys.push(key);
        }
    }

    episodeKeys.sort(function (a, b) {
        var numA = parseInt(a.replace(/\D/g, "")) || 0;
        var numB = parseInt(b.replace(/\D/g, "")) || 0;
        return numA - numB;
    });

    for (var e = 0; e < episodeKeys.length; e++) {
        var epKey = episodeKeys[e];
        if (episodeMap[epKey].length > 0) {
            linkList.push({
                title: epKey,
                directLinks: episodeMap[epKey]
            });
        }
    }

    return linkList;
}

/**
 * Extract episode number from text
 */
function extractEpisodeNumber(text) {
    var epNum = "";
    var foundEp = false;

    for (var c = 0; c < text.length; c++) {
        var ch = text.charAt(c);
        if (ch >= "0" && ch <= "9") {
            epNum += ch;
            foundEp = true;
        } else if (foundEp && epNum.length > 0) {
            break;
        }
    }

    return epNum || null;
}

/**
 * Check if text contains file size like [2.6GB]
 */
function hasFileSize(text) {
    if (text.indexOf("[") === -1) return false;
    var textUpper = text.toUpperCase();
    return textUpper.indexOf("GB]") !== -1 || textUpper.indexOf("MB]") !== -1;
}

function createEmptyMeta() {
    return {
        title: "",
        synopsis: "",
        image: "",
        poster: "",
        type: "movie",
        imdbId: "",
        linkList: []
    };
}
