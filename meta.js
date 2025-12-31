// HDHub4u 2.0 Meta Module - Simplified for Rhino compatibility

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
        console.log("Image:", image ? "found" : "none");

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
        // EXTRACT LINKS (using domain patterns like v1)
        // ============================================
        var linkList = [];

        // Find ALL links to streaming/download providers
        var allLinks = container.find("a");
        var episodeLinks = [];
        var qualityLinks = [];
        var otherLinks = [];
        var seenUrls = {};

        for (var i = 0; i < allLinks.length; i++) {
            var anchor = allLinks.eq(i);
            var href = anchor.attr("href") || "";
            var text = anchor.text().trim();

            // Skip non-http and duplicates
            if (href.indexOf("http") !== 0 || seenUrls[href]) continue;

            // Only include links to provider domains
            var isProvider = href.indexOf("gadgetsweb") !== -1 ||
                href.indexOf("hubstream") !== -1 ||
                href.indexOf("hubdrive") !== -1 ||
                href.indexOf("hubcloud") !== -1 ||
                href.indexOf("hubcdn") !== -1;

            if (!isProvider) continue;

            seenUrls[href] = true;
            var textUpper = text.toUpperCase();

            // Categorize by text content
            if (textUpper.indexOf("EPISODE") !== -1 || textUpper.indexOf("EPISOD") !== -1) {
                episodeLinks.push({ title: text, link: href });
            }
            else if (text.indexOf("480") !== -1 || text.indexOf("720") !== -1 ||
                text.indexOf("1080") !== -1 || text.indexOf("2160") !== -1 ||
                text.indexOf("4K") !== -1) {
                qualityLinks.push({ title: text, link: href });
            }
            else {
                otherLinks.push({ title: text || "Download", link: href });
            }
        }

        console.log("Links found - Episodes:", episodeLinks.length, "Quality:", qualityLinks.length, "Other:", otherLinks.length);

        // Build linkList structure
        if (episodeLinks.length > 0) {
            linkList.push({
                title: "Episodes",
                directLinks: episodeLinks
            });
        }

        if (qualityLinks.length > 0) {
            linkList.push({
                title: "Quality Options",
                directLinks: qualityLinks
            });
        }

        if (otherLinks.length > 0) {
            linkList.push({
                title: "Download Links",
                directLinks: otherLinks
            });
        }

        console.log("LinkList total:", linkList.length);

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
