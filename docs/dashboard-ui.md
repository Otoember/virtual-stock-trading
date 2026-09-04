# Dashboard UI contract

The existing React application and Recharts own rendering; no separate dashboard runtime or demo data is introduced.

## Sources and metrics

- `/api/account`: total assets = available cash + frozen cash + position market value. Cumulative profit = assets - initial cash; cumulative return = profit / initial cash. Currency: CNY.
- `/api/assets/history`: observed daily account snapshots, updated by the existing trading workflow, not continuous mark-to-market data. Fetch all available history before filtering. Date windows end at the latest snapshot.
- `/api/portfolio`: positive-quantity positions; quantities in shares; prices and unrealized returns are account-record values, not newly fetched live quotes.
- `/api/trades`: five most recent executions from the API's latest 200. Gross amount excludes the separately displayed fee. Display timestamps in Asia/Shanghai.
- Last synchronized time means successful account retrieval, not market data freshness. Refresh does not reprice the account.

## Pre-implementation chart contract / map

| Section | Question | Native representation / safeguards |
| --- | --- | --- |
| Account summary | What are my assets, available funds, exposure and cumulative P&L? | Four scorecards; exact money and signed returns |
| Assets / return history | How have recorded assets or cumulative returns changed? | Recharts linear line with numeric time axis, at least 8 observed daily points. 30/90/all windows. With 0 points show empty state; 1 point show dated snapshot; 2–7 show discrete snapshot comparison. No invented history. |
| Asset allocation | How are assets divided? | 100% stacked horizontal bar; cash, market value and frozen cash divided by reconciled total. Suppress invalid/negative/unreconciled composition. |
| Positions / executions | Which exact positions and executions need review? | Semantic tables, stock links, position sorting; explicit shares/price/fee labels |

Palette: single blue root (#356ae6) for history, neutral guides, no gradient. Allocation uses blue, teal and gray with adjacent labels, percentages and amounts. Documented A-share domain exception: gains red, losses green, always with signed numeric labels; BUY/SELL also have text labels. Padded non-degenerate value axes; focused asset scale labeled. Return chart includes zero reference. No smoothing implying unobserved movement.

Delivery: existing `/` at localhost:5173. Plot gets a dedicated 280px container separate from controls. QA laptop/mobile, loading, partial failures, retry, empty/single/sparse/sufficient history, date filters, metric switch, sort, navigation and logout cache isolation. Fixtures belong only in tests, never production data paths.

## Verification (2026-09-04)

- `npm test`: 13 helper/data-model tests pass (Node 20 Docker runtime).
- `npm run lint`: 0 warnings / 0 errors; TypeScript and Vite production build pass.
- Backend regression suite: 41 tests pass. Existing dependency/API deprecation warnings remain; no backend business logic changed.
- `docker compose build --no-cache frontend` and `docker compose up -d`: pass. Backend retains `Application startup complete`; no ImportError.
- Live application at port 5173: blank account, navigation to market and back, refresh, logout; no browser warning/error and no raw JSON on Dashboard.
- Disposable, separate SQLite QA container (same production frontend image): 45-point history, 30-day filtering, return/asset switch, position sort, BUY/SELL and Beijing time, single snapshot, four snapshots, partial 503/retry, 12-second simulated response triggering the 10-second request timeout, skeletons and cross-account cache isolation.
- Visual QA at 1440px, 390px and 320px. Final narrow-screen document width equals client width; tables retain independent horizontal scrolling. Very narrow screens use single-column metric cards to preserve complete amounts.
- Asset chart initial single point is not expanded into made-up history. Existing account snapshots are trade-driven; this UI change does not add scheduled mark-to-market valuation.
- Route lazy-loading splits the former approximately 700KB entry bundle into a 324KB entry plus an on-demand 374KB dashboard/chart chunk (uncompressed); this does not claim an equivalent total dashboard download reduction.
