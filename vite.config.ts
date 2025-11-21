import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

const isTestHarness = process.env.npm_lifecycle_event === 'dev:test';

export default defineConfig({
    plugins: [
        react({
            // Disable React fast refresh on the harness to avoid duplicate injectIntoGlobalHook errors
            fastRefresh: !isTestHarness,
        }),
        crx({ manifest }),
    ],
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            port: 5173,
        },
    },
})
