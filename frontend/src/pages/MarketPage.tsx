import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { search } from '../api'

export default function MarketPage() {
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(keyword.trim()), 300)
    return () => clearTimeout(timer)
  }, [keyword])
  const result = useQuery({
    queryKey: ['search', query],
    queryFn: ({ signal }) => search(query, signal),
    enabled: query.length > 0 && query === keyword.trim(),
    staleTime: 60000,
    retry: false,
  })
  const pending = keyword.trim().length > 0 && (query !== keyword.trim() || result.isFetching)
  const current = query === keyword.trim() && query.length > 0

  return (
    <div className="card">
      <h2>行情搜索</h2>
      <input className="input" aria-label="股票代码或名称" placeholder="输入股票代码或名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      {pending && <p role="status">正在查询A股数据...</p>}
      {current && result.isError && <p role="alert">A股数据查询失败，请稍后重试。<button onClick={() => result.refetch()}>重试</button></p>}
      {!keyword.trim() && <p>请输入股票代码或名称开始搜索。</p>}
      {current && !pending && result.isSuccess && result.data.length === 0 && <p>未找到匹配的股票。</p>}
      <table className="table">
        <thead><tr><th>代码</th><th>名称</th><th>操作</th></tr></thead>
        <tbody>
          {(current && !pending && !result.isError ? result.data ?? [] : []).map((item) => <tr key={item.symbol}><td>{item.symbol}</td><td>{item.name}</td><td><Link to={`/stock/${item.symbol}`}>查看</Link></td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
