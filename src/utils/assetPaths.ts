// Utility to resolve asset URLs so they always load from the extension package
export const getExtensionAssetUrl = (assetPath: string): string => {
    const normalized = assetPath.replace(/^\/+/, '');

    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(normalized);
    }

    // Fallback for local dev server where chrome.runtime is unavailable
    return `/${normalized}`;
};
