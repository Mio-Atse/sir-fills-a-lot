import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
    manifest_version: 3,
    name: 'Sir Fills-A-Lot',
    version: '1.0.0',
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
