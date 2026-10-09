const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
if (process.env.FOW_USER_DATA) app.setPath('userData', process.env.FOW_USER_DATA);
app.setName('诸界联邦');
let window;
function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 1000, minWidth: 800, minHeight: 600,
    title: '诸界联邦 · Federation of Worlds', backgroundColor: '#eeeee5',
    show: process.env.FOW_SMOKE !== '1',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '游戏', submenu: [{ label: '退出', role: 'quit' }] },
    { label: '视图', submenu: [
      { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' },
      { label: '重置缩放', role: 'resetZoom' }, { type: 'separator' },
      { label: '全屏', role: 'togglefullscreen' },
    ] },
  ]));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
