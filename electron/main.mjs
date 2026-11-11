// Haber masaüstü uygulaması: haber sunucusunu uygulamanın içinde başlatır ve kendi penceresinde açar.
import { app, BrowserWindow, shell, nativeTheme, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let win = null;
let baseUrl = null;

async function createWindow() {
  if (!baseUrl) baseUrl = `http://127.0.0.1:${await startServer(0)}`;

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 560,
    title: 'Haber',
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 22 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e0e10' : '#f4f2ee',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Haber bağlantıları uygulamanın içinde değil, varsayılan tarayıcıda açılır
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); shell.openExternal(url); }
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  await win.loadURL(baseUrl);
}

app.setName('Haber');
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu', label: 'Haber' },
    { role: 'editMenu', label: 'Düzen' },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', accelerator: 'CmdOrCtrl+R', click: () => win?.webContents.executeJavaScript("document.getElementById('refresh')?.click()") },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Gerçek boyut' },
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tam ekran' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
    { role: 'windowMenu', label: 'Pencere' },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
