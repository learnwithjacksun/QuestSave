import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

function siteUrlPlugin(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/$/, '') || 'https://questsave.app'
  return {
    name: 'questsave-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', site)
    },
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist')
      for (const name of ['robots.txt', 'sitemap.xml']) {
        const file = path.join(dist, name)
        if (!existsSync(file)) continue
        const text = readFileSync(file, 'utf8')
        writeFileSync(file, text.replaceAll('__SITE_URL__', site))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || 'https://questsave.app'

  return {
    plugins: [react(), tailwindcss(), siteUrlPlugin(siteUrl)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      open: true,
      host: true,
    },
  }
})
