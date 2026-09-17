const API = "http://127.0.0.1:8000";

const searchInput = document.getElementById("coin-search");
const fromBtn = document.getElementById("from-btn");
const toBtn = document.getElementById("to-btn");
const fromInput = document.getElementById("from-currency");
const toInput = document.getElementById("to-currency");
const fromMenu = document.getElementById("from-menu");
const toMenu = document.getElementById("to-menu");
const result = document.getElementById("convert-result");

let allCodes = ["BTC", "ETH", "BNB", "SOL", "USDT"];
let activeMenu = null;

function codeFromSymbol(symbol) {
    return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

function filteredCodes() {
    const q = (searchInput.value || "").trim().toUpperCase();
    if (!q) return allCodes.slice(0, 40);
    return allCodes.filter((code) => code.includes(q)).slice(0, 40);
}

function closeMenus() {
    fromMenu.style.display = "none";
    toMenu.style.display = "none";
    activeMenu = null;
}

function renderMenu(menu, target) {
    const codes = filteredCodes();
    menu.innerHTML = "";
    if (!codes.length) {
        menu.innerHTML = "<button type='button' disabled>Ничего не найдено</button>";
    } else {
        codes.forEach((code, index) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = code;
            if (index === 0) btn.classList.add("active");
            btn.addEventListener("click", () => choose(target, code));
            menu.appendChild(btn);
        });
    }
    menu.style.display = "block";
    activeMenu = target;
}

function choose(target, code) {
    if (target === "from") {
        fromInput.value = code;
        fromBtn.textContent = code;
    } else {
        toInput.value = code;
        toBtn.textContent = code;
    }
    closeMenus();
}

function openMenu(target) {
    if (target === "from") {
        toMenu.style.display = "none";
        renderMenu(fromMenu, "from");
    } else {
        fromMenu.style.display = "none";
        renderMenu(toMenu, "to");
    }
}

async function loadCoins() {
    try {
        const response = await fetch(API + "/api/symbols");
        const symbols = await response.json();
        if (Array.isArray(symbols) && symbols.length) {
            allCodes = ["USDT", ...symbols.map(codeFromSymbol)];
            allCodes = [...new Set(allCodes)].sort();
        }
    } catch (error) {
        console.error(error);
    }
}

async function convert() {
    const amount = document.getElementById("amount").value;
    const from = fromInput.value;
    const to = toInput.value;
    result.textContent = "Считаю...";
    try {
        const url = `${API}/api/convert?fromcurrency=${from}&tocurrency=${to}&amount=${amount}`;
        const response = await fetch(url);
        const data = await response.json();
        const value = Number(data.converted_amount ?? data.convertedamount);
        result.textContent = Number.isFinite(value)
            ? `${amount} ${from} = ${value.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${to}`
            : "Ошибка конвертации";
    } catch (error) {
        result.textContent = "Нет связи с сервером.";
    }
}

loadCoins();

fromBtn.addEventListener("click", () => openMenu("from"));
toBtn.addEventListener("click", () => openMenu("to"));
searchInput.addEventListener("input", () => {
    if (activeMenu) openMenu(activeMenu);
    else openMenu("from");
});
searchInput.addEventListener("focus", () => openMenu("from"));
document.addEventListener("click", (event) => {
    if (!event.target.closest(".coin-box") && event.target !== searchInput) {
        closeMenus();
    }
});
document.getElementById("convert-btn").addEventListener("click", convert);
document.getElementById("swap-btn").addEventListener("click", () => {
    const from = fromInput.value;
    const to = toInput.value;
    choose("from", to);
    choose("to", from);
});