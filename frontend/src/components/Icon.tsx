type IconName =
  | 'dashboard'
  | 'market'
  | 'wallet'
  | 'orders'
  | 'rank'
  | 'arrow'
  | 'refresh'
  | 'logout'
  | 'chart'
  | 'shield'

const paths: Record<IconName, string> = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  market: 'M4 18V9m0 0 5 4 5-9 6 4 M16 4h4v4 M3 21h18',
  wallet: 'M20 8V5H4a2 2 0 0 0 0 4h17v11H4a2 2 0 0 1-2-2V7 M21 12h-6v4h6',
  orders: 'M7 3h10v4H7z M7 5H4v16h16V5h-3 M8 12h8 M8 16h5',
  rank: 'M4 21V11h4v10 M10 21V3h4v18 M16 21v-7h4v7',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M6 6a8 8 0 0 1 13 2 M5 16a8 8 0 0 0 13 2',
  logout: 'M10 4H4v16h6 M10 12h11 M17 8l4 4-4 4',
  chart: 'M3 3v18h18 M7 14l4-4 4 3 6-8',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
}

export default function Icon({
  name,
  className = '',
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
