// HDHub4u 2.0 Catalog Module

var catalog = [
    { title: "Latest", filter: "" },
    { title: "Web Series", filter: "/category/web-series" },
    { title: "Hollywood", filter: "/category/hollywood-movies" },
    { title: "South Movies", filter: "/category/south-hindi-movies" },
    { title: "Bollywood", filter: "/category/bollywood-movies" },
    { title: "Dual Audio", filter: "/category/dual-audio-movies" }
];

var genres = [
    { title: "Action", filter: "/category/action" },
    { title: "Crime", filter: "/category/crime" },
    { title: "Comedy", filter: "/category/comedy" },
    { title: "Drama", filter: "/category/drama" },
    { title: "Horror", filter: "/category/horror" },
    { title: "Family", filter: "/category/family" },
    { title: "Sci-Fi", filter: "/category/sifi" },
    { title: "Thriller", filter: "/category/thriller" },
    { title: "Romance", filter: "/category/romance" },
    { title: "Mystery", filter: "/category/mystery" },
    { title: "Adventure", filter: "/category/adventure" }
];

function getCatalog() {
    return catalog;
}

function getGenres() {
    return genres;
}
