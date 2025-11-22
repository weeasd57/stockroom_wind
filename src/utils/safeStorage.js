/**
 * Safe wrapper around localStorage to prevent crashes in sandboxed environments
 * (like CodeCanyon live preview or online HTML viewers).
 */
export const safeStorage = {
    getItem: (key) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
        } catch (e) {
            console.warn(`[safeStorage] Failed to get item '${key}':`, e);
        }
        return null;
    },

    setItem: (key, value) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn(`[safeStorage] Failed to set item '${key}':`, e);
        }
    },

    removeItem: (key) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn(`[safeStorage] Failed to remove item '${key}':`, e);
        }
    },

    clear: () => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.clear();
            }
        } catch (e) {
            console.warn('[safeStorage] Failed to clear storage:', e);
        }
    }
};

export default safeStorage;
