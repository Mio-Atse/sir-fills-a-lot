import { defineManifest } from '@crxjs/vite-plugin'
import { version } from '../package.json'

export default defineManifest({
    manifest_version: 3,
    name: 'Sir Fills-A-Lot',
    version,
    description: 'Semi-automatic job application filler with local LLM support.',
    permissions: [
        'storage',
        'activeTab',
        'scripting',
        'contextMenus'
    ],
    host_permissions: [
        '<all_urls>'
    ],
    background: {
        service_worker: 'src/background/index.ts',
        type: 'module',
    },
    action: {
        default_popup: 'src/popup/index.html',
    },
    options_page: 'src/options/index.html',
    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/index.tsx'],
            exclude_matches: [
                'http://localhost:5173/test/*',
                'https://localhost:5173/test/*',
                'http://127.0.0.1:5173/test/*',
                'https://127.0.0.1:5173/test/*',
            ],
            all_frames: true,
        },
    ],
    web_accessible_resources: [
        {
            resources: ['src/content/chatWidget/ChatWidget.css', 'icons/**'],
            matches: ['<all_urls>'],
        },
    ],
})
