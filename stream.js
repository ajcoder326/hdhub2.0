// HDHub4u 2.0 Stream Module - Direct HTTP Extraction (Vega-style)
// NO WebView automation - pure HTTP requests + decoding

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
        // Determine link type and extract accordingly
        if (link.indexOf("hubdrive") !== -1) {
            return extractFromHubdrive(link);
        }
        else if (link.indexOf("hubcloud") !== -1) {
            return extractFromHubcloud(link);
        }
        else if (link.indexOf("gadgetsweb") !== -1 || link.indexOf("gadgets.") !== -1) {
            return extractFromGadgetsweb(link);
        }
        else {
            // Unknown link type - try as gadgetsweb (most common for HDHub4U)
            return extractFromGadgetsweb(link);
        }
    } catch (err) {
        console.error("getStreams error:", err);
        return [];
    }
}

/**
 * Extract from gadgetsweb.xyz shortener (most common for TV series)
 * This decodes the obfuscated redirect URL instead of waiting for timer
 */
function extractFromGadgetsweb(link) {
    console.log("Extracting from gadgetsweb:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Look for the encoded string in the page
        // Format: s('o','BASE64_STRING',180)
        var encodedMatch = html.match(/s\('o','([^']+)',\s*\d+\)/);
        if (encodedMatch && encodedMatch[1]) {
            var decoded = decodeObfuscatedString(encodedMatch[1]);
            if (decoded && decoded.o) {
                var redirectUrl = atob(decoded.o);
                console.log("Decoded redirect URL:", redirectUrl.substring(0, 50));
                return extractFromRedirectPage(redirectUrl);
            }
        }

        // Fallback: Try to find direct hubdrive/hubcloud links
        var $ = cheerio.load(html);
        var hubLink = $('a[href*="hubdrive"]').first().attr("href") ||
            $('a[href*="hubcloud"]').first().attr("href");

        if (hubLink) {
            if (hubLink.indexOf("hubdrive") !== -1) {
                return extractFromHubdrive(hubLink);
            } else {
                return extractFromHubcloud(hubLink);
            }
        }

        console.log("Could not find encoded string or hub links");
        return [];

    } catch (err) {
        console.error("extractFromGadgetsweb error:", err);
        return [];
    }
}

/**
 * Extract from redirect page (after gadgetsweb decoding)
 */
function extractFromRedirectPage(link) {
    console.log("Extracting from redirect page:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var html = response.data;

        // Decode the wp_http tokens
        var tokenData = extractTokenData(html);
        if (!tokenData) {
            console.log("No token data found, trying direct extraction");
            return extractLinksFromPage(html);
        }

        // Build the redirect URL with token
        var token = btoa(tokenData.data);
        var blogLink = tokenData.wp_http1 + "?re=" + token;

        console.log("Waiting for redirect, total_time:", tokenData.total_time);

        // In Direct HTTP, we can't really "wait" in sync JS
        // But we can try the link immediately - sometimes it works
        // If not, we'll return the intermediate link for manual handling

        try {
            var redirectResponse = axios.get(blogLink, { headers: headers });
            var redirectHtml = redirectResponse.data;

            // Check for "Invalid Request" - means timer not elapsed
            if (redirectHtml.indexOf("Invalid Request") !== -1) {
                console.log("Timer not elapsed, returning intermediate link");
                // Return as a manual link the user can open
                return [{
                    server: "Manual (wait " + tokenData.total_time + "s)",
                    link: blogLink,
                    type: "direct",
                    quality: ""
                }];
            }

            // Extract vcloud link
            var vcloudMatch = redirectHtml.match(/var reurl = "([^"]+)"/);
            if (vcloudMatch && vcloudMatch[1]) {
                return extractFromHubcloud(vcloudMatch[1]);
            }

            return extractLinksFromPage(redirectHtml);

        } catch (e) {
            console.log("Redirect request failed, returning blog link");
            return [{
                server: "HubCloud",
                link: blogLink,
                type: "direct"
            }];
        }

    } catch (err) {
        console.error("extractFromRedirectPage error:", err);
        return [];
    }
}

/**
 * Extract token data from redirect page
 */
function extractTokenData(html) {
    try {
        // Look for ck('_wp_http_N','value')
        var regex = /ck\('_wp_http_\d+','([^']+)'/g;
        var combinedString = "";
        var match;

        while ((match = regex.exec(html)) !== null) {
            combinedString += match[1];
        }

        if (!combinedString) {
            return null;
        }

        // Decode: base64 -> base64 -> ROT13 -> base64
        var decoded = atob(atob(rot13(atob(combinedString))));
        return JSON.parse(decoded);

    } catch (e) {
        console.error("extractTokenData error:", e);
        return null;
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
            link;

        console.log("Found hubcloud link:", hubcloudLink.substring(0, 50));
        return extractFromHubcloud(hubcloudLink);

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
        var metaMatch = html.match(/<META HTTP-EQUIV="refresh" content="0; url=([^"]+)"/i);
        if (metaMatch && metaMatch[1]) {
            console.log("Following META redirect");
            var redirectResponse = axios.get(metaMatch[1], { headers: headers });
            html = redirectResponse.data;
        }

        return extractLinksFromPage(html);

    } catch (err) {
        console.error("extractFromHubcloud error:", err);
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

    // Server patterns to look for
    var serverPatterns = ["pixel", "fsl", "hubcdn", "fukggl", "firecdn", "gdflix", "cdn."];
    var excludePatterns = ["t.me", "telegram", "facebook", "twitter", "instagram"];

    // Find all button-style links
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
        "a[href*='gdflix']"
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
            var isValidServer = serverPatterns.length === 0;
            for (var p = 0; p < serverPatterns.length; p++) {
                if (href.toLowerCase().indexOf(serverPatterns[p]) !== -1) {
                    isValidServer = true;
                    if (!server) server = serverPatterns[p].toUpperCase();
                    break;
                }
            }

            // Also accept button-styled links
            if (el.attr("class") && (el.attr("class").indexOf("btn-success") !== -1 ||
                el.attr("class").indexOf("btn-primary") !== -1)) {
                isValidServer = true;
            }

            if (isValidServer || server) {
                seen[href] = true;

                // Determine type from URL
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

// ============ Decoding Functions (from Vega) ============

/**
 * Decode obfuscated string from gadgetsweb
 * Format: base64 -> base64 -> ROT13 -> base64 -> JSON
 */
function decodeObfuscatedString(encoded) {
    try {
        var decoded = atob(encoded);      // First base64
        decoded = atob(decoded);           // Second base64
        decoded = rot13(decoded);          // ROT13
        decoded = atob(decoded);           // Third base64
        return JSON.parse(decoded);        // Parse JSON
    } catch (e) {
        console.error("decodeObfuscatedString error:", e);
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
