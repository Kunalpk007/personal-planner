import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kunal's Planner",
    short_name: 'Planner',
    description: 'Personal daily productivity planner with streaks, XP, and manager coaching',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0f0f',
    theme_color: '#3B6D11',
    orientation: 'portrait',
    categories: ['productivity', 'utilities'],
    prefer_related_applications: false,
    icons: [
      {
        src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%233B6D11'/><text x='16' y='23' text-anchor='middle' font-family='system-ui' font-size='20' font-weight='700' fill='white'>K</text></svg>",
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}