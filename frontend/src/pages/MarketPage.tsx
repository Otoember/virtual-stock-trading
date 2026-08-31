import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { search } from '../api'

export default function MarketPage() {
  const [keyword, setKeyword] = useState('600')
  const result = useQuery({ queryKey: ['search', keyword], queryFn: () => search(keyword) })

  return (
    <div className="card">
      <h2>行情搜索</h2>
      <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      <table className="table">
        <thead><tr><th>代码</th><th>名称</th><th>操作</th></tr></thead>
        <tbody>
          {(result.data ?? []).map((item: any) => <tr key={item.symbol}><td>{item.symbol}</td><td>{item.name}</td><td><Link to={`/stock/${item.symbol}`}>查看</Link></td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
