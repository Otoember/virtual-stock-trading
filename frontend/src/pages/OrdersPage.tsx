import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelOrder, getOrders, getTrades, matchOrders } from '../api'

export default function OrdersPage() {
  const qc = useQueryClient()
  const orders = useQuery({ queryKey: ['orders'], queryFn: getOrders })
  const trades = useQuery({ queryKey: ['trades'], queryFn: getTrades })
  const cancel = useMutation({
    mutationFn: (id: number) => cancelOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['account'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
  const match = useMutation({
    mutationFn: () => matchOrders(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['account'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>订单历史</h2>
          <button className="button" onClick={() => match.mutate()} disabled={match.isPending}>模拟撮合</button>
        </div>
        <table className="table">
          <thead><tr><th>ID</th><th>股票</th><th>方向</th><th>类型</th><th>委托价</th><th>数量</th><th>已成交</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {(orders.data ?? []).map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.stock_name}({o.symbol})</td>
                <td>{o.side}</td>
                <td>{o.order_type}</td>
                <td>{o.order_type === 'LIMIT' ? o.limit_price : o.price}</td>
                <td>{o.quantity}</td>
                <td>{o.filled_quantity}</td>
                <td>{o.status}</td>
                <td>
                  {(o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED') && (
                    <button className="button secondary" onClick={() => cancel.mutate(o.id)} disabled={cancel.isPending}>撤单</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>成交历史</h2>
        <table className="table">
          <thead><tr><th>时间</th><th>股票</th><th>方向</th><th>价格</th><th>数量</th><th>金额</th><th>手续费</th></tr></thead>
          <tbody>
            {(trades.data ?? []).map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.executed_at).toLocaleString()}</td>
                <td>{t.symbol}</td>
                <td>{t.side}</td>
                <td>{t.price}</td>
                <td>{t.quantity}</td>
                <td>{t.gross_amount}</td>
                <td>{t.fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
