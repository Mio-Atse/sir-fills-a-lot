// File: src/background/index.ts
import { StorageService } from '../storage/storage';
import { JobDescription } from '../storage/schema';

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "save-job-description",
        title: "Save selection as Job Description",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "save-job-description" && info.selectionText) {
        const job: JobDescription = {
            id: crypto.randomUUID(),
            text: info.selectionText,
            sourceUrl: tab?.url || '',
            timestamp: Date.now(),
            title: tab?.title || 'Unknown Job'
        };

        await StorageService.saveJobDescription(job);

        // Notify user (simple badge or console for now, maybe notification later)
        chrome.action.setBadgeText({ text: "OK" });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_JOB_DESCRIPTION') {
        const job: JobDescription = {
            id: crypto.randomUUID(),
            text: message.text,
            sourceUrl: sender.tab?.url || '',
            timestamp: Date.now(),
            title: sender.tab?.title || 'Unknown Job'
        };
        StorageService.saveJobDescription(job).then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }
});
