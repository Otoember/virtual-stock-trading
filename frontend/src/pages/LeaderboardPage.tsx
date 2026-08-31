import { useQuery } from '@tanstack/react-query'
import { getLeaderboard } from '../api'

export default function LeaderboardPage() {
  const data = useQuery({ queryKey: ['leaderboard'], queryFn: getLeaderboard })
  if (data.isLoading) return <div>Loading...</div>

  return (
    <div className="card">
      <h2>收益排行榜</h2>
      <table className="table">
        <thead><tr><th>排名</th><th>用户名</th><th>总资产</th><th>累计收益率</th><th>今日收益率</th></tr></thead>
        <tbody>
          {(data.data ?? []).map((r) => <tr key={r.rank}><td>{r.rank}</td><td>{r.username}</td><td>{r.total_assets}</td><td>{(Number(r.cumulative_return) * 100).toFixed(2)}%</td><td>{(Number(r.daily_return) * 100).toFixed(2)}%</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}
