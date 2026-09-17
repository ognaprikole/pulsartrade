const API = "http://127.0.0.1:8000";
let currentInterval = "1h";
let currentSymbol = "BTCUSDT";
let allSymbols = [];

const FALLBACK_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
    "ADAUSDT", "TONUSDT", "TRXUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT",
    "LTCUSDT", "BCHUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT",
    "SUIUSDT", "INJUSDT", "PEPEUSDT", "WIFUSDT", "UNIUSDT", "AAVEUSDT",
    "FILUSDT", "ATOMUSDT", "XLMUSDT", "HBARUSDT", "SHIBUSDT", "RENDERUSDT"
];

const INTERVALS = (document.body.dataset.intervals || "1h,4h,1d")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const chart = LightweightCharts.createChart(document.getElementById("chart"), {
    autoSize: true,
    layout: {
        attributionLogo: false,
        background: { color: "#1E2128" },
        textColor: "#8A8D96"
    },
    grid: {
        vertLines: { color: "#2A2E38" },
        horzLines: { color: "#2A2E38" }
    }
});

const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: "#4A9F7A",
    downColor: "#B5544A",
    borderVisible: false,
    wickUpColor: "#4A9F7A",
    wickDownColor: "#B5544A"
});
const ALLOWED_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", {
        maximumFractionDigits: 8,
        minimumFractionDigits: 0
    });
}

function formatSymbolLabel(symbol) {
    if (symbol.endsWith("USDT")) {
        return `${symbol.slice(0, -4)}/USDT`;
    }
    return symbol;
}

function renderSymbolOptions(symbols) {
    const select = document.getElementById("symbol-select");
    const previous = select.value;
    select.innerHTML = "";

    symbols.forEach((symbol) => {
        const option = document.createElement("option");
        option.value = symbol;
        option.textContent = formatSymbolLabel(symbol);
        select.appendChild(option);
    });

    if ([...select.options].some((opt) => opt.value === previous)) {
        select.value = previous;
    }
}

function fillSelect(symbols) {
    allSymbols = symbols.slice();
    renderSymbolOptions(allSymbols);

    if (allSymbols.includes("BTCUSDT")) {
        document.getElementById("symbol-select").value = "BTCUSDT";
        currentSymbol = "BTCUSDT";
    } else if (allSymbols[0]) {
        document.getElementById("symbol-select").value = allSymbols[0];
        currentSymbol = allSymbols[0];
    }
}

async function fillSymbolSelect() {
    let symbols = FALLBACK_SYMBOLS;
    try {
        const response = await fetch(`${API}/api/symbols`);
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
            symbols = data;
        }
    } catch (error) {
        console.error("symbols fallback", error);
    }
    fillSelect(symbols);
}

function chooseSymbol(symbol) {
    const select = document.getElementById("symbol-select");
    const fromCurrency = document.getElementById("from-currency");
    select.value = symbol;
    if (fromCurrency) {
        fromCurrency.value = symbol.replace(/USDT$/, "");
    }
    loadSymbol(symbol);
}

function setupSymbolSearch() {
    const select = document.getElementById("symbol-select");
    if (!select) return;

    let input = document.getElementById("symbol-search");
    if (!input) {
        input = document.createElement("input");
        input.id = "symbol-search";
        input.type = "search";
        input.placeholder = "Поиск монеты: BTC, SOL...";
        input.autocomplete = "off";
        select.parentNode.insertBefore(input, select);
    }

    let results = document.getElementById("symbol-results");
    if (!results) {
        results = document.createElement("div");
        results.id = "symbol-results";
        select.parentNode.insertBefore(results, select);
    }

    function hideResults() {
        results.innerHTML = "";
        results.style.display = "none";
    }

    function showResults(items, query) {
        results.innerHTML = "";
        if (!query) {
            hideResults();
            return;
        }

        results.style.display = "block";
        if (!items.length) {
            results.innerHTML = "<div class='symbol-empty'>Ничего не найдено</div>";
            return;
        }

        items.slice(0, 15).forEach((symbol) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "symbol-result";
            row.textContent = formatSymbolLabel(symbol);
            row.addEventListener("click", () => {
                renderSymbolOptions(allSymbols);
                chooseSymbol(symbol);
                input.value = "";
                hideResults();
            });
            results.appendChild(row);
        });
    }

    input.addEventListener("input", () => {
        const q = input.value.trim().toUpperCase();
        const filtered = q
            ? allSymbols.filter((symbol) => {
                const label = formatSymbolLabel(symbol).toUpperCase();
                return symbol.includes(q) || label.includes(q);
            })
            : allSymbols;
        renderSymbolOptions(filtered);
        showResults(filtered, q);
    });
}

function fillIntervalButtons() {
    let wrap = document.getElementById("interval-buttons");
    const chartEl = document.getElementById("chart");
    if (!wrap) {
        if (!chartEl || !chartEl.parentNode) return;
        wrap = document.createElement("div");
        wrap.id = "interval-buttons";
        chartEl.parentNode.insertBefore(wrap, chartEl);
    }

    wrap.innerHTML = "";
    INTERVALS.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "interval-btn";
        button.dataset.interval = item;
        button.textContent = item.toUpperCase();
        if (item === currentInterval) {
            button.classList.add("active");
        }
        wrap.appendChild(button);
    });

    wrap.querySelectorAll(".interval-btn").forEach((button) => {
        button.addEventListener("click", () => {
            currentInterval = button.dataset.interval;
            wrap.querySelectorAll(".interval-btn").forEach((el) => {
                el.classList.toggle("active", el === button);
            });
            loadChart(currentSymbol, currentInterval);
        });
    });
}
function loadChart(symbol = currentSymbol, interval = currentInterval) {
    if (!ALLOWED_INTERVALS.includes(interval)) {
        interval = "1h";
    }
    currentInterval = interval;

    fetch(`${API}/api/klines/${symbol}?interval=${interval}`)
        .then((response) => response.json())
        .then((data) => {
            if (!Array.isArray(data)) {
                console.error("klines error", data);
                return;
            }
            const formattedData = data.map((candle) => ({
                time: candle.time / 1000,
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close)
            }));
            candleSeries.setData(formattedData);
        });
}

function loadSymbol(symbol) {
    currentSymbol = symbol;

    fetch(`${API}/api/price/${symbol}`)
        .then((response) => response.json())
        .then((data) => {
            const node = document.getElementById("price-display");
            if (node) {
                node.innerText = data.price
                    ? `${formatSymbolLabel(symbol)}: ${formatPrice(data.price)}`
                    : "Нет цены";
            }
        });

    fetch(`${API}/api/signal/${symbol}`)
        .then((response) => response.json())
        .then((data) => {
            const node = document.getElementById("sma-signal");
            if (node) {
                node.innerText = `SMA: ${data.signal || "—"}`;
            }
        });

    fetch(`${API}/api/rsi_signal/${symbol}`)
        .then((response) => response.json())
        .then((data) => {
            const node = document.getElementById("rsi-signal");
            if (node) {
                node.innerText = `RSI: ${data.rsi_signal || "—"}`;
            }
        });

    loadChart(symbol, currentInterval);
}

const convertBtn = document.getElementById("convert-btn");
if (convertBtn) 
    convertBtn.addEventListener("click", async () => {
    const amount = document.getElementById("amount").value;
    const fromCurrency = document.getElementById("from-currency").value;
    const toCurrency = document.getElementById("to-currency").value;

    fetch(
        `${API}/api/convert?from_currency=${fromCurrency}&to_currency=${toCurrency}&amount=${amount}`
    )
        .then((response) => response.json())
        .then((data) => {
            const value = parseFloat(data.converted_amount);
            document.getElementById("convert-result").innerText = Number.isFinite(value)
                ? `Результат: ${formatPrice(value)}`
                : "Ошибка конвертации";
        });
});

document.getElementById("symbol-select").addEventListener("change", () => {
    const selectedSymbol = document.getElementById("symbol-select").value;
    chooseSymbol(selectedSymbol);
});

fillIntervalButtons();
setupSymbolSearch();
fillSymbolSelect().then(() => {
    loadSymbol(currentSymbol);
});
function loadLiveTickers() {
    const root = document.getElementById("live-tickers");
    if (!root) return;

    fetch(`${API}/api/tickers`)
        .then((response) => response.json())
        .then((rows) => {
            if (!Array.isArray(rows)) return;
            root.innerHTML = "";
            rows.forEach((row) => {
                const card = document.createElement("div");
                const up = Number(row.change) >= 0;
                card.className = `ticker-card ${up ? "up" : "down"}`;
                card.innerHTML = `
                    <span>${formatSymbolLabel(row.symbol)}</span>
                    <strong>${formatPrice(row.price)}</strong>
                    <em>${up ? "+" : ""}${Number(row.change).toFixed(2)}%</em>
                `;
                root.appendChild(card);
            });
        });
}

function loadLatestNews() {
    const root = document.getElementById("latest-news");
    if (!root) return;

    fetch(`${API}/api/news/latest`)
        .then((response) => response.json())
        .then((item) => {
            root.innerHTML = `
                <div class="kicker">Новость</div>
                <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                <span>${item.source}</span>
            `;
        });
}

loadLiveTickers();
loadLatestNews();
