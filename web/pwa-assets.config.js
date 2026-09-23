import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// public/icon.svg 를 원본으로 PWA 아이콘(PNG, favicon)을 생성한다: npm run icons
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
