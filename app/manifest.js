export default function manifest() {
  return {
    name: 'Yes Chef!',
    short_name: 'Yes Chef!',
    description: "Your kitchen assistant. You're the chef, we do the prep.",
    start_url: '/',
    display: 'standalone',
    background_color: '#141B17',
    theme_color: '#141B17',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
