# API 概览

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/market/search
- GET /api/market/provider
- GET /api/market/quote/{symbol}
- GET /api/market/history/{symbol}
- GET /api/market/status
- POST /api/orders
- GET /api/orders
- GET /api/trades
- GET /api/portfolio
- GET /api/account
- GET /api/assets/history
- GET /api/leaderboard

## 行情搜索与数据源检测

默认使用 AKShare，`MARKET_PROVIDER=mock` 仅用于显式离线测试。
AKShare 初始化失败时会记录异常并使用备用 mock；请通过检测接口确认实际 provider。

- `GET /api/market/provider`：返回实际 `provider` 与 `available`。AKShare 模式下会实际加载/检查股票池；不代表实时报价、历史行情等上游接口均可用。
- `GET /api/market/search?keyword=宁德`：通过 MarketDataService 调用 `ak.stock_info_a_code_name()`，按代码或名称进行普通文本包含匹配，最多 50 条 `{symbol, name}`。
- 空关键词返回 `[]`，不会加载股票池；前端也不发起空关键词请求。
- 股票池首次查询时加载，并在服务端缓存一小时；无匹配返回 `[]`，上游失败返回 HTTP 503 / `MARKET_DATA_UNAVAILABLE`，完整异常写入后端日志，不用模拟股票冒充真实结果。
- 前端搜索有 300ms 防抖、加载提示、取消过期请求、失败重试按钮。

运行验证：

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose logs backend
curl http://localhost:5173/api/market/provider
curl 'http://localhost:5173/api/market/search?keyword=600'
curl --get --data-urlencode 'keyword=宁德' http://localhost:5173/api/market/search
```
