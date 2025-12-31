// HDHub4u 2.0 Meta Module - Direct HTTP

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
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
        // Remove leading icon if present
        if (title.length > 0 && title.charCodeAt(0) > 10000) {
            title = title.substring(1).trim();
        }

        // Determine type
        var type = "movie";
        if (title && title.toLowerCase().indexOf("season") !== -1) {
            type = "series";
        }

        // Extract poster
        var image = $("main.page-body img.aligncenter").first().attr("src") ||
            $("img.aligncenter").first().attr("src") || "";

        // Extract synopsis
        var synopsis = "";
        var bodyText = container.text() || "";
        var markers = ["Storyline", "SYNOPSIS", "STORY", "DESCRIPTION", "Plot"];
        for (var m = 0; m < markers.length; m++) {
            var markerIdx = bodyText.indexOf(markers[m]);
            if (markerIdx !== -1) {
                var afterMarker = bodyText.substring(markerIdx);
                var colonIdx = afterMarker.indexOf(":");
                if (colonIdx !== -1 && colonIdx < 30) {
                    synopsis = afterMarker.substring(colonIdx + 1, colonIdx + 500).trim();
                    var cutIdx = synopsis.indexOf("Download");
                    if (cutIdx > 30) synopsis = synopsis.substring(0, cutIdx).trim();
                    break;
                }
            }
        }
        if (!synopsis || synopsis.length < 20) {
            synopsis = "Watch " + (title || "content") + " in high quality.";
        }

        // Extract IMDB ID
        var imdbId = "";
        var imdbLink = container.find('a[href*="imdb.com/title/tt"]').attr("href");
        if (imdbLink) {
            var imdbParts = imdbLink.split("/");
            for (var i = 0; i < imdbParts.length; i++) {
                if (imdbParts[i].indexOf("tt") === 0) {
                    imdbId = imdbParts[i];
                    break;
                }
            }
        }

        // Extract links (episodes or quality options)
        var linkList = [];
        var directLinks = [];

        // Method 1: Find episode links with "EPiSODE" text
        var episodeStrongs = $('strong:contains("EPiSODE")');
        for (var e = 0; e < episodeStrongs.length && e < 50; e++) {
            var epElement = episodeStrongs.eq(e);
            var epTitle = epElement.parent().parent().text().trim();

            var episodeLink = epElement.parent().parent().parent().next().next().find("a").attr("href") ||
                epElement.parent().parent().parent().next().find("a").attr("href") || "";

            if (episodeLink && episodeLink.indexOf("http") === 0) {
                directLinks.push({
                    title: epTitle || ("Episode " + (e + 1)),
                    link: episodeLink
                });
            }
        }

        // Method 2: Find episode anchor links
        if (directLinks.length === 0) {
            var episodeAnchors = container.find('a:contains("EPiSODE")');
            for (var ea = 0; ea < episodeAnchors.length && ea < 50; ea++) {
                var epAnchor = episodeAnchors.eq(ea);
                var epText = epAnchor.text().trim();
                var epHref = epAnchor.attr("href");
                if (epHref && epHref.indexOf("http") === 0) {
                    directLinks.push({
                        title: epText.toUpperCase(),
                        link: epHref
                    });
                }
            }
        }

        // Add episode links as a group
        if (directLinks.length > 0) {
            linkList.push({
                title: title || "Episodes",
                directLinks: directLinks
            });
        }

        // Method 3: Find quality links (for movies)
        if (directLinks.length === 0) {
            var qualityAnchors = container.find('a:contains("480"), a:contains("720"), a:contains("1080"), a:contains("2160"), a:contains("4K")');
            for (var q = 0; q < qualityAnchors.length && q < 20; q++) {
                var qAnchor = qualityAnchors.eq(q);
                var qText = qAnchor.text().trim();
                var qHref = qAnchor.attr("href");

                var quality = "";
                var qMatch = qText.match(/\b(480p|720p|1080p|2160p|4K)\b/i);
                if (qMatch) quality = qMatch[0];

                if (qHref && qHref.indexOf("http") === 0) {
                    linkList.push({
                        title: qText,
                        quality: quality,
                        directLinks: [{
                            title: "Download",
                            link: qHref
                        }]
                    });
                }
            }
        }

        console.log("Meta extracted - Title:", title.substring(0, 30), "Links:", linkList.length);

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
