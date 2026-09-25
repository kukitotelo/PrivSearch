// ============================================================
// PrivSearch – Browser IPC Handlers
// Direct, resilient navigation: handles back/forward/reload seamlessly.
// ============================================================

import { ipcMain, BrowserWindow, WebContentsView } from 'electron';
import { SessionManager } from '../SessionManager';
import { TabInfo } from '../types';

export function registerBrowserIpc(
  mainWindow: BrowserWindow,
  sessionManager: SessionManager,
  getView: (tabId?: string) => WebContentsView | undefined,
  getActiveTabInfo: () => TabInfo | undefined,
  createTab: (url?: string) => Promise<string>,
  closeTab: (tabId: string) => void,
  switchTab: (tabId: string) => void,
): void {

  ipcMain.handle('browser:getActiveTab', async () => {
    return getActiveTabInfo() || null;
  });

  ipcMain.handle('browser:navigate', async (_event, tabId: string, url: string) => {
    if (typeof url !== 'string') return { error: 'Invalid URL argument' };
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { error: 'Invalid URL' }; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Only http/https allowed' };

    const view = getView(tabId);
    if (!view) return { error: 'Tab not found' };
    view.webContents.loadURL(url);
    return { ok: true };
  });

  ipcMain.handle('browser:goBack', async (_event, tabId?: string) => {
    const view = getView(tabId);
    if (!view) return { error: 'No active view found' };
    try {
      if (view.webContents.navigationHistory.canGoBack()) {
        view.webContents.navigationHistory.goBack();
      } else {
        // Fallback attempt
        view.webContents.navigationHistory.goBack();
      }
      return {
        ok: true,
        canGoBack: view.webContents.navigationHistory.canGoBack(),
        canGoForward: view.webContents.navigationHistory.canGoForward(),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('browser:goForward', async (_event, tabId?: string) => {
    const view = getView(tabId);
    if (!view) return { error: 'No active view found' };
    try {
      if (view.webContents.navigationHistory.canGoForward()) {
        view.webContents.navigationHistory.goForward();
      } else {
        view.webContents.navigationHistory.goForward();
      }
      return {
        ok: true,
        canGoBack: view.webContents.navigationHistory.canGoBack(),
        canGoForward: view.webContents.navigationHistory.canGoForward(),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('browser:reload', async (_event, tabId?: string) => {
    const view = getView(tabId);
    if (!view) return { error: 'No active view found' };
    view.webContents.reload();
    return { ok: true };
  });

  ipcMain.handle('browser:newTab', async (_event, url?: string) => {
    const tabId = await createTab(url);
    return { tabId };
  });

  ipcMain.handle('browser:closeTab', async (_event, tabId: string) => {
    closeTab(tabId);
    return { ok: true };
  });

  ipcMain.handle('browser:switchTab', async (_event, tabId: string) => {
    switchTab(tabId);
    return { ok: true };
  });

  ipcMain.handle('browser:clearSession', async (_event, tabId: string) => {
    await sessionManager.clearTabSession(tabId);
    return { ok: true };
  });
}
