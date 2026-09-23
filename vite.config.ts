import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            srcDir: 'src',
            filename: 'service-worker.ts',
            strategies: 'injectManifest',
            injectRegister: null,
            manifest: false,
            injectManifest: {
                injectionPoint: undefined,
                rollupFormat: 'iife',
            },
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
