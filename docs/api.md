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

## 股票详情性能与缓存

- 行情路径：AKShare 单股接口（雪球）→ MemoryTTLCache → MarketDataService → API。
- 当雪球需登录或上游不可用时，使用腾讯单股公开报价作为备用，响应 `source=tencent`；正常 AKShare 单股响应为 `source=akshare-xueqiu`。页面明确显示来源，故障时不返回 mock 数据。
- 不再在详情请求中调用 `stock_zh_a_spot_em()` 下载全市场快照。全市场接口即使加缓存，冷启动仍需 5–20 秒，无法解决首次加载问题。
- 报价按 symbol 缓存 60 秒，股票列表复用同一缓存服务、TTL 为一小时。缓存仅限当前进程，不跨 worker/容器共享。
- 相同 key 的并发请求共享一次加载；不同 key 可并行。缓存上限 6000 项、加载线程 4 个、排队上限 32 项，过期数据不作为新行情返回，异常和空结果不缓存。
- 报价 API 最多等待后台加载 4 秒；超时返回 `504 MARKET_DATA_TIMEOUT`，数据源故障返回 `503 MARKET_DATA_UNAVAILABLE`，队列饱和返回 `503 MARKET_DATA_BUSY`，格式无效/非 A 股代码返回 404。
- 超时不重复创建后台任务，后续请求复用尚在执行的任务。上游完成后可写入缓存；内存缓存不是对上游永久可用或每次冷请求低于 5 秒的保证。
- 前端请求超时为 5 秒，不自动重试；提供加载、超时、失败和手动重试提示。若刷新失败，旧数据明确标注并禁用下单。
- `updated_at` 为数据源报价时间（带时区），成交量沿用“手”；缓存读取不修改时间戳。日志记录每次上游调用的 operation / elapsed_ms 以及 cache hit / miss / coalesced。
- 服务启动仅初始化 AKShare，不预抓股票池或报价，因此可直接测量真正的报价冷缓存。

可复现性能测试（运行前重启后端以清空缓存）：

```bash
docker compose restart backend
# 等待日志出现 Application startup complete
python backend/scripts/benchmark_market.py
```

脚本校验真实数据来源、首次小于 5 秒、第二次小于 1 秒；若上游故障或变慢会明确失败，不把错误页面计为性能通过。

### 2026-09-04 本机 Docker 验收

| 测试 | 冷缓存首次 | 第二次 |
|---|---:|---:|
| /api/market/quote/000001（HTTP 200） | 0.7795 秒 | 0.0033 秒 |
| /stock/000001（导航到真实股票标题出现） | 0.833 秒 | 0.177 秒（整页刷新） |

测速前重启后端，未预热报价。现场雪球接口要求登录，腾讯备用返回平安银行 11.89 元，source=tencent；实际来源在响应和页面可见。此前东财全市场接口耗时 5.689 秒后失败并误返回 404，AKShare 腾讯全市场快照测试耗时 8.442 秒，因此不将这两项与成功单股报价作同源基准倍数比较。

41 项后端测试和 Ruff 检查通过；前端生产构建、lint（0 errors，存量 warning）通过。浏览器实际暂停后端验证：5 秒后显示明确超时信息、保留旧行情但禁用下单，恢复服务后可重试。测试未创建订单或成交。

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
