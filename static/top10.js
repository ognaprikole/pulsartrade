const TOP10_API = "http://127.0.0.1:8000";

function sparkSvg(values, color) {
    const nums = (values || [])
        .map((item) => (typeof item === "number" ? item : Number(item.value)))
        .filter(Number.isFinite);
    if (nums.length < 2) return "";

    const width = 240;
    const height = 70;
    const pad = 4;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const points = nums.map((value, index) => {
        const x = pad + (index / (nums.length - 1)) * (width - pad * 2);
        const y = pad + (1 - (value - min) / span) * (height - pad * 2);
        return `${x},${y}`;
    }).join(" ");

    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}"></polyline></svg>`;
}

function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function formatSymbol(symbol) {
    return symbol.endsWith("USDT") ? `${symbol.slice(0, -4)}/USDT` : symbol;
}

async function loadTop10() {
    const root = document.getElementById("top10-grid");
    if (!root) return;

    try {
        const response = await fetch(`${TOP10_API}/api/top10`);
        if (!response.ok) {
            root.textContent = "Топ-10 недоступен. Проверь uvicorn и /api/top10";
            return;
        }

        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.length) {
            root.textContent = "Топ-10 пуст";
            return;
        }

        root.innerHTML = "";
        rows.forEach((row, index) => {
            const up = Number(row.change) >= 0;
            const color = up ? "#4A9F7A" : "#B5544A";
            const card = document.createElement("article");
            card.className = "top10-card";
            card.innerHTML = `
                <div class="top10-head">
                    <strong>${index + 1}. ${formatSymbol(row.symbol)}</strong>
                    <span class="${up ? "up" : "down"}">${up ? "+" : ""}${Number(row.change).toFixed(2)}%</span>
                </div>
                <div class="top10-price">${formatPrice(row.price)}</div>
                <div class="top10-chart">${sparkSvg(row.spark, color)}</div>
            `;
            card.addEventListener("click", () => {
                const select = document.getElementById("symbol-select");
                if (!select) return;
                if (![...select.options].some((opt) => opt.value === row.symbol)) {
                    const option = document.createElement("option");
                    option.value = row.symbol;
                    option.textContent = formatSymbol(row.symbol);
                    select.appendChild(option);
                }
                select.value = row.symbol;
                select.dispatchEvent(new Event("change"));
            });
            root.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        root.textContent = "Топ-10: нет связи с сервером (включи uvicorn)";
    }
}

loadTop10();





