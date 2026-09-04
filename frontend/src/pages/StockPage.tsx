import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { placeOrder, quote } from '../api'

export default function StockPage() {
  const { symbol = '' } = useParams()
  const q = useQuery({
    queryKey: ['quote', symbol], queryFn: ({ signal }) => quote(symbol, signal),
    enabled: /^\d{6}$/.test(symbol), staleTime: 60000, retry: false,
  })
  const [quantity, setQuantity] = useState(100)
  const [msg, setMsg] = useState('')

  const order = async (side: 'BUY' | 'SELL') => {
    if (!confirm(`确认${side === 'BUY' ? '买入' : '卖出'} ${symbol} ${quantity}股？`)) return
    try {
      await placeOrder(symbol, side, quantity)
      setMsg('下单成功')
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? '下单失败')
    }
  }

  if (!/^\d{6}$/.test(symbol)) return <div role="alert">请输入有效的六位股票代码。</div>
  if (q.isLoading) return <div role="status">正在加载 {symbol} 行情，最多等待5秒...</div>
  const timedOut = axios.isAxiosError(q.error) && (
    q.error.code === 'ECONNABORTED' || q.error.code === 'ETIMEDOUT' || q.error.response?.status === 504
  )
  const errorMessage = timedOut ? '行情请求超时，请稍后重试。' :
    axios.isAxiosError(q.error) ? q.error.response?.data?.message ?? '行情请求失败，请检查网络后重试。' : '行情加载失败，请重试。'
  if (q.error && !q.data) return <div className="card" role="alert"><p>{errorMessage}</p><button className="button" onClick={() => q.refetch()}>重新加载</button></div>
  if (!q.data) return <div className="error">暂无行情</div>

  return (
    <div className="card">
      <h2>{q.data.name} ({q.data.symbol})</h2>
      <p>现价: ¥{q.data.price}，涨跌幅: {q.data.change_percent}%</p>
      <p>更新时间: {new Date(q.data.updated_at).toLocaleString()}</p>
      <p>行情来源: {q.data.source} · 缓存最长60秒（休市时显示最近报价）</p>
      <button className="button secondary" disabled={q.isFetching} onClick={() => q.refetch()}>刷新行情</button>
      {q.isFetching && <p role="status">正在刷新行情...</p>}
      {q.error && <p role="alert">{errorMessage} 当前展示上次加载的数据，暂不可下单。</p>}
      <div className="row">
        <input className="input" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <button className="button" disabled={q.isError || q.isFetching} onClick={() => order('BUY')}>确认买入</button>
        <button className="button secondary" disabled={q.isError || q.isFetching} onClick={() => order('SELL')}>确认卖出</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  )
}
