import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       "Kunal's Planner",
  description: 'Personal daily productivity planner with streaks, XP, and manager coaching',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%233B6D11'/><text x='16' y='23' text-anchor='middle' font-family='system-ui' font-size='20' font-weight='700' fill='white'>K</text></svg>",
  },
}

export const viewport: Viewport = {
  themeColor: '#3B6D11',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {children}
      </body>
    </html>
  )
}
