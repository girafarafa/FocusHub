const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

function createWindow() {
  const { height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 520,
    height: Math.min(820, height),
    minWidth: 430,
    minHeight: 560,
    center: true,
    frame: false,
    transparent: false,
    backgroundColor: '#fff8fb',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('store-get', (_, key) => store.get(key));
ipcMain.handle('store-set', (_, key, value) => store.set(key, value));
ipcMain.handle('store-delete', (_, key) => store.delete(key));

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('close-window', () => mainWindow?.close());
ipcMain.on('toggle-always-on-top', () => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop());
});
