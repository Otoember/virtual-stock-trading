import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAccount, getAssetsHistory, getPortfolio, getTrades } from '../api'
import Icon from '../components/Icon'
import {
  activePositions,
  allocation,
  axisMoney,
  changeClass,
  chartDomain,
  historyWindow,
  latestTrades,
  money,
  normalizeHistory,
  percent,
  tradeTime,
} from '../utils/dashboard'
import '../dashboard.css'

function PanelError({ label, retry }: { label: string; retry: () => void }) {
  return (
    <div className="panel-error" role="alert">
      <span>{label}加载失败或请求超时，请稍后重试。</span>
      <button className="text-button" onClick={retry}>
        重新加载
      </button>
    </div>
  )
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="panel-skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const options = { staleTime: 30000, retry: 0 } as const
  const account = useQuery({
    queryKey: ['account'],
    queryFn: getAccount,
    ...options,
  })
  const assets = useQuery({
    queryKey: ['assets'],
    queryFn: getAssetsHistory,
    ...options,
  })
  const portfolio = useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolio,
    ...options,
  })
  const trades = useQuery({
    queryKey: ['trades'],
    queryFn: getTrades,
    ...options,
  })
  const [mode, setMode] = useState<'total' | 'returnPercent'>('total')
  const [period, setPeriod] = useState<number | 'all'>('all')
  const [sort, setSort] = useState<'market_value' | 'unrealized_profit'>(
    'market_value',
  )
  const refreshing =
    account.isFetching ||
    assets.isFetching ||
    portfolio.isFetching ||
    trades.isFetching
  const refresh = () => {
    void Promise.allSettled([
      account.refetch(),
      assets.refetch(),
      portfolio.refetch(),
      trades.refetch(),
    ])
  }
  const allPoints = normalizeHistory(assets.data ?? [])
  const points = historyWindow(allPoints, period)
  const last = points.at(-1)
  const first = points[0]
  const holdings = activePositions(portfolio.data ?? [], sort)
  const recent = latestTrades(trades.data ?? [])
  const data = account.data
  const parts = data ? allocation(data) : null
  const exposure = parts?.find((part) => part.className === 'invested')?.share
  const sync = account.dataUpdatedAt
    ? new Date(account.dataUpdatedAt).toLocaleTimeString('zh-CN', {
        hour12: false,
        timeZone: 'Asia/Shanghai',
      })
    : null

  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <div>
          <div className="eyebrow">
            MY PORTFOLIO <span>/ 交易工作台</span>
          </div>
          <h1>账户总览</h1>
          <p>资产表现、持仓与交易，一目了然。</p>
        </div>
        <div className="heading-actions">
          <span className="sync-label" aria-live="polite">
            {refreshing
              ? '正在同步账户…'
              : sync
                ? `最近同步 ${sync}`
                : '等待账户数据'}
          </span>
          <button
            className="button outline"
            onClick={refresh}
            disabled={refreshing}
          >
            <Icon name="refresh" className={refreshing ? 'spinning' : ''} />
            刷新数据
          </button>
          <Link className="button" to="/market">
            查看行情
            <Icon name="arrow" />
          </Link>
        </div>
      </header>

      {account.isError && (
        <PanelError label="账户" retry={() => void account.refetch()} />
      )}
      {account.isPending ? (
        <div className="metrics-grid">
          {[1, 2, 3, 4].map((key) => (
            <div className="metric-card" key={key}>
              <Skeleton label="正在加载资产" />
            </div>
          ))}
        </div>
      ) : data ? (
        <section className="metrics-grid" aria-label="账户资产摘要">
          <article className="metric-card primary-metric">
            <div className="metric-label">
              总资产 <span>CNY</span>
            </div>
            <div className="metric-number">
              <small>¥</small>
              {money(data.total_assets)}
            </div>
            <div className="metric-foot">
              初始资金 <span>¥ {money(data.initial_cash)}</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              可用现金
              <Icon name="wallet" />
            </div>
            <div className="metric-number">
              <small>¥</small>
              {money(data.cash)}
            </div>
            <div className="metric-foot">
              冻结资金 <span>¥ {money(data.frozen_cash)}</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              持仓市值
              <Icon name="market" />
            </div>
            <div className="metric-number">
              <small>¥</small>
              {money(data.market_value)}
            </div>
            <div className="metric-foot">
              仓位占比 <span>{percent(exposure)}</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-label">
              累计盈亏
              <Icon name="chart" />
            </div>
            <div className={`metric-number ${changeClass(data.total_profit)}`}>
              {money(data.total_profit, true)}
            </div>
            <div className="metric-foot">
              累计收益率{' '}
              <span className={changeClass(data.total_return)}>
                {percent(data.total_return, true)}
              </span>
            </div>
          </article>
        </section>
      ) : null}

      <div className="analytics-grid">
        <section
          className="dashboard-panel history-panel"
          aria-labelledby="history-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="history-title">资产与收益</h2>
              <p>
                {first && last
                  ? `${first.date} — ${last.date} · ${points.length} 个日快照`
                  : '账户历史快照'}{' '}
                · {mode === 'total' ? '单位：元' : '单位：%（累计收益率）'}
              </p>
            </div>
            <div className="segmented" aria-label="历史时间范围">
              {(
                [
                  { value: 30, label: '近30天' },
                  { value: 90, label: '近90天' },
                  { value: 'all', label: '全部' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-toolbar">
            <div className="chart-tabs" aria-label="图表指标">
              <button
                aria-pressed={mode === 'total'}
                onClick={() => setMode('total')}
              >
                总资产
              </button>
              <button
                aria-pressed={mode === 'returnPercent'}
                onClick={() => setMode('returnPercent')}
              >
                累计收益率
              </button>
            </div>
            {last && (
              <span className="chart-latest">
                末次快照{' '}
                <strong>
                  {mode === 'total'
                    ? `¥ ${money(last.total)}`
                    : `${money(last.returnPercent, true)}%`}
                </strong>
              </span>
            )}
          </div>
          {assets.isError && (
            <PanelError label="资产历史" retry={() => void assets.refetch()} />
          )}
          {assets.isPending ? (
            <Skeleton label="正在加载资产历史" />
          ) : !assets.data && assets.isError ? null : points.length === 0 ? (
            <div className="empty-state chart-empty">
              <div className="empty-icon">
                <Icon name="chart" />
              </div>
              <h3>等待第一份资产快照</h3>
              <p>交易产生账户快照后，在这里回顾资产变化。</p>
              <Link className="text-button" to="/market">
                探索 A 股行情 <Icon name="arrow" />
              </Link>
            </div>
          ) : points.length < 8 ? (
            <div className="sparse-history">
              <div className="sparse-summary">
                <div className="empty-icon">
                  <Icon name="chart" />
                </div>
                <div>
                  <h3>
                    {points.length === 1
                      ? '已记录首个资产快照'
                      : `已记录 ${points.length} 个资产快照`}
                  </h3>
                  <p>
                    {points.length === 1
                      ? '暂不足以形成收益趋势，不填充虚构历史。'
                      : '历史点较少，先以快照对比展示；满 8 个日快照后展示趋势。'}
                  </p>
                </div>
              </div>
              {first && last && points.length > 1 && (
                <div className="snapshot-change">
                  <span>所选首末快照变化</span>
                  <strong className={changeClass(last[mode] - first[mode])}>
                    {mode === 'total'
                      ? `¥ ${money(last.total - first.total, true)}`
                      : `${money(last.returnPercent - first.returnPercent, true)} 个百分点`}
                  </strong>
                </div>
              )}
              <div className="snapshot-list">
                {points
                  .slice(-4)
                  .reverse()
                  .map((point) => (
                    <div key={point.date}>
                      <time dateTime={point.date}>{point.date}</time>
                      <strong>
                        {mode === 'total'
                          ? `¥ ${money(point.total)}`
                          : `${money(point.returnPercent, true)}%`}
                      </strong>
                    </div>
                  ))}
              </div>
              {points.length > 4 && <small>展示最近 4 个快照</small>}
            </div>
          ) : (
            <div
              className="chart-body"
              role="img"
              aria-label={`${mode === 'total' ? '总资产' : '累计收益率'}趋势，${first?.date}至${last?.date}，${points.length}个日快照`}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart
                  data={points}
                  margin={{ top: 18, right: 18, bottom: 8, left: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    stroke="#e8edf3"
                    strokeDasharray="3 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value: number) =>
                      new Date(value)
                        .toISOString()
                        .slice(5, 10)
                        .replace('-', '/')
                    }
                    tick={{ fill: '#69778b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={36}
                  />
                  <YAxis
                    domain={chartDomain(
                      points.map((point) => point[mode]),
                      mode === 'returnPercent',
                    )}
                    tickFormatter={(value: number) =>
                      mode === 'total' ? axisMoney(value) : `${money(value)}%`
                    }
                    width={76}
                    tick={{ fill: '#69778b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={5}
                  />
                  <Tooltip
                    labelFormatter={(value) =>
                      new Date(Number(value)).toISOString().slice(0, 10)
                    }
                    formatter={(value) => [
                      mode === 'total'
                        ? `¥ ${money(value)}`
                        : `${money(value, true)}%`,
                      mode === 'total' ? '总资产' : '累计收益率',
                    ]}
                    contentStyle={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  {mode === 'returnPercent' && (
                    <ReferenceLine
                      y={0}
                      stroke="#8c98a8"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Line
                    type="linear"
                    dataKey={mode}
                    stroke="#356ae6"
                    strokeWidth={2.5}
                    dot={
                      points.length <= 31
                        ? { r: 2.5, fill: '#fff', strokeWidth: 1.5 }
                        : false
                    }
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="panel-note">
            账户日快照 · 非实时盯市
            {points.length >= 8 && mode === 'total'
              ? ' · 纵轴局部缩放以展示变化'
              : ''}
            {period !== 'all' && last ? ` · 时间窗口截至 ${last.date}` : ''}
            {allPoints.length < (assets.data?.length ?? 0)
              ? ' · 已排除无效或重复快照'
              : ''}
          </div>
        </section>

        <section
          className="dashboard-panel allocation-panel"
          aria-labelledby="allocation-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="allocation-title">资产分布</h2>
              <p>资金配置与仓位结构</p>
            </div>
            <Icon name="wallet" />
          </div>
          {account.isPending ? (
            <Skeleton label="正在加载资产分布" />
          ) : data ? (
            <>
              <div className="allocation-hero">
                <span>股票仓位</span>
                <strong>{percent(exposure)}</strong>
                <small>持仓市值 / 总资产</small>
              </div>
              {parts ? (
                <>
                  <div
                    className="allocation-bar"
                    role="img"
                    aria-label={parts
                      .map((part) => `${part.label} ${percent(part.share)}`)
                      .join('，')}
                  >
                    {parts.map((part) => (
                      <span
                        key={part.label}
                        className={part.className}
                        style={{ width: `${part.share * 100}%` }}
                      />
                    ))}
                  </div>
                  <dl className="allocation-legend">
                    {parts.map((part) => (
                      <div key={part.label}>
                        <dt>
                          <i className={part.className} />
                          {part.label}
                          <small>{percent(part.share)}</small>
                        </dt>
                        <dd>¥ {money(part.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="panel-note">
                  暂无可展示的资产占比，请核对账户金额。
                </p>
              )}
              <Link className="allocation-link" to="/portfolio">
                查看完整持仓
                <Icon name="arrow" />
              </Link>
            </>
          ) : (
            <p className="panel-note">账户加载成功后显示资金配置。</p>
          )}
        </section>
      </div>

      <section className="dashboard-panel" aria-labelledby="positions-title">
        <div className="panel-heading">
          <div className="title-with-count">
            <h2 id="positions-title">主要持仓</h2>
            {portfolio.data && (
              <span className="count-badge">{holdings.length} 只</span>
            )}
          </div>
          <div className="panel-actions">
            <label className="sort-label">
              排序
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="market_value">持仓市值</option>
                <option value="unrealized_profit">浮动盈亏</option>
              </select>
            </label>
            <Link className="text-button" to="/portfolio">
              全部持仓
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
        {portfolio.isError && (
          <PanelError label="持仓" retry={() => void portfolio.refetch()} />
        )}
        {portfolio.isPending ? (
          <Skeleton label="正在加载持仓" />
        ) : !portfolio.data && portfolio.isError ? null : holdings.length ===
          0 ? (
          <div className="empty-state">
            <Icon name="wallet" />
            <h3>当前没有持仓</h3>
            <p>从关注一只股票开始，建立你的模拟组合。</p>
            <Link className="text-button" to="/market">
              去看行情 <Icon name="arrow" />
            </Link>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="主要持仓表，可横向滚动"
            tabIndex={0}
          >
            <table className="finance-table">
              <thead>
                <tr>
                  <th>股票 / 代码</th>
                  <th className="numeric">现价 / 成本（元）</th>
                  <th className="numeric">持仓 / 可用（股）</th>
                  <th className="numeric">市值（元）</th>
                  <th className="numeric">浮动盈亏 / 收益率</th>
                  <th>
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {holdings.slice(0, 5).map((position) => (
                  <tr key={position.symbol}>
                    <td>
                      <Link
                        className="stock-name"
                        to={`/stock/${position.symbol}`}
                      >
                        {position.stock_name || position.symbol}
                      </Link>
                      <span className="cell-secondary stock-code">
                        {position.symbol}
                      </span>
                    </td>
                    <td className="numeric">
                      {money(position.current_price)}
                      <span className="cell-secondary">
                        {money(position.avg_cost, false, 4)}
                      </span>
                    </td>
                    <td className="numeric">
                      {money(position.total_quantity, false, 0)}
                      <span className="cell-secondary">
                        可用 {money(position.available_quantity, false, 0)}
                      </span>
                    </td>
                    <td className="numeric">{money(position.market_value)}</td>
                    <td
                      className={`numeric ${changeClass(position.unrealized_profit)}`}
                    >
                      {money(position.unrealized_profit, true)}
                      <span
                        className={`cell-secondary ${changeClass(position.unrealized_return)}`}
                      >
                        {percent(position.unrealized_return, true)}
                      </span>
                    </td>
                    <td className="numeric">
                      <Link
                        className="trade-link"
                        to={`/stock/${position.symbol}`}
                        aria-label={`交易 ${position.stock_name || position.symbol}`}
                      >
                        交易
                        <Icon name="arrow" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-note">
          {holdings.length > 5 ? '展示排名前 5 只 · ' : ''}
          价格与盈亏来自账户记录 · 当日买入股票受 T+1 可用数量限制
        </div>
      </section>

      <section className="dashboard-panel" aria-labelledby="trades-title">
        <div className="panel-heading">
          <div>
            <h2 id="trades-title">最近成交</h2>
            <p>最近 5 笔 · 北京时间</p>
          </div>
          <Link className="text-button" to="/orders">
            全部成交
            <Icon name="arrow" />
          </Link>
        </div>
        {trades.isError && (
          <PanelError label="成交记录" retry={() => void trades.refetch()} />
        )}
        {trades.isPending ? (
          <Skeleton label="正在加载成交记录" />
        ) : !trades.data && trades.isError ? null : recent.length === 0 ? (
          <div className="empty-state compact">
            <Icon name="orders" />
            <div>
              <h3>还没有成交记录</h3>
              <p>完成模拟交易后，成交明细将在这里显示。</p>
            </div>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="最近成交表，可横向滚动"
            tabIndex={0}
          >
            <table className="finance-table trades-table">
              <thead>
                <tr>
                  <th>成交时间</th>
                  <th>股票</th>
                  <th>方向</th>
                  <th className="numeric">成交价（元）</th>
                  <th className="numeric">数量（股）</th>
                  <th className="numeric">成交额（元）</th>
                  <th className="numeric">费用（元）</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((trade) => (
                  <tr key={trade.id}>
                    <td className="trade-date">
                      <time dateTime={trade.executed_at}>
                        {tradeTime(trade.executed_at)}
                      </time>
                    </td>
                    <td>
                      <Link
                        className="stock-name"
                        to={`/stock/${trade.symbol}`}
                      >
                        {portfolio.data?.find(
                          (position) => position.symbol === trade.symbol,
                        )?.stock_name || trade.symbol}
                      </Link>
                      <span className="cell-secondary stock-code">
                        {trade.symbol}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`side-badge ${trade.side === 'BUY' ? 'buy' : trade.side === 'SELL' ? 'sell' : ''}`}
                      >
                        {trade.side === 'BUY'
                          ? '买入'
                          : trade.side === 'SELL'
                            ? '卖出'
                            : trade.side}
                      </span>
                    </td>
                    <td className="numeric">{money(trade.price)}</td>
                    <td className="numeric">
                      {money(trade.quantity, false, 0)}
                    </td>
                    <td className="numeric">{money(trade.gross_amount)}</td>
                    <td className="numeric muted">{money(trade.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <footer className="dashboard-footer">
        <span>
          <Icon name="shield" />
          模拟交易，仅用于学习与策略验证
        </span>
        <span>金额单位：人民币 · 盈利红 / 亏损绿</span>
      </footer>
    </div>
  )
}
