export type LoginPayload = { username: string; password: string }
export type RegisterPayload = { username: string; email: string; password: string }

export type Quote = {
  symbol: string
  name: string
  price: string
  change: string
  change_percent: string
  volume: number
  updated_at: string
}

export type Position = {
  symbol: string
  stock_name: string
  total_quantity: number
  available_quantity: number
  today_bought_quantity: number
  avg_cost: string
  current_price: string
  market_value: string
  unrealized_profit: string
  unrealized_return: string
  realized_profit: string
}

export type Account = {
  initial_cash: string
  cash: string
  frozen_cash: string
  market_value: string
  total_assets: string
  total_profit: string
  total_return: string
}

export type Order = {
  id: number
  symbol: string
  stock_name: string
  side: string
  price: string
  quantity: number
  status: string
  actual_amount: string
  fee: string
  created_at: string
}

export type Trade = {
  id: number
  order_id: number
  symbol: string
  side: string
  price: string
  quantity: number
  gross_amount: string
  fee: string
  net_amount: string
  executed_at: string
}

export type AssetSnapshot = {
  date: string
  total_assets: string
  cumulative_return: string
  daily_return: string
}

export type LeaderboardRow = {
  rank: number
  username: string
  total_assets: string
  cumulative_return: string
  daily_return: string
}
