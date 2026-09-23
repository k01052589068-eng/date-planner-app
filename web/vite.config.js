import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 배포가 반영됐는지 폰에서 확인할 수 있도록 빌드 시각(KST)을 버전으로 노출
const buildTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${process.env.npm_package_version} (${buildTime})`),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: '이번주 데이트',
        short_name: '이번주 데이트',
        description: '커플이 함께 쓰는 데이트 코스 추천 + 데이트 다이어리',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ff5a6e',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
})
