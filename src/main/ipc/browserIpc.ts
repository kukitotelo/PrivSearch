// ============================================================
// PrivSearch – Browser IPC Handlers
// All IPC channels validated before processing.
// No arbitrary Node APIs exposed to renderer.
// ============================================================

import { ipcMain, BrowserWindow, WebContentsView } from 'electron';
import { SessionManager } from '../SessionManager';

export function registerBrowserIpc(
  mainWindow: BrowserWindow,
  sessionManager: SessionManager,
  getView: (tabId: string) => WebContentsView | undefined,
  createTab: (url?: string) => Promise<string>,
  closeTab: (tabId: string) => void,
  switchTab: (tabId: string) => void,
): void {

  ipcMain.handle('browser:navigate', async (_event, tabId: string, url: string) => {
    if (typeof tabId !== 'string' || typeof url !== 'string') return { error: 'Invalid args' };
    // Validate URL
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { error: 'Invalid URL' }; }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Only http/https allowed' };

    const view = getView(tabId);
    if (!view) return { error: 'Tab not found' };
    view.webContents.loadURL(url);
    return { ok: true };
  });

  ipcMain.handle('browser:goBack', async (_event, tabId: string) => {
    const view = getView(tabId);
    if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
    return { ok: true };
  });

  ipcMain.handle('browser:goForward', async (_event, tabId: string) => {
    const view = getView(tabId);
    if (view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward();
    return { ok: true };
  });

  ipcMain.handle('browser:reload', async (_event, tabId: string) => {
    getView(tabId)?.webContents.reload();
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
