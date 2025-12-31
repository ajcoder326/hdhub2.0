// HDHub4u 2.0 Stream Module - Direct HTTP Extraction
// Simplified for Rhino JS compatibility

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

function getStreams(link, type) {
    console.log("HDHub4u 2.0 getStreams:", link);

    try {
        if (link.indexOf("hubdrive") !== -1) {
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
            type: "direct"
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
            type: "direct"
        }];
    }
}

function extractFromHblinks(link) {
    console.log("Extracting from hblinks:", link);

    try {
        var response = axios.get(link, { headers: headers });
        var $ = cheerio.load(response.data);

        var hubLink = $('a[href*="hubdrive"]').first().attr("href");
        if (!hubLink) {
            hubLink = $('a[href*="hubcloud"]').first().attr("href");
        }

        if (hubLink) {
            return followNextUrl(hubLink);
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

    var serverPatterns = ["pixel", "fsl", "hubcdn", "gdflix", "cloudrip"];

    $("a").each(function () {
        var href = $(this).attr("href") || "";
        var text = $(this).text().trim();

        if (!href || href.indexOf("http") !== 0 || seen[href]) return;
        if (href.indexOf("t.me") !== -1 || href.indexOf("telegram") !== -1) return;

        var isValid = false;
        var server = "";

        for (var i = 0; i < serverPatterns.length; i++) {
            if (href.toLowerCase().indexOf(serverPatterns[i]) !== -1) {
                isValid = true;
                server = serverPatterns[i].toUpperCase();
                break;
            }
        }

        var classes = $(this).attr("class") || "";
        if (classes.indexOf("btn-success") !== -1 || classes.indexOf("btn-primary") !== -1) {
            isValid = true;
        }

        // Extract [ServerName] from text
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
            streams.push({
                server: server || "Download",
                link: href,
                type: "direct",
                quality: ""
            });
        }
    });

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
