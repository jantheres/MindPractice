const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to get WS URL from HTTP URL
const getWsUrl = (url) => {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    const protocol = window.location.protocol === 'https:' || !isLocal ? 'wss:' : 'ws:';
    
    // If url has protocol, replace it, otherwise add it
    if (url.startsWith('http')) {
        return url.replace(/^http/, 'ws');
    }
    return `${protocol}//${url}`;
};

export const API_URL = API_BASE_URL;
export const WS_URL = getWsUrl(API_BASE_URL);
