// HDHub4u 2.0 Posts Module - Direct HTTP

var BASE_URL = "https://new1.hdhub4u.fo";

var headers = {
    "Cookie": "xla=s4t",
    "Referer": "https://google.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};

function getPosts(filter, page, providerContext) {
    console.log("HDHub4u 2.0 getPosts - filter:", filter, "page:", page);

    try {
        var url = BASE_URL + filter + "/page/" + page + "/";
        if (filter === "" || filter === "/") {
            url = BASE_URL + "/page/" + page + "/";
        }

        var response = axios.get(url, { headers: headers });
        if (!response || !response.data) {
            console.error("No response data");
            return [];
        }

        var $ = cheerio.load(response.data);
        var posts = [];

        var items = $("ul.recent-movies li.thumb");
        for (var i = 0; i < items.length; i++) {
            try {
                var element = items.eq(i);
                var img = element.find("figure img");
                var link = element.find("a").first();

                var title = img.attr("alt") || "";
                var href = link.attr("href") || "";
                var image = img.attr("src") || "";

                if (title && href && image) {
                    posts.push({
                        title: title.replace("Download", "").trim(),
                        link: href,
                        image: image
                    });
                }
            } catch (e) {
                console.error("Error parsing item:", e);
            }
        }

        console.log("Found", posts.length, "posts");
        return posts;
    } catch (err) {
        console.error("getPosts error:", err);
        return [];
    }
}

function getSearchPosts(query, page, providerContext) {
    console.log("HDHub4u 2.0 getSearchPosts - query:", query);

    try {
        var url = BASE_URL + "/page/" + page + "/?s=" + encodeURIComponent(query);
        var response = axios.get(url, { headers: headers });

        if (!response || !response.data) {
            return [];
        }

        var $ = cheerio.load(response.data);
        var posts = [];

        // Try movie-grid first, then fallback to recent-movies
        var items = $("ul.movie-grid li.movie-card");
        if (items.length === 0) {
            items = $("ul.recent-movies li.thumb");
        }

        for (var i = 0; i < items.length; i++) {
            try {
                var element = items.eq(i);
                var img = element.find("img").first();
                var link = element.find("a").first();
                var titleEl = element.find("h3");

                var title = titleEl.text() || img.attr("alt") || "";
                var href = link.attr("href") || "";
                var image = img.attr("src") || "";

                if (title && href && image) {
                    posts.push({
                        title: title.replace("Download", "").trim(),
                        link: href,
                        image: image
                    });
                }
            } catch (e) {
                console.error("Error parsing search item:", e);
            }
        }

        return posts;
    } catch (err) {
        console.error("getSearchPosts error:", err);
        return [];
    }
}
