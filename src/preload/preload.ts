// ============================================================
// PrivSearch – Preload Script
// Strictly isolated: NO Node.js APIs exposed directly.
// Exposes exclusively safe, type-checked IPC bridges.
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';

export interface PrivSearchAPI {
  // Navigation
  navigate: (tabId: string, url: string) => Promise<{ ok?: boolean; error?: string }>;
  goBack: (tabId: string) => Promise<{ ok?: boolean }>;
  goForward: (tabId: string) => Promise<{ ok?: boolean }>;
  reload: (tabId: string) => Promise<{ ok?: boolean }>;
  newTab: (url?: string) => Promise<{ tabId: string }>;
  closeTab: (tabId: string) => Promise<{ ok?: boolean }>;
  switchTab: (tabId: string) => Promise<{ ok?: boolean }>;

  // Search
  searchQuery: (query: string) => Promise<{ ok?: boolean; results?: any; error?: string }>;
  classifyQuery: (query: string) => Promise<any>;

  // Privacy & Network
  getPrivacyStatus: () => Promise<any>;
  setNetworkConfig: (cfg: any) => Promise<{ ok?: boolean; error?: string }>;
  verifyRoute: () => Promise<{ status: string }>;
  setPrivacyConfig: (cfg: any) => Promise<{ ok?: boolean }>;

  // Event Listeners from Main
  onTabUpdated: (callback: (tab: any) => void) => () => void;
  onPrivacyStatusChanged: (callback: (status: any) => void) => () => void;
}

const api: PrivSearchAPI = {
  navigate: (tabId, url) => ipcRenderer.invoke('browser:navigate', tabId, url),
  goBack: (tabId) => ipcRenderer.invoke('browser:goBack', tabId),
  goForward: (tabId) => ipcRenderer.invoke('browser:goForward', tabId),
  reload: (tabId) => ipcRenderer.invoke('browser:reload', tabId),
  newTab: (url) => ipcRenderer.invoke('browser:newTab', url),
  closeTab: (tabId) => ipcRenderer.invoke('browser:closeTab', tabId),
  switchTab: (tabId) => ipcRenderer.invoke('browser:switchTab', tabId),

  searchQuery: (query) => ipcRenderer.invoke('search:query', query),
  classifyQuery: (query) => ipcRenderer.invoke('search:classify', query),

  getPrivacyStatus: () => ipcRenderer.invoke('privacy:getStatus'),
  setNetworkConfig: (cfg) => ipcRenderer.invoke('privacy:setNetworkConfig', cfg),
  verifyRoute: () => ipcRenderer.invoke('privacy:verifyRoute'),
  setPrivacyConfig: (cfg) => ipcRenderer.invoke('privacy:setPrivacyConfig', cfg),

  onTabUpdated: (callback) => {
    const handler = (_event: any, tab: any) => callback(tab);
    ipcRenderer.on('tab:updated', handler);
    return () => ipcRenderer.removeListener('tab:updated', handler);
  },
  onPrivacyStatusChanged: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('privacy:statusChanged', handler);
    return () => ipcRenderer.removeListener('privacy:statusChanged', handler);
  },
};

contextBridge.exposeInMainWorld('privSearch', api);
