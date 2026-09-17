(function () {
    const path = (location.pathname || "/").replace(/\/$/, "").toLowerCase();

    const aliases = {
        home: ["/", "/home", "/home.html", "/index.html"],
        strategies: ["/strategies", "/strategies.html"],
        converter: ["/converter", "/converter.html"],
        news: ["/news", "/news.html"],
        about: ["/aboutcrypto", "/about", "/aboutcrypto.html", "/about.html"]
    };

    function keyOf(href) {
        const clean = href.replace(/\/$/, "").toLowerCase();
        if (aliases.home.includes(clean) || clean.endsWith("index.html")) return "home";
        if (aliases.strategies.some((x) => clean.endsWith(x) || clean === x)) return "strategies";
        if (aliases.converter.some((x) => clean.endsWith(x) || clean === x)) return "converter";
        if (aliases.news.some((x) => clean.endsWith(x) || clean === x)) return "news";
        if (aliases.about.some((x) => clean.endsWith(x) || clean === x)) return "about";
        return clean;
    }

    let current = "home";
    if (aliases.strategies.includes(path) || path.endsWith("strategies.html")) current = "strategies";
    else if (aliases.converter.includes(path) || path.endsWith("converter.html")) current = "converter";
    else if (aliases.news.includes(path) || path.endsWith("news.html")) current = "news";
    else if (aliases.about.includes(path) || path.endsWith("aboutcrypto.html") || path.endsWith("about.html")) current = "about";
    else if (aliases.home.includes(path) || path.endsWith("home.html") || path.endsWith("index.html") || path === "") current = "home";

    document.querySelectorAll("#nav-links a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        link.classList.toggle("active", keyOf(href) === current);
    });
})();