import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Run the actual TypeScript implementation on Docker's Node 20 without another test dependency.
const source = readFileSync(
  new URL('../src/utils/dashboard.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
  },
})
const {
  money,
  percent,
  numeric,
  changeClass,
  normalizeHistory,
  historyWindow,
  chartDomain,
  allocation,
  activePositions,
  latestTrades,
  tradeTime,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const snap = (date, total = '1000000', cumulative = '0') => ({
  date,
  total_assets: total,
  cumulative_return: cumulative,
  daily_return: '0',
})

test('money adds grouping, preserves cost precision and uses explicit P&L signs', () => {
  assert.equal(money('1234567.89'), '1,234,567.89')
  assert.equal(money('15.7502', false, 4), '15.7502')
  assert.equal(money(12, true), '+12.00')
  assert.equal(money(-12, true), '-12.00')
  assert.equal(money(-0.0001, true), '0.00')
  assert.equal(money(0.0001, true), '0.00')
})
test('missing and invalid numbers never silently turn into zero', () => {
  for (const input of [
    null,
    undefined,
    '',
    ' ',
    NaN,
    Infinity,
    'abc',
    [],
    true,
  ]) {
    assert.equal(numeric(input), null)
    assert.equal(money(input), '—')
    assert.equal(percent(input), '—')
  }
})
test('returns use ratio-to-percent conversion with signed labels', () => {
  assert.equal(percent('0.012345', true), '+1.23%')
  assert.equal(percent('-0.02', true), '-2.00%')
  assert.equal(changeClass(-1), 'loss')
  assert.equal(changeClass(1), 'gain')
  assert.equal(changeClass(0), 'neutral')
})
test('history is sorted, deduplicated and rejects malformed dates/amounts', () => {
  const data = normalizeHistory([
    snap('2026-09-04'),
    snap('2026-09-02'),
    snap('2026-09-04', '1000200', '0.0002'),
    snap('2026-02-30'),
    snap('wrong'),
    snap('2026-09-03', 'NaN'),
  ])
  assert.deepEqual(
    data.map((row) => row.date),
    ['2026-09-02', '2026-09-04'],
  )
  assert.equal(data[1].total, 1000200)
  assert.equal(data[1].returnPercent, 0.02)
})
test('empty/single history stays empty/single: never fabricated trend points', () => {
  assert.deepEqual(normalizeHistory([]), [])
  const points = normalizeHistory([snap('2026-09-04')])
  assert.equal(historyWindow(points, 30).length, 1)
  assert.equal(historyWindow(points, 'all').length, 1)
})
test('30-day filter is inclusive and anchored to latest observation, not now', () => {
  const points = normalizeHistory([
    snap('2020-07-01'),
    snap('2020-08-05'),
    snap('2020-08-06'),
    snap('2020-09-04'),
  ])
  assert.deepEqual(
    historyWindow(points, 30).map((row) => row.date),
    ['2020-08-06', '2020-09-04'],
  )
  assert.equal(historyWindow(points, 90).length, 4)
  assert.equal(historyWindow(points, 'all').length, 4)
})
test('adequate observations retain exact values and real gaps', () => {
  const points = normalizeHistory(
    Array.from({ length: 14 }, (_, index) =>
      snap(
        `2026-08-${String(index + 1).padStart(2, '0')}`,
        String(1000000 + index * 100),
      ),
    ),
  )
  assert.equal(points.length, 14)
  assert.equal(points[13].total, 1001300)
  assert.equal(points[1].timestamp - points[0].timestamp, 86400000)
})
test('chart axes never collapse with flat or zero data', () => {
  for (const values of [[], [0, 0], [1000000, 1000000], [-10, -10]]) {
    const [low, high] = chartDomain(values)
    assert.ok(Number.isFinite(low) && Number.isFinite(high) && high > low)
    for (const value of values) assert.ok(value > low && value < high)
  }
  const [low, high] = chartDomain([3, 6], true)
  assert.ok(low < 0 && high > 6)
})
test('allocation reconciles cash plus frozen cash plus positions', () => {
  const parts = allocation({
    total_assets: '1000',
    cash: '500',
    market_value: '400',
    frozen_cash: '100',
  })
  assert.equal(parts.length, 3)
  assert.equal(
    parts.reduce((sum, part) => sum + part.share, 0),
    1,
  )
  assert.equal(parts[0].share, 0.4)
})
test('invalid/negative/unreconciled or zero allocation is not plotted', () => {
  for (const account of [
    { total_assets: '0', cash: '0', market_value: '0', frozen_cash: '0' },
    { total_assets: '10', cash: '-1', market_value: '11', frozen_cash: '0' },
    { total_assets: '10', cash: 'NaN', market_value: '10', frozen_cash: '0' },
    { total_assets: '10', cash: '5', market_value: '10', frozen_cash: '0' },
  ])
    assert.equal(allocation(account), null)
})
test('positions exclude closed holdings and sort without mutating query data', () => {
  const rows = [
    {
      symbol: 'a',
      total_quantity: 100,
      market_value: '10',
      unrealized_profit: '3',
    },
    {
      symbol: 'b',
      total_quantity: 100,
      market_value: '20',
      unrealized_profit: '-5',
    },
    {
      symbol: 'c',
      total_quantity: 0,
      market_value: '0',
      unrealized_profit: '10',
    },
  ]
  assert.deepEqual(
    activePositions(rows, 'market_value').map((row) => row.symbol),
    ['b', 'a'],
  )
  assert.deepEqual(
    activePositions(rows, 'unrealized_profit').map((row) => row.symbol),
    ['a', 'b'],
  )
  assert.equal(rows[0].symbol, 'a')
})
test('trades sort newest-first, limit to five and preserve query data', () => {
  const rows = Array.from({ length: 8 }, (_, id) => ({
    id,
    executed_at: `2026-09-0${id + 1}T02:00:00`,
  }))
  assert.deepEqual(
    latestTrades(rows).map((row) => row.id),
    [7, 6, 5, 4, 3],
  )
  assert.equal(rows[0].id, 0)
})
test('naive backend UTC timestamps display in Beijing, including date rollover', () => {
  assert.equal(tradeTime('2026-09-04T02:30:00'), '09/04 10:30')
  assert.equal(tradeTime('2026-09-04T02:30:00Z'), '09/04 10:30')
  assert.equal(tradeTime('2026-09-04T10:30:00+08:00'), '09/04 10:30')
  assert.equal(tradeTime('2026-09-04T23:30:00'), '09/05 07:30')
  assert.equal(tradeTime('invalid'), '—')
})
