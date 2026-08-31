import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { getAccount, getAssetsHistory, getPortfolio, getTrades } from '../api'

export default function DashboardPage() {
  const account = useQuery({ queryKey: ['account'], queryFn: getAccount })
  const assets = useQuery({ queryKey: ['assets'], queryFn: getAssetsHistory })
  const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: getPortfolio })
  const trades = useQuery({ queryKey: ['trades'], queryFn: getTrades })

  if (account.isLoading) return <div>Loading...</div>
  if (account.error) return <div className="error">账户加载失败</div>
  if (!account.data) return <div className="error">账户数据为空</div>

  return (
    <>
      <div className="row">
        <div className="card"><b>总资产</b><div>¥{account.data.total_assets}</div></div>
        <div className="card"><b>可用现金</b><div>¥{account.data.cash}</div></div>
        <div className="card"><b>累计收益率</b><div>{(Number(account.data.total_return) * 100).toFixed(2)}%</div></div>
      </div>
      <div className="card" style={{ height: 260 }}>
        <h3>资产曲线</h3>
        <ResponsiveContainer>
          <AreaChart data={assets.data?.map((x) => ({ date: x.date, total: Number(x.total_assets) })) ?? []}>
            <XAxis dataKey="date" /><YAxis /><Tooltip /><Area dataKey="total" stroke="#2563eb" fill="#93c5fd" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card"><h3>主要持仓</h3><pre>{JSON.stringify(portfolio.data ?? [], null, 2)}</pre></div>
      <div className="card"><h3>最近交易</h3><pre>{JSON.stringify((trades.data ?? []).slice(0, 5), null, 2)}</pre></div>
    </>
  )
}
