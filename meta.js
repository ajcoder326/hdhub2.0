// HDHub4u 2.0 Meta Module - Proper Episode Grouping

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
        if (title && title.toLowerCase().indexOf("season") !== -1) {
            type = "series";
        }

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
        // EXTRACT LINKS WITH PROPER EPISODE GROUPING
        // ============================================
        var linkList = [];

        // Find full pack links first (720p x264, 1080p x264, etc. - non-episode)
        var packLinks = [];
        var allLinks = container.find("a");

        for (var i = 0; i < allLinks.length; i++) {
            var anchor = allLinks.eq(i);
            var href = anchor.attr("href") || "";
            var text = anchor.text().trim();

            if (href.indexOf("http") !== 0) continue;

            // Quality pack links (contain size like [2.6GB])
            if (text.indexOf("[") !== -1 && text.indexOf("GB]") !== -1) {
                var isProvider = href.indexOf("gadgetsweb") !== -1 ||
                    href.indexOf("hubdrive") !== -1 ||
                    href.indexOf("hubcloud") !== -1;
                if (isProvider) {
                    packLinks.push({ title: text, link: href });
                }
            }
        }

        // Add pack links as a group
        if (packLinks.length > 0) {
            linkList.push({
                title: "Full Season Pack",
                directLinks: packLinks
            });
        }

        // Find episode links by scanning h4/strong elements for "EPiSODE X"
        var html = response.data;
        var currentEpisode = "";
        var episodeMap = {}; // { "Episode 1": [{title, link}, ...], ... }

        // Method: Find all h4 elements and track episode context
        var h4Elements = container.find("h4");
        console.log("Found h4 elements:", h4Elements.length);

        for (var h = 0; h < h4Elements.length; h++) {
            var h4 = h4Elements.eq(h);
            var h4Text = h4.text().trim().toUpperCase();

            // Check if this h4 is an episode header
            if (h4Text.indexOf("EPISODE") !== -1 || h4Text.indexOf("EPISOD") !== -1) {
                // Extract episode number
                var epNum = "";
                for (var c = 0; c < h4Text.length; c++) {
                    var ch = h4Text.charAt(c);
                    if (ch >= "0" && ch <= "9") {
                        epNum += ch;
                    } else if (epNum.length > 0) {
                        break; // Stop after getting digits
                    }
                }
                if (epNum) {
                    currentEpisode = "Episode " + epNum;
                    if (!episodeMap[currentEpisode]) {
                        episodeMap[currentEpisode] = [];
                    }
                }
            }
            // If we have a current episode, look for links in this h4
            else if (currentEpisode) {
                var h4Links = h4.find("a");
                for (var l = 0; l < h4Links.length; l++) {
                    var epLink = h4Links.eq(l);
                    var epHref = epLink.attr("href") || "";
                    var epText = epLink.text().trim();

                    if (epHref.indexOf("http") !== 0) continue;

                    var isProvider = epHref.indexOf("gadgetsweb") !== -1 ||
                        epHref.indexOf("hubstream") !== -1 ||
                        epHref.indexOf("hubdrive") !== -1 ||
                        epHref.indexOf("hubcloud") !== -1 ||
                        epHref.indexOf("hubcdn") !== -1;

                    if (isProvider && epText) {
                        // Get quality from h4 text (720p, 1080p)
                        var quality = "";
                        if (h4Text.indexOf("720") !== -1) quality = "720p";
                        else if (h4Text.indexOf("1080") !== -1) quality = "1080p";
                        else if (h4Text.indexOf("480") !== -1) quality = "480p";

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

        // Convert episodeMap to linkList
        var episodeKeys = [];
        for (var key in episodeMap) {
            if (episodeMap.hasOwnProperty(key)) {
                episodeKeys.push(key);
            }
        }

        // Sort episodes numerically
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
