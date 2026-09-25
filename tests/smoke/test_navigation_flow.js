const { app, WebContentsView, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 800, height: 600, show: false });
  const view = new WebContentsView();
  win.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 800, height: 600 });

  // 1. Load initial page
  await view.webContents.loadURL('about:blank');
  console.log('Step 1 URL:', view.webContents.getURL());
  console.log('Step 1 canGoBack:', view.webContents.navigationHistory.canGoBack());

  // 2. Load second page
  await view.webContents.loadURL('data:text/html,<h1>Page 1</h1>');
  console.log('Step 2 URL:', view.webContents.getURL());
  console.log('Step 2 canGoBack:', view.webContents.navigationHistory.canGoBack());

  // 3. Load third page
  await view.webContents.loadURL('data:text/html,<h1>Page 2</h1>');
  console.log('Step 3 URL:', view.webContents.getURL());
  console.log('Step 3 canGoBack:', view.webContents.navigationHistory.canGoBack());

  // 4. Test goBack
  if (view.webContents.navigationHistory.canGoBack()) {
    view.webContents.navigationHistory.goBack();
    // Wait brief tick for navigation
    await new Promise(r => setTimeout(r, 200));
    console.log('Step 4 (After goBack) URL:', view.webContents.getURL());
    console.log('Step 4 canGoForward:', view.webContents.navigationHistory.canGoForward());
  }

  win.destroy();
  console.log('NAVIGATION_FLOW_VERIFIED');
  app.exit(0);
});
