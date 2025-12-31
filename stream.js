// HDHub4u 2.0 Stream Module - Direct HTTP Extraction (Updated)
// Handles: gadgetsweb.xyz, hubdrive.space, hubcloud, hubstream.art
//
// NEW DISCOVERY: gadgetsweb now stores encoded data in localStorage
// Decoding: base64 → base64 → ROT13 → base64 → JSON
// Result: {w: waitTime, l: currentUrl, o: base64NextUrl}

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

/**
 * Main entry point - get playable stream URLs
 */
function getStreams(link, type) {
    console.log("HDHub4u 2.0 getStreams:", link);

    try {
        // Determine link type and route to appropriate handler
        if (link.indexOf("hubdrive.space") !== -1 || link.indexOf("hubdrive.") !== -1) {
            return extractFromHubdrive(link);
        }
        else if (link.indexOf("hubcloud") !== -1) {
            return extractFromHubcloud(link);
        }
        else if (link.indexOf("hubstream") !== -1) {
            return extractFromHubstream(link);
        }
        else if (link.indexOf("gadgetsweb") !== -1 || link.indexOf("gadgets.") !== -1) {
            return extractFromGadgetsweb(link);
        }
        else {
            // Unknown - try as gadgetsweb
            console.log("Unknown link type, trying gadgetsweb flow:", link);
            return extractFromGadgetsweb(link);
        }
    } catch (err) {
        console.error("getStreams error:", err);
        return [];
    }
}

/**
 * Extract from gadgetsweb.xyz
 * NEW METHOD: The encoded URL is embedded in page HTML, not in s() function
 */
function extractFromGadgetsweb(link) {
    console.log("Extracting from gadgetsweb:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Method 1: Look for inline encoded data in script
        // Format: var _0x... = atob("BASE64")
        var inlineBase64 = extractInlineEncodedData(html);
        if (inlineBase64) {
            var decoded = tryDecodeGadgetsweb(inlineBase64);
            if (decoded && decoded.o) {
                var nextUrl = atob(decoded.o);
                console.log("Decoded next URL:", nextUrl.substring(0, 50));
                return followNextUrl(nextUrl);
            }
        }

        // Method 2: Look for s('o','...',N) or s('o','...',N*M) pattern
        // The number can be 180 or 180*1000 etc
        var sPatternMatch = html.match(/s\(['"]o['"],\s*['"]([A-Za-z0-9+\/=]+)['"]\s*,/);
        if (sPatternMatch && sPatternMatch[1] && sPatternMatch[1].length > 50) {
            console.log("Found s() pattern, length:", sPatternMatch[1].length);
            var decoded = decodeObfuscatedString(sPatternMatch[1]);
            if (decoded && decoded.o) {
                var nextUrl = atob(decoded.o);
                console.log("Decoded via s() pattern:", nextUrl.substring(0, 50));
                return followNextUrl(nextUrl);
            }
        }

        // Method 3: Look for direct hub links in page (fallback)
        var $ = cheerio.load(html);
        var hubLink = $('a[href*="hubdrive"]').first().attr("href") ||
            $('a[href*="hubcloud"]').first().attr("href") ||
            $('a[href*="hblinks"]').first().attr("href");

        if (hubLink) {
            console.log("Found direct hub link:", hubLink);
            return followNextUrl(hubLink);
        }

        // Method 4: Return the link itself with intermediate flag
        console.log("Could not decode, returning as intermediate link");
        return [{
            server: "Manual Link",
            link: link,
            type: "direct",
            quality: ""
        }];

    } catch (err) {
        console.error("extractFromGadgetsweb error:", err);
        return [];
    }
}

/**
 * Extract inline encoded data from gadgetsweb HTML
 * Looks for patterns like: atob("BASE64STRING")
 */
function extractInlineEncodedData(html) {
    // Look for JSON-like structures with encoded values
    var patterns = [
        /\{"value"\s*:\s*"([A-Za-z0-9+\/=]+)"/,  // localStorage format
        /atob\s*\(\s*["']([A-Za-z0-9+\/=]+)["']\s*\)/,  // atob() calls
        /data\s*=\s*["']([A-Za-z0-9+\/=]{50,})["']/,  // data = "..." assignments
    ];

    for (var i = 0; i < patterns.length; i++) {
        var match = html.match(patterns[i]);
        if (match && match[1] && match[1].length > 50) {
            console.log("Found encoded data with pattern", i);
            return match[1];
        }
    }

    return null;
}

/**
 * Try to decode gadgetsweb encoded string
 * Sequence: base64 → base64 → ROT13 → base64 → JSON
 */
function tryDecodeGadgetsweb(encoded) {
    try {
        var step1 = atob(encoded);      // First base64
        var step2 = atob(step1);        // Second base64
        var step3 = rot13(step2);       // ROT13
        var step4 = atob(step3);        // Third base64
        return JSON.parse(step4);        // Parse JSON
    } catch (e) {
        console.error("tryDecodeGadgetsweb failed:", e);
        // Try alternative: might just be double base64
        try {
            var alt1 = atob(encoded);
            var alt2 = atob(alt1);
            return JSON.parse(alt2);
        } catch (e2) {
            return null;
        }
    }
}

/**
 * Follow the next URL based on domain
 */
function followNextUrl(url) {
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
        // Try as generic - fetch and look for hub links
        try {
            var response = axios.get(url, { headers: headers });
            var $ = cheerio.load(response.data);
            var hubLink = $('a[href*="hubdrive"]').first().attr("href") ||
                $('a[href*="hubcloud"]').first().attr("href");
            if (hubLink) {
                return followNextUrl(hubLink);
            }
        } catch (e) {
            console.error("followNextUrl error:", e);
        }

        return [{
            server: "Link",
            link: url,
            type: "direct"
        }];
    }
}

/**
 * Extract from hblinks.dad
 */
function extractFromHblinks(link) {
    console.log("Extracting from hblinks:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var $ = cheerio.load(response.data);

        var hubLink = $('a[href*="hubdrive"]').first().attr("href") ||
            $('a[href*="hubcloud"]').first().attr("href");

        if (hubLink) {
            if (hubLink.indexOf("hubdrive") !== -1) {
                return extractFromHubdrive(hubLink);
            } else {
                return extractFromHubcloud(hubLink);
            }
        }

        return [{
            server: "HBLinks",
            link: link,
            type: "direct"
        }];

    } catch (err) {
        console.error("extractFromHblinks error:", err);
        return [];
    }
}

/**
 * Extract from HubDrive page
 */
function extractFromHubdrive(link) {
    console.log("Extracting from hubdrive:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var $ = cheerio.load(response.data);

        // Find the HubCloud button
        var hubcloudLink = $(".btn.btn-primary.btn-user.btn-success1.m-1").first().attr("href") ||
            $('a[href*="hubcloud"]').first().attr("href") ||
            $('a.btn-success[href*="cloud"]').first().attr("href");

        if (hubcloudLink) {
            console.log("Found hubcloud link:", hubcloudLink.substring(0, 50));
            return extractFromHubcloud(hubcloudLink);
        }

        // Fallback: extract any download links from this page
        return extractLinksFromPage(response.data);

    } catch (err) {
        console.error("extractFromHubdrive error:", err);
        return [];
    }
}

/**
 * Extract from HubCloud page - get final download links
 */
function extractFromHubcloud(link) {
    console.log("Extracting from hubcloud:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Check for META refresh redirect
        var metaMatch = html.match(/<META HTTP-EQUIV=["']refresh["'][^>]*url=([^"'>]+)/i);
        if (metaMatch && metaMatch[1]) {
            console.log("Following META redirect");
            var redirectResponse = axios.get(metaMatch[1], { headers: headers });
            html = redirectResponse.data;
        }

        // Look for download button
        var $ = cheerio.load(html);
        var downloadLink = $("#download").attr("href") ||
            $('a#download').attr("href") ||
            $('a[href*="gamerxyt"]').first().attr("href");

        if (downloadLink) {
            console.log("Found download link:", downloadLink.substring(0, 50));
            var finalResponse = axios.get(downloadLink, { headers: headers });
            return extractLinksFromPage(finalResponse.data);
        }

        // Fallback: extract from current page
        return extractLinksFromPage(html);

    } catch (err) {
        console.error("extractFromHubcloud error:", err);
        return [];
    }
}

/**
 * Extract from HubStream (streaming)
 */
function extractFromHubstream(link) {
    console.log("Extracting from hubstream:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Look for video source
        var sourceMatch = html.match(/source[^>]*src=["']([^"']+\.m3u8[^"']*)/i) ||
            html.match(/file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)/i);

        if (sourceMatch && sourceMatch[1]) {
            return [{
                server: "HubStream",
                link: sourceMatch[1],
                type: "m3u8",
                quality: ""
            }];
        }

        // Look for iframe
        var $ = cheerio.load(html);
        var iframe = $("iframe").first().attr("src");
        if (iframe) {
            return [{
                server: "HubStream",
                link: iframe,
                type: "iframe",
                quality: ""
            }];
        }

        return [{
            server: "HubStream",
            link: link,
            type: "direct"
        }];

    } catch (err) {
        console.error("extractFromHubstream error:", err);
        return [];
    }
}

/**
 * Extract download links from final page (gamerxyt or similar)
 */
function extractLinksFromPage(html) {
    var $ = cheerio.load(html);
    var streams = [];
    var seen = {};

    var serverPatterns = ["pixel", "fsl", "hubcdn", "fukggl", "firecdn", "gdflix", "cdn.", "cloudrip"];
    var excludePatterns = ["t.me", "telegram", "facebook", "twitter", "instagram", "javascript:"];

    var selectors = [
        "a.btn-success",
        "a.btn-primary",
        "a.btn-danger",
        "a.btn-info",
        "a[href*='.mkv']",
        "a[href*='.mp4']",
        "a[href*='pixel']",
        "a[href*='fsl']",
        "a[href*='hubcdn']",
        "a[href*='gdflix']",
        "a[href*='cloudrip']"
    ];

    for (var s = 0; s < selectors.length; s++) {
        var elements = $(selectors[s]);
        for (var i = 0; i < elements.length; i++) {
            var el = elements.eq(i);
            var href = el.attr("href") || "";
            var text = el.text().trim();

            if (!href || href.indexOf("http") !== 0 || seen[href]) continue;

            // Check excludes
            var excluded = false;
            for (var e = 0; e < excludePatterns.length; e++) {
                if (href.toLowerCase().indexOf(excludePatterns[e]) !== -1) {
                    excluded = true;
                    break;
                }
            }
            if (excluded) continue;

            // Extract server name from [Server Name] format
            var serverMatch = text.match(/\[(.+?)\]/);
            var server = serverMatch ? serverMatch[1] : "";

            // Check if it matches a server pattern
            var isValidServer = false;
            for (var p = 0; p < serverPatterns.length; p++) {
                if (href.toLowerCase().indexOf(serverPatterns[p]) !== -1) {
                    isValidServer = true;
                    if (!server) server = serverPatterns[p].toUpperCase();
                    break;
                }
            }

            // Also accept button-styled links
            var classes = el.attr("class") || "";
            if (classes.indexOf("btn-success") !== -1 || classes.indexOf("btn-primary") !== -1) {
                isValidServer = true;
            }

            if (isValidServer || server) {
                seen[href] = true;

                var streamType = "direct";
                if (href.indexOf(".m3u8") !== -1) streamType = "m3u8";
                else if (href.indexOf(".mp4") !== -1) streamType = "mp4";
                else if (href.indexOf(".mkv") !== -1) streamType = "mkv";

                streams.push({
                    server: server || "Download",
                    link: href,
                    type: streamType,
                    quality: extractQuality(text || href)
                });
            }
        }
    }

    console.log("Extracted", streams.length, "streams from page");
    return streams;
}

/**
 * Extract quality from text
 */
function extractQuality(text) {
    var match = text.match(/\b(360p?|480p?|720p?|1080p?|2160p?|4K)\b/i);
    return match ? match[1] : "";
}

// ============ Decoding Functions ============

/**
 * Decode obfuscated string (legacy pattern)
 */
function decodeObfuscatedString(encoded) {
    try {
        var decoded = atob(encoded);
        decoded = atob(decoded);
        decoded = rot13(decoded);
        decoded = atob(decoded);
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

/**
 * ROT13 cipher
 */
function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (char) {
        var charCode = char.charCodeAt(0);
        var isUpperCase = char <= 'Z';
        var baseCharCode = isUpperCase ? 65 : 97;
        return String.fromCharCode(((charCode - baseCharCode + 13) % 26) + baseCharCode);
    });
}
