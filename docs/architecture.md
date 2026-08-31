# 架构说明

- 前端：React + TypeScript + Vite，负责认证、行情浏览、下单、持仓和排行榜。
- 后端：FastAPI 分层（API / services / models / db）。
- 数据层：SQLAlchemy + Alembic，开发 SQLite，生产 PostgreSQL。
- 核心：TradingEngine 管理下单事务，FeeCalculator 管理费率，TradingCalendar 管理交易时段。
- 行情：MarketDataProvider 统一接口，默认 Mock，后续可替换真实源。
