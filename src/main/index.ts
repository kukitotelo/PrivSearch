// ============================================================
// PrivSearch – Main Process Entry Point
// Implements secure desktop research browser architecture
// with isolated WebContentsView per tab.
// ============================================================

import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NetworkLayer } from './NetworkLayer';
import { PrivacyLayer } from './PrivacyLayer';
import { PermissionManager } from './PermissionManager';
import { SessionManager } from './SessionManager';
import { SearchEngine } from '../search/SearchEngine';
import { SQLiteAdapter } from '../db/SQLiteAdapter';
import { registerBrowserIpc } from './ipc/browserIpc';
import { registerSearchIpc } from './ipc/searchIpc';
import { registerPrivacyIpc } from './ipc/privacyIpc';
import { TabInfo } from './types';

let mainWindow: BrowserWindow | null = null;

// Core services
const networkLayer = new NetworkLayer();
const privacyLayer = new PrivacyLayer(PrivacyLayer.defaultConfig());
const permissionManager = new PermissionManager();
const sessionManager = new SessionManager(
  networkLayer,
  permissionManager,
  privacyLayer.getConfig()
);

// Data storage
const dbPath = path.join(app.getPath('userData'), 'privsearch.db');
const storage = new SQLiteAdapter(dbPath);
const searchEngine = new SearchEngine(storage);

// Tab management
interface ActiveTab {
  info: TabInfo;
  view: WebContentsView;
}
const tabs = new Map<string, ActiveTab>();
let activeTabId: string | null = null;
let isViewVisible = true;

const TOP_BAR_HEIGHT = 80;

function layoutActiveView(): void {
  if (!mainWindow || !activeTabId) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;

  if (!isViewVisible) {
    // Hide the native view by setting bounds to 0
    tab.view.setBounds({ x: 0, y: TOP_BAR_HEIGHT, width: 0, height: 0 });
    return;
  }

  const bounds = mainWindow.getContentBounds();
  tab.view.setBounds({
    x: 0,
    y: TOP_BAR_HEIGHT,
    width: bounds.width,
    height: Math.max(0, bounds.height - TOP_BAR_HEIGHT),
  });
}

function updateTabNavigationState(tabInfo: TabInfo, view: WebContentsView) {
  tabInfo.url = view.webContents.getURL();
  tabInfo.title = view.webContents.getTitle() || tabInfo.url || 'Pestaña';
  tabInfo.canGoBack = view.webContents.navigationHistory.canGoBack();
  tabInfo.canGoForward = view.webContents.navigationHistory.canGoForward();
  mainWindow?.webContents.send('tab:updated', { ...tabInfo });
}

async function createTab(initialUrl?: string): Promise<string> {
  const tabId = uuidv4();
  const session = await sessionManager.createTabSession(tabId);
  const partInfo = sessionManager.getPartitionInfo(tabId);

  const view = new WebContentsView({
    webPreferences: {
      session,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const tabInfo: TabInfo = {
    id: tabId,
    title: 'New Tab',
    url: initialUrl || 'about:blank',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    partitionId: partInfo?.partitionId || tabId,
    isTemporary: partInfo?.isTemporary ?? true,
  };

  tabs.set(tabId, { info: tabInfo, view });

  // 1. Loading started
  view.webContents.on('did-start-loading', () => {
    tabInfo.isLoading = true;
    updateTabNavigationState(tabInfo, view);
  });

  // 2. Loading stopped
  view.webContents.on('did-stop-loading', () => {
    tabInfo.isLoading = false;
    updateTabNavigationState(tabInfo, view);
  });

  // 3. Regular navigation completed (full page load)
  view.webContents.on('did-navigate', () => {
    updateTabNavigationState(tabInfo, view);
  });

  // 4. In-page navigation completed (SPA, pushState, popstate, hash change)
  view.webContents.on('did-navigate-in-page', () => {
    updateTabNavigationState(tabInfo, view);
  });

  if (initialUrl && initialUrl !== 'about:blank') {
    view.webContents.loadURL(initialUrl);
  }

  // Switch to this new tab
  switchTab(tabId);

  return tabId;
}

function switchTab(tabId: string): void {
  if (!mainWindow) return;
  const tab = tabs.get(tabId);
  if (!tab) return;

  // Hide existing tab view
  if (activeTabId && tabs.has(activeTabId)) {
    const current = tabs.get(activeTabId);
    if (current) {
      mainWindow.contentView.removeChildView(current.view);
    }
  }

  activeTabId = tabId;
  mainWindow.contentView.addChildView(tab.view);
  layoutActiveView();
  updateTabNavigationState(tab.info, tab.view);
}

function closeTab(tabId: string): void {
  const tab = tabs.get(tabId);
  if (!tab || !mainWindow) return;

  if (activeTabId === tabId) {
    mainWindow.contentView.removeChildView(tab.view);
  }

  tabs.delete(tabId);
  sessionManager.clearTabSession(tabId).catch(() => {});

  if (activeTabId === tabId) {
    const remaining = Array.from(tabs.keys());
    if (remaining.length > 0) {
      switchTab(remaining[remaining.length - 1]);
    } else {
      createTab();
    }
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PrivSearch',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('resize', () => {
    layoutActiveView();
  });

  // Register IPC handlers
  registerBrowserIpc(
    mainWindow,
    sessionManager,
    (id?: string) => {
      if (id && tabs.has(id)) return tabs.get(id)?.view;
      if (activeTabId && tabs.has(activeTabId)) return tabs.get(activeTabId)?.view;
      return undefined;
    },
    () => (activeTabId ? tabs.get(activeTabId)?.info : undefined),
    createTab,
    closeTab,
    switchTab
  );

  // IPC to toggle native view visibility (for search overlay)
  ipcMain.handle('browser:setViewVisible', async (_event, visible: boolean) => {
    isViewVisible = !!visible;
    layoutActiveView();
    return { ok: true };
  });

  registerSearchIpc(searchEngine);
  registerPrivacyIpc(privacyLayer, networkLayer);

  // Load UI renderer HTML
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  await mainWindow.loadFile(rendererPath);

  // Create initial tab
  await createTab('https://duckduckgo.com');
}

app.whenReady().then(async () => {
  try {
    await storage.initialize();
  } catch (err) {
    console.error('Failed to initialize local database:', err);
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
