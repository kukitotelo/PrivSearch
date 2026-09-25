export const app = {
  getPath: jest.fn(() => '/tmp/privsearch-test'),
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  loadFile: jest.fn(),
  on: jest.fn(),
  getContentBounds: jest.fn(() => ({ width: 1200, height: 800 })),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
  },
  contentView: {
    addChildView: jest.fn(),
    removeChildView: jest.fn(),
  },
}));

export const WebContentsView = jest.fn().mockImplementation(() => ({
  webContents: {
    loadURL: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    reload: jest.fn(),
    canGoBack: jest.fn(() => false),
    canGoForward: jest.fn(() => false),
    getURL: jest.fn(() => 'https://example.com'),
    getTitle: jest.fn(() => 'Example Domain'),
    on: jest.fn(),
  },
  setBounds: jest.fn(),
}));

export const session = {
  fromPartition: jest.fn(() => ({
    setProxy: jest.fn(() => Promise.resolve()),
    setPermissionRequestHandler: jest.fn(),
    clearStorageData: jest.fn(() => Promise.resolve()),
    clearCache: jest.fn(() => Promise.resolve()),
    webRequest: {
      onBeforeSendHeaders: jest.fn(),
      onHeadersReceived: jest.fn(),
    },
  })),
};

export const net = {
  fetch: jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ ip: '1.2.3.4' })),
    json: () => Promise.resolve({ ip: '1.2.3.4' }),
  })),
};

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

export const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
};
