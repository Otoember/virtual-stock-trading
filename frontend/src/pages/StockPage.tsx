import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { placeOrder, quote } from '../api'

export default function StockPage() {
  const { symbol = '' } = useParams()
  const q = useQuery({ queryKey: ['quote', symbol], queryFn: () => quote(symbol) })
  const [quantity, setQuantity] = useState(100)
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET')
  const [limitPrice, setLimitPrice] = useState<number | ''>('')
  const [msg, setMsg] = useState('')

  const order = async (side: 'BUY' | 'SELL') => {
    if (!confirm(`确认${side === 'BUY' ? '买入' : '卖出'} ${symbol} ${quantity}股？`)) return
    try {
      await placeOrder(symbol, side, quantity, orderType, orderType === 'LIMIT' ? Number(limitPrice) : undefined)
      setMsg('下单成功')
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? '下单失败')
    }
  }

  if (q.isLoading) return <div>Loading...</div>
  if (q.error) return <div className="error">行情加载失败</div>
  if (!q.data) return <div className="error">暂无行情</div>

  return (
    <div className="card">
      <h2>{q.data.name} ({q.data.symbol})</h2>
      <p>现价: ¥{q.data.price}，涨跌幅: {q.data.change_percent}%</p>
      <p>更新时间: {new Date(q.data.updated_at).toLocaleString()}</p>
      <div className="row">
        <select value={orderType} onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}>
          <option value="MARKET">市价单</option>
          <option value="LIMIT">限价单</option>
        </select>
        {orderType === 'LIMIT' && (
          <input className="input" type="number" step="0.01" placeholder="限价" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value ? Number(e.target.value) : '')} />
        )}
        <input className="input" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <button className="button" onClick={() => order('BUY')}>确认买入</button>
        <button className="button secondary" onClick={() => order('SELL')}>确认卖出</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  )
}
