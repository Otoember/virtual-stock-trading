# DECISIONS

1. Backend 采用 FastAPI + SQLAlchemy 2.x + Pydantic v2，实现清晰分层和类型安全。
2. 数据库同时支持 SQLite（开发/测试）与 PostgreSQL（生产）。
3. 金额统一使用 Decimal + NUMERIC 字段，避免二进制浮点误差。
4. 行情层通过 MarketDataProvider 抽象，当前提供 Mock 与 AKShare 占位实现。
5. T+1 通过持仓字段（available_quantity/today_bought_quantity）+ TradingDayState 持久化保障重启后正确性。
6. 交易幂等通过 user_id + idempotency_key 唯一约束与接口 Header 机制实现。
7. 交易费用由 FeeCalculator 集中处理并可配置化。
8. 交易时段通过 TradingCalendar 抽象，支持开发环境放开交易时段。
9. 前端采用 React + TypeScript + TanStack Query + Axios，优先保证核心链路。
10. 部署采用 Docker Compose 本地一键启动，后续可迁移到 Azure Container Apps + Azure PostgreSQL。
