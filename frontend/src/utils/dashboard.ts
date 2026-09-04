import type { Account, AssetSnapshot, Position, Trade } from '../types'

export function numeric(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function money(value: unknown, signed = false, digits = 2): string {
  const number = numeric(value)
  if (number === null) return '—'
  const rounded = Number(number.toFixed(digits))
  return `${signed && rounded > 0 ? '+' : ''}${(Object.is(rounded, -0) ? 0 : rounded).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function percent(value: unknown, signed = false): string {
  const number = numeric(value)
  return number === null ? '—' : `${money(number * 100, signed)}%`
}

export function changeClass(value: unknown): string {
  const number = numeric(value)
  return number === null || number === 0
    ? 'neutral'
    : number > 0
      ? 'gain'
      : 'loss'
}

export type HistoryPoint = {
  date: string
  timestamp: number
  total: number
  returnPercent: number
}

export function normalizeHistory(rows: AssetSnapshot[]): HistoryPoint[] {
  const dates = new Map<string, HistoryPoint>()
  for (const row of rows) {
    const timestamp = Date.parse(`${row.date}T00:00:00Z`)
    const total = numeric(row.total_assets)
    const cumulative = numeric(row.cumulative_return)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== row.date ||
      total === null ||
      cumulative === null
    )
      continue
    dates.set(row.date, {
      date: row.date,
      timestamp,
      total,
      returnPercent: cumulative * 100,
    })
  }
  return [...dates.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export function historyWindow(
  points: HistoryPoint[],
  days: number | 'all',
): HistoryPoint[] {
  if (days === 'all' || !points.length) return points
  const start = points[points.length - 1].timestamp - (days - 1) * 86400000
  return points.filter((point) => point.timestamp >= start)
}

export function chartDomain(
  values: number[],
  includeZero = false,
): [number, number] {
  const valid = values.filter(Number.isFinite)
  if (!valid.length) return [0, 1]
  const low = Math.min(...valid, ...(includeZero ? [0] : []))
  const high = Math.max(...valid, ...(includeZero ? [0] : []))
  const padding = Math.max((high - low) * 0.18, Math.abs(high) * 0.0005, 0.02)
  return [low - padding, high + padding]
}

export function axisMoney(value: number): string {
  if (Math.abs(value) >= 100000000) return `${money(value / 100000000)}亿`
  if (Math.abs(value) >= 10000) return `${money(value / 10000)}万`
  return money(value)
}

export function allocation(account: Account) {
  const parts = [
    {
      label: '持仓市值',
      value: numeric(account.market_value),
      className: 'invested',
    },
    { label: '可用现金', value: numeric(account.cash), className: 'available' },
    {
      label: '冻结资金',
      value: numeric(account.frozen_cash),
      className: 'frozen',
    },
  ]
  const total = numeric(account.total_assets)
  if (
    total === null ||
    total <= 0 ||
    parts.some((part) => part.value === null || part.value < 0)
  )
    return null
  const sum = parts.reduce((result, part) => result + part.value!, 0)
  if (Math.abs(sum - total) > 0.015) return null
  return parts.map((part) => ({
    ...part,
    value: part.value!,
    share: part.value! / total,
  }))
}

export function activePositions(
  rows: Position[],
  sort: 'market_value' | 'unrealized_profit',
): Position[] {
  return rows
    .filter((row) => row.total_quantity > 0)
    .sort(
      (a, b) =>
        (numeric(b[sort]) ?? -Infinity) - (numeric(a[sort]) ?? -Infinity),
    )
}

export function latestTrades(rows: Trade[]): Trade[] {
  return [...rows]
    .sort(
      (a, b) =>
        tradeTimestamp(b.executed_at) - tradeTimestamp(a.executed_at) ||
        b.id - a.id,
    )
    .slice(0, 5)
}

function tradeTimestamp(value: string): number {
  // SQLAlchemy's legacy DateTime fields store naive UTC, not browser-local time.
  return Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`)
}

export function tradeTime(value: string): string {
  const date = new Date(tradeTimestamp(value))
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
}
