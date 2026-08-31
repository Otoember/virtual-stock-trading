import axios from 'axios'
import type { Account, AssetSnapshot, LeaderboardRow, LoginPayload, Order, Position, Quote, RegisterPayload, Trade } from './types'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export const client = axios.create({ baseURL })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

export async function register(payload: RegisterPayload) {
  return (await client.post('/auth/register', payload)).data
}

export async function login(payload: LoginPayload) {
  return (await client.post('/auth/login', payload)).data
}

export async function me() {
  return (await client.get('/auth/me')).data
}

export async function search(keyword: string) {
  return (await client.get('/market/search', { params: { keyword } })).data
}

export async function quote(symbol: string): Promise<Quote> {
  return (await client.get(`/market/quote/${symbol}`)).data
}

export async function history(symbol: string): Promise<{ date: string; close: string }[]> {
  return (await client.get(`/market/history/${symbol}`)).data
}

export async function placeOrder(symbol: string, side: 'BUY' | 'SELL', quantity: number) {
  return (await client.post('/orders', { symbol, side, quantity }, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data
}

export async function getAccount(): Promise<Account> { return (await client.get('/account')).data }
export async function getPortfolio(): Promise<Position[]> { return (await client.get('/portfolio')).data }
export async function getOrders(): Promise<Order[]> { return (await client.get('/orders')).data }
export async function getTrades(): Promise<Trade[]> { return (await client.get('/trades')).data }
export async function getAssetsHistory(): Promise<AssetSnapshot[]> { return (await client.get('/assets/history')).data }
export async function getLeaderboard(): Promise<LeaderboardRow[]> { return (await client.get('/leaderboard')).data }
