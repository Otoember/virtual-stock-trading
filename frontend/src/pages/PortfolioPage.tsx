import { useQuery } from '@tanstack/react-query'
import { getPortfolio } from '../api'

export default function PortfolioPage() {
  const data = useQuery({ queryKey: ['portfolio'], queryFn: getPortfolio })
  if (data.isLoading) return <div>Loading...</div>
  if (data.error) return <div className="error">持仓加载失败</div>
  if (!data.data) return <div className="error">暂无持仓</div>

  return (
    <div className="card">
      <h2>持仓</h2>
      <table className="table">
        <thead><tr><th>股票</th><th>数量</th><th>可卖</th><th>均价</th><th>现价</th><th>市值</th><th>浮盈</th></tr></thead>
        <tbody>
          {data.data.map((p) => <tr key={p.symbol}><td>{p.stock_name}({p.symbol})</td><td>{p.total_quantity}</td><td>{p.available_quantity}</td><td>{p.avg_cost}</td><td>{p.current_price}</td><td>{p.market_value}</td><td>{p.unrealized_profit}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
