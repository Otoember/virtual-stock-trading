import { useQuery } from '@tanstack/react-query'
import { getOrders, getTrades } from '../api'

export default function OrdersPage() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: getOrders })
  const trades = useQuery({ queryKey: ['trades'], queryFn: getTrades })

  return (
    <>
      <div className="card">
        <h2>订单历史</h2>
        <pre>{JSON.stringify(orders.data ?? [], null, 2)}</pre>
      </div>
      <div className="card">
        <h2>成交历史</h2>
        <pre>{JSON.stringify(trades.data ?? [], null, 2)}</pre>
      </div>
    </>
  )
}
