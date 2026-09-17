# PulsarTrade

Учебный дашборд крипторынка: графики, конвертер, топ монет, новости и словарь терминов.

## Стек
Python, FastAPI, HTML/CSS/JS, Lightweight Charts, Binance API, RSS ForkLog / Cointelegraph

## Возможности
- свечной график и таймфреймы
- поиск монет
- конвертер
- топ-10 по объёму без стейблов
- учебные SMA / RSI
- лента новостей
- словарь криптотерминов

Это не торговые сигналы и не финансовый совет.

## Запуск

Нужен Python 3.11+.

```bash
git clone https://github.com/ognaprikole/pulsartrade.git
cd pulsartrade
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
