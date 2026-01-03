// HDHub4u 2.0 Stream Module - Direct HTTP Extraction
// Simplified for Rhino JS compatibility

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
};

function getStreams(link, type) {
    console.log("HDHub4u 2.0 getStreams:", link);

    try {
        if (link.indexOf("pixeldrain") !== -1) {
            return extractFromPixeldrain(link);
        }
        else if (link.indexOf("hubstream") !== -1) {
            return extractFromHubstream(link);
        }
        else if (link.indexOf("hubdrive") !== -1) {
            return extractFromHubdrive(link);
        }
        else if (link.indexOf("hubcloud") !== -1) {
            return extractFromHubcloud(link);
        }
        else if (link.indexOf("gadgetsweb") !== -1) {
            return extractFromGadgetsweb(link);
        }
        else {
            return extractFromGadgetsweb(link);
        }
    } catch (err) {
        console.error("getStreams error:", err);
        return [];
    }
}

/**
 * Extract direct download link from Pixeldrain
 * Converts: pixeldrain.com/u/FILE_ID -> pixeldrain.com/api/file/FILE_ID
 * Also handles: pixeldrain.dev, pixeldra.in, etc.
 */
function extractFromPixeldrain(link) {
    console.log("Extracting from Pixeldrain:", link);

    try {
        // Extract file ID from URL like /u/kKYvQriu
        var fileId = "";
        var uIdx = link.indexOf("/u/");
        if (uIdx !== -1) {
            fileId = link.substring(uIdx + 3);
            // Remove any trailing slashes or query params
            var slashIdx = fileId.indexOf("/");
            if (slashIdx !== -1) fileId = fileId.substring(0, slashIdx);
            var queryIdx = fileId.indexOf("?");
            if (queryIdx !== -1) fileId = fileId.substring(0, queryIdx);
        }

        if (!fileId) {
            console.error("Could not extract file ID from:", link);
            return [{
                server: "Pixeldrain",
                link: link,
                type: "direct",
                headers: headers
            }];
        }

        // Get base domain (pixeldrain.com, pixeldrain.dev, etc.)
        var domain = "";
        var protoIdx = link.indexOf("://");
        if (protoIdx !== -1) {
            var pathIdx = link.indexOf("/", protoIdx + 3);
            domain = link.substring(0, pathIdx);
        }

        // Convert to direct API download URL
        var directUrl = domain + "/api/file/" + fileId + "?download";
        console.log("Pixeldrain direct URL:", directUrl);

        return [{
            server: "Pixeldrain",
            link: directUrl,
            type: "direct",
            quality: "HD",
            headers: {
                "Referer": link,
                "User-Agent": headers["User-Agent"]
            }
        }];

    } catch (err) {
        console.error("extractFromPixeldrain error:", err);
        return [{
            server: "Pixeldrain",
            link: link,
            type: "direct",
            headers: headers
        }];
    }
}

function extractFromGadgetsweb(link) {
    console.log("Extracting from gadgetsweb:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Find s('o','BASE64STRING', using simple string search
        var sIdx = html.indexOf("s('o','");
        if (sIdx === -1) {
            sIdx = html.indexOf('s("o","');
        }

        if (sIdx !== -1) {
            var startIdx = sIdx + 7; // length of "s('o','"
            var endIdx = html.indexOf("'", startIdx);
            if (endIdx === -1) {
                endIdx = html.indexOf('"', startIdx);
            }

            if (endIdx !== -1 && endIdx > startIdx) {
                var encoded = html.substring(startIdx, endIdx);
                console.log("Found encoded string, length:", encoded.length);

                if (encoded.length > 50) {
                    var decoded = decodeGadgetsweb(encoded);
                    if (decoded && decoded.o) {
                        var nextUrl = atob(decoded.o);
                        console.log("Next URL:", nextUrl);
                        return followNextUrl(nextUrl);
                    }
                }
            }
        }

        // Fallback: look for hub links directly
        var $ = cheerio.load(html);
        var hubLink = $('a[href*="hubdrive"]').first().attr("href");
        if (!hubLink) {
            hubLink = $('a[href*="hubcloud"]').first().attr("href");
        }
        if (!hubLink) {
            hubLink = $('a[href*="hblinks"]').first().attr("href");
        }

        if (hubLink) {
            console.log("Found hub link:", hubLink);
            return followNextUrl(hubLink);
        }

        return [{
            server: "Link",
            link: link,
            type: "direct",
            headers: headers
        }];

    } catch (err) {
        console.error("extractFromGadgetsweb error:", err);
        return [];
    }
}

function decodeGadgetsweb(encoded) {
    try {
        var step1 = atob(encoded);
        var step2 = atob(step1);
        var step3 = rot13(step2);
        var step4 = atob(step3);
        return JSON.parse(step4);
    } catch (e) {
        console.error("Decode failed:", e);
        return null;
    }
}

/**
 * Extract from HubStream - requires WebView automation
 * HubStream page is JavaScript-rendered, m3u8 not available via HTTP
 * Uses WebView to:
 * 1. Wait for page to load
 * 2. Click play button (required to load m3u8)
 * 3. Extract video source
 */
function extractFromHubstream(link) {
    console.log("HubStream requires WebView automation:", link);

    // Return automation rules for hidden browser
    return [{
        server: "HubStream",
        link: link,
        type: "automate",
        quality: "HD",
        automation: JSON.stringify({
            steps: [
                // Step 1: Wait for video/player element to appear
                {
                    action: "wait",
                    selector: "video, .play-button, .vjs-big-play-button, [class*='play'], button",
                    timeout: 10000
                },
                // Step 2: Click the play button to load the actual video
                {
                    action: "click",
                    selectors: [
                        ".play-button",
                        ".vjs-big-play-button",
                        "[class*='play-btn']",
                        "[class*='play-button']",
                        "button[class*='play']",
                        ".plyr__control--overlaid",
                        "video"
                    ]
                },
                // Step 3: Wait for video source to load after clicking
                {
                    action: "wait",
                    selector: "source[src*='.m3u8'], video[src*='.m3u8']",
                    timeout: 15000
                },
                // Step 4: Extract m3u8 URL from video source
                {
                    action: "extractVideoUrl",
                    selectors: [
                        "source[src*='.m3u8']",
                        "video source",
                        "video[src]",
                        "media-player source"
                    ],
                    patterns: [".m3u8", "master.m3u8"]
                }
            ],
            headers: {
                "Referer": "https://hubstream.art/"
            }
        })
    }];
}

function followNextUrl(url) {
    console.log("Following URL:", url);

    if (url.indexOf("hblinks") !== -1) {
        return extractFromHblinks(url);
    }
    else if (url.indexOf("hubdrive") !== -1) {
        return extractFromHubdrive(url);
    }
    else if (url.indexOf("hubcloud") !== -1) {
        return extractFromHubcloud(url);
    }
    else {
        try {
            var response = axios.get(url, { headers: headers });
            var $ = cheerio.load(response.data);
            var hubLink = $('a[href*="hubdrive"]').first().attr("href");
            if (!hubLink) {
                hubLink = $('a[href*="hubcloud"]').first().attr("href");
            }
            if (hubLink) {
                return followNextUrl(hubLink);
            }
        } catch (e) {
            console.error("followNextUrl error:", e);
        }

        return [{
            server: "Link",
            link: url,
            type: "direct",
            headers: headers
        }];
    }
}

function extractFromHblinks(link) {
    console.log("Extracting from hblinks:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var $ = cheerio.load(response.data);

        // Prioritize HubCloud first (more reliable), then HubDrive as fallback
        var hubLink = $('a[href*="hubcloud"]').first().attr("href");
        if (!hubLink) {
            hubLink = $('a[href*="hubdrive"]').first().attr("href");
        }
        // Also check for direct download buttons
        if (!hubLink) {
            hubLink = $('a.btn-success, a.btn-primary').first().attr("href");
        }

        console.log("Found hub link:", hubLink);

        if (hubLink) {
            return followNextUrl(hubLink);
        }

        return [{
            server: "HBLinks",
            link: link,
            type: "direct",
            headers: headers
        }];

    } catch (err) {
        console.error("extractFromHblinks error:", err);
        return [];
    }
}

function extractFromHubdrive(link) {
    console.log("Extracting from hubdrive:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var $ = cheerio.load(response.data);

        var hubcloudLink = $('a[href*="hubcloud"]').first().attr("href");

        if (hubcloudLink) {
            console.log("Found hubcloud:", hubcloudLink);
            return extractFromHubcloud(hubcloudLink);
        }

        return extractLinksFromPage(response.data);

    } catch (err) {
        console.error("extractFromHubdrive error:", err);
        return [];
    }
}

function extractFromHubcloud(link) {
    console.log("Extracting from hubcloud:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Check for META refresh
        var metaIdx = html.toLowerCase().indexOf('http-equiv="refresh"');
        if (metaIdx !== -1) {
            var urlIdx = html.indexOf("url=", metaIdx);
            if (urlIdx !== -1) {
                var urlStart = urlIdx + 4;
                var urlEnd = html.indexOf('"', urlStart);
                if (urlEnd === -1) urlEnd = html.indexOf("'", urlStart);
                if (urlEnd !== -1) {
                    var redirectUrl = html.substring(urlStart, urlEnd);
                    console.log("Following redirect:", redirectUrl);
                    response = axios.get(redirectUrl, { headers: headers });
                    html = response.data;
                }
            }
        }

        var $ = cheerio.load(html);
        var downloadLink = $("#download").attr("href");

        if (downloadLink) {
            console.log("Found download link:", downloadLink);
            var finalResponse = axios.get(downloadLink, { headers: headers });
            return extractLinksFromPage(finalResponse.data);
        }

        return extractLinksFromPage(html);

    } catch (err) {
        console.error("extractFromHubcloud error:", err);
        return [];
    }
}

function extractLinksFromPage(html) {
    var $ = cheerio.load(html);
    var streams = [];
    var seen = {};

    // Extended server patterns - match partial domains
    var serverPatterns = [
        { pattern: "pixeldrain", name: "Pixeldrain" },
        { pattern: "pixel", name: "Pixeldrain" },
        { pattern: "fsl.", name: "FSL" },
        { pattern: "fastserver", name: "FastServer" },
        { pattern: "hubcdn", name: "HubCDN" },
        { pattern: "gdflix", name: "GDFlix" },
        { pattern: "cloudrip", name: "CloudRip" },
        { pattern: "gofile", name: "GoFile" },
        { pattern: "doodstream", name: "DoodStream" },
        { pattern: "streamtape", name: "StreamTape" },
        { pattern: "filelions", name: "FileLions" },
        { pattern: "streamwish", name: "StreamWish" }
    ];

    var allLinks = $("a");
    console.log("Total links on page:", allLinks.length);

    for (var idx = 0; idx < allLinks.length; idx++) {
        var el = allLinks.eq(idx);
        var href = el.attr("href") || "";
        var text = el.text().trim();

        if (!href || href.indexOf("http") !== 0 || seen[href]) continue;
        if (href.indexOf("t.me") !== -1 || href.indexOf("telegram") !== -1) continue;

        var isValid = false;
        var server = "";
        var hrefLower = href.toLowerCase();

        // Check against server patterns
        for (var i = 0; i < serverPatterns.length; i++) {
            if (hrefLower.indexOf(serverPatterns[i].pattern) !== -1) {
                isValid = true;
                server = serverPatterns[i].name;
                break;
            }
        }

        var classes = el.attr("class") || "";
        // Check for download buttons with various styles
        if (classes.indexOf("btn-success") !== -1 ||
            classes.indexOf("btn-primary") !== -1 ||
            classes.indexOf("btn-danger") !== -1 ||
            classes.indexOf("btn-info") !== -1 ||
            classes.indexOf("download") !== -1) {
            isValid = true;
            if (!server) server = "Download";
        }

        // Check for specific Android/App buttons
        var textLower = text.toLowerCase();
        if (textLower.indexOf("app") !== -1 || el.attr("id") === "android_launch") {
            isValid = true;
            server = "In-App Download";
        }

        // Check for direct download keywords
        if (textLower.indexOf("download") !== -1 || textLower.indexOf("direct") !== -1) {
            isValid = true;
            if (!server) server = "Download";
        }

        // Extract [ServerName] from text like [Pixeldrain]
        var bracketIdx = text.indexOf("[");
        if (bracketIdx !== -1) {
            var endIdx = text.indexOf("]", bracketIdx);
            if (endIdx !== -1) {
                server = text.substring(bracketIdx + 1, endIdx);
                isValid = true;
            }
        }

        if (isValid) {
            seen[href] = true;
            console.log("Found stream:", server, "->", href.substring(0, 60));
            streams.push({
                server: server || "Download",
                link: href,
                type: "direct",
                headers: headers,
                quality: ""
            });
        }
    }

    console.log("Extracted", streams.length, "streams");
    return streams;
}

function rot13(str) {
    var result = "";
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c >= 65 && c <= 90) {
            result += String.fromCharCode(((c - 65 + 13) % 26) + 65);
        } else if (c >= 97 && c <= 122) {
            result += String.fromCharCode(((c - 97 + 13) % 26) + 97);
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}
