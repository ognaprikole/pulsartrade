import json
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, Response

app = FastAPI()
import time
import asyncio

CACHE = {}

def cache_get(key, ttl):
    item = CACHE.get(key)
    if not item:
        return None
    value, ts = item
    if time.time() - ts > ttl:
        return None
    return value

def cache_set(key, value):
    CACHE[key] = (value, time.time())

ROOT = Path(__file__).resolve().parent.parent
STATIC = Path(__file__).resolve().parent / "static"
if not STATIC.exists():
    STATIC = ROOT / "static"

print("STATIC DIR:", STATIC, "exists:", STATIC.exists())

def page(name: str) -> HTMLResponse:
    return HTMLResponse((STATIC / name).read_text(encoding="utf-8"))

def asset(name: str, media: str) -> Response:
    return Response(content=(STATIC / name).read_bytes(), media_type=media)

@app.get("/")
@app.get("/home")
def home_page():
    return page("home.html")

@app.get("/strategies")
def strategies_page():
    return page("strategies.html")

@app.get("/converter")
def converter_page():
    return page("converter.html")

@app.get("/news")
def news_page():
    return page("news.html")

@app.get("/aboutcrypto")
def about_page():
    return page("aboutcrypto.html")

@app.get("/static/style.css")
def css():
    return asset("style.css", "text/css")

@app.get("/static/app.js")
def app_js():
    return asset("app.js", "application/javascript")

@app.get("/static/top10.js")
def top10_js():
    return asset("top10.js", "application/javascript")

@app.get("/static/converter.js")
def converter_js():
    return asset("converter.js", "application/javascript")

@app.get("/static/news.js")
def news_js():
    return asset("news.js", "application/javascript")

@app.get("/ping")
def ping():
	return {"message": "pong"}

@app.get("/static/nav.js")
def nav_js():
    return asset("nav.js", "application/javascript")


@app.get("/api/price/{symbol}")
async def get_price(symbol: str):
	url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol.upper()}"
	async with httpx.AsyncClient() as client:
		response = await client.get(url)
		data = response.json()
		return data


ALLOWED_INTERVALS = {"1m", "5m", "15m", "1h", "4h", "1d", "1w"}

@app.get("/api/klines/{symbol}")
async def get_klines(symbol: str, interval: str = "1h", limit: int = 100):
    if interval not in ALLOWED_INTERVALS:
        raise HTTPException(status_code=400, detail="Unknown interval")

    url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval={interval}&limit={limit}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        raw_data = response.json()

    candles = []
    for item in raw_data:
        candles.append({
            "time": item[0],
            "open": float(item[1]),
            "high": float(item[2]),
            "low": float(item[3]),
            "close": float(item[4]),
            "volume": float(item[5]),
        
        })

    return  candles 
@app.get("/api/convert")
async def convert_currency(from_currency: str, to_currency: str, amount: float):
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={from_currency.upper()}{to_currency.upper()}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        price_from = await fetch_price_usdt(from_currency)
        price_to = await fetch_price_usdt(to_currency)
        converted_amount = amount * price_from / price_to
        return {"from": from_currency, "to": to_currency, "amount": amount, "converted_amount": converted_amount}
async def fetch_price_usdt(symbol: str) -> float:
    if symbol.upper() == "USDT":
        return 1.0
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol.upper()}USDT"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        return float(data["price"])
def calculate_sma(prices: list[float], period: int) -> float:
    if len(prices) < period:
        raise ValueError("Not enough data points to calculate SMA")
    return sum(prices[-period:]) / period


def get_signal(prices: list[float], period: int) -> str:
    short_now = calculate_sma(prices, period)
    long_now = calculate_sma(prices, period * 2)
    short_prev = calculate_sma(prices[:-1], period)
    long_prev = calculate_sma(prices[:-1], period * 2)

    if short_prev <= long_prev and short_now > long_now:
        return "buy"
    elif short_prev >= long_prev and short_now < long_now:
        return "sell"
    else:
        return "hold"
@app.get("/api/signal/{symbol}")
async def get_signal_endpoint(symbol: str, interval: str = "1h", limit: int = 100, period: int = 14):
    candles = await get_klines(symbol, interval, limit)
    prices = [c["close"] for c in candles]
    signal = get_signal(prices, period)
    return {"symbol": symbol, "signal": signal}
def calculate_rsi(prices: list[float], period: int) -> float:
    if len(prices) < period + 1:
        raise ValueError("Not enough data points to calculate RSI")

    gains = []
    losses = []

    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(-change)

    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi
def get_rsi_signal(prices: list[float], period: int) -> str:
    rsi = calculate_rsi(prices, period)
    if rsi < 30:
        return "buy"
    elif rsi > 70:
        return "sell"
    else:
        return "hold"


@app.get("/api/rsi_signal/{symbol}")
async def get_rsi_signal_endpoint(symbol: str, interval: str = "1h", limit: int = 100, period: int = 14):
    candles = await get_klines(symbol, interval, limit)
    prices = [c["close"] for c in candles]
    rsi_signal = get_rsi_signal(prices, period)
    return {"symbol": symbol, "rsi_signal": rsi_signal}
def save_watchlist(watchlist: list[str], filename: str = "watchlist.json"):
    with open(filename, "w") as f:
        json.dump(watchlist, f)
    return {}
def load_watchlist(filename: str = "watchlist.json") -> list[str]:
    try:
        with open(filename, "r") as f:
            watchlist = json.load(f)
        return watchlist
    except FileNotFoundError:
        return []
@app.get("/api/watchlist")
def get_watchlist():
    watchlist = load_watchlist()
    return {"watchlist": watchlist}
@app.post("/api/watchlist/add/{symbol}")
def add_to_watchlist(symbol: str):
    watchlist = load_watchlist()
    if symbol.upper() not in watchlist:
        watchlist.append(symbol.upper())
        save_watchlist(watchlist)
    return {"watchlist": watchlist}
@app.delete("/api/watchlist/remove/{symbol}")
def remove_from_watchlist(symbol: str):
    watchlist = load_watchlist()
    if symbol.upper() in watchlist:
        watchlist.remove(symbol.upper())
        save_watchlist(watchlist)
    return {"watchlist": watchlist}
def backtest_strategy(prices: list[float], period: int) -> dict:
    signals = []
    in_position = False
    entry_price = 0.0
    trades = []

    for i in range(period * 2, len(prices)):
        short_now = calculate_sma(prices[:i + 1], period)
        long_now = calculate_sma(prices[:i + 1], period * 2)
        short_prev = calculate_sma(prices[:i], period)
        long_prev = calculate_sma(prices[:i], period * 2)

        if short_prev <= long_prev and short_now > long_now:
            signals.append("buy")
            if not in_position:
                in_position = True
                entry_price = prices[i]
        elif short_prev >= long_prev and short_now < long_now:
            signals.append("sell")
            if in_position:
                profit_percent = (prices[i] - entry_price) / entry_price * 100
                trades.append(profit_percent)
                in_position = False
        else:
            signals.append("hold")

    return {"signals": signals, "trades": trades}
def analyze_trades(trades: list[float],) -> dict:
    valid_trades = [x for x in trades if x != 0]
    if not valid_trades:
        return {"total_trades": 0, "average_profit": 0.0, "win_rate": 0.0}

    wins = sum(1 for x in valid_trades if x > 0)
    total_trades = len(valid_trades)
    average_profit = sum(valid_trades) / total_trades
    win_rate = wins / total_trades * 100

    return {
        "total_trades": total_trades,
        "average_profit": average_profit,
        "win_rate": win_rate,
    }
@app.get("/api/backtest/{symbol}")
async def backtest_endpoint(symbol: str, interval: str = "1h", limit: int = 500, period: int = 14):
    candles = await get_klines(symbol, interval, limit)
    prices = [c["close"] for c in candles]
    backtest_results = backtest_strategy(prices, period)
    analysis_results = analyze_trades(backtest_results["trades"])
    return {
        "symbol": symbol,
        "backtest_results": backtest_results,
        "analysis_results": analysis_results,
    }
def backtest_rsi_strategy(prices: list[float], period: int) -> dict:
    signals = []
    in_position = False
    entry_price = 0.0
    trades = []
    for i in range(period, len(prices)):
        rsi = calculate_rsi(prices[:i + 1], period)

        if rsi < 30:
            signals.append("buy")
            if not in_position:
                in_position = True
                entry_price = prices[i]
        elif rsi > 70:
            signals.append("sell")
            if in_position:
                profit_percent = (prices[i] - entry_price) / entry_price * 100
                trades.append(profit_percent)
                in_position = False
        else:
            signals.append("hold")

    return {"signals": signals, "trades": trades}
@app.get("/api/backtest_rsi/{symbol}")
async def backtest_rsi_endpoint(symbol: str, interval: str = "1h", limit: int = 500, period: int = 14):
    candles = await get_klines(symbol, interval, limit)
    prices = [c["close"] for c in candles]
    backtest_results = backtest_rsi_strategy(prices, period)
    analysis_results = analyze_trades(backtest_results["trades"])
    return {
        "symbol": symbol,
        "backtest_results": backtest_results,
        "analysis_results": analysis_results,
    }
@app.get("/api/symbols")
async def get_exchange_info():
    url = "https://api.binance.com/api/v3/exchangeInfo"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        symbols = [
            item["symbol"]
            for item in data["symbols"]
            if item["quoteAsset"] == "USDT" and item["status"] == "TRADING"
        ]
    return symbols
NEWS_FEEDS = [
    ("https://forklog.com/feed/", "Forklog"),
    ("https://cointelegraph.com/rss", "Cointelegraph"),
]

def parse_rss_item(xml_text):
    root = ET.fromstring(xml_text)
    item = root.find(".//item")
    if item is None:
        return None
    title = (item.findtext("title") or "").strip()
    link = (item.findtext("link") or "").strip()
    if not title or not link:
        return None
    return {"title": title, "url": link}

@app.get("/api/news/latest")
def get_latest_news():
    headers = {"User-Agent": "PulsarTrade/1.0"}
    for url, source in NEWS_FEEDS:
        try:
            response = httpx.get(
                url,
                headers=headers,
                timeout=10.0,
                follow_redirects=True,
            )
            response.raise_for_status()
            item = parse_rss_item(response.text)
            if item:
                item["source"] = source
                return item
        except Exception:
            continue
    return {
        "title": "Новости временно недоступны",
        "url": "#",
        "source": "fallback",
    }
@app.get("/api/tickers")
def get_tickers():
    rows = []
    for symbol in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
        try:
            response = httpx.get(
                "https://api.binance.com/api/v3/ticker/24hr",
                params={"symbol": symbol},
                timeout=10.0,
            )
            response.raise_for_status()
            item = response.json()
            rows.append({
                "symbol": item["symbol"],
                "price": float(item["lastPrice"]),
                "change": float(item["priceChangePercent"]),
            })
        except Exception:
            rows.append({"symbol": symbol, "price": 0, "change": 0})
    return rows
import asyncio

@app.get("/api/top10")
async def get_top10():
    cached = cache_get("top10", 45)
    if cached is not None:
        return cached
    STABLE = {
        "USDT", "USDC", "USD1", "FDUSD", "TUSD", "BUSD",
        "DAI", "USDE", "USDP", "USDD", "EUR", "AEUR",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.binance.com/api/v3/ticker/24hr")
        tickers = response.json()
        if not isinstance(tickers, list):
            raise HTTPException(status_code=502, detail="Binance tickers error")

        junk = ("UPUSDT", "DOWNUSDT", "BULLUSDT", "BEARUSDT")
        usdt = [
            t for t in tickers
            if str(t.get("symbol", "")).endswith("USDT")
            and not any(str(t["symbol"]).endswith(x) for x in junk)
            and str(t.get("symbol", ""))[:-4] not in STABLE
        ]
        usdt.sort(key=lambda t: float(t.get("quoteVolume") or 0), reverse=True)
        top = usdt[:10]

        async def one(item):
            symbol = item["symbol"]
            klines = await client.get(
                "https://api.binance.com/api/v3/klines",
                params={"symbol": symbol, "interval": "1h", "limit": 24},
            )
            raw = klines.json()
            spark = [float(row[4]) for row in raw] if isinstance(raw, list) else []
            return {
                "symbol": symbol,
                "price": float(item["lastPrice"]),
                "change": float(item["priceChangePercent"]),
                "spark": spark,
            }
        result = await asyncio.gather(*[one(item) for item in top])
        cache_set("top10", result)
        return result
@app.get("/api/news")
@app.get("/api/news")
async def get_news_feed():
    cached = cache_get("news", 120)
    if cached is not None:
        return cached

    headers = {"User-Agent": "PulsarTrade/1.0"}

    async def one_feed(url, source):
        items = []
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
            root = ET.fromstring(response.text)
            for node in root.findall(".//item")[:8]:
                title = (node.findtext("title") or "").strip()
                link = (node.findtext("link") or "").strip()
                if title and link:
                    items.append({"title": title, "url": link, "source": source})
        except Exception:
            pass
        return items

    batches = await asyncio.gather(*[one_feed(url, source) for url, source in NEWS_FEEDS])
    items = [item for batch in batches for item in batch]
    if not items:
        items = [{"title": "Новости временно недоступны", "url": "#", "source": "fallback"}]
    cache_set("news", items)
    return items