// Haber masaüstü uygulaması: haber sunucusunu uygulamanın içinde başlatır ve kendi penceresinde açar.
import { app, BrowserWindow, nativeTheme, Menu } from 'electron';
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

  // Haber bağlantıları uygulamadan çıkmadan, uygulamanın kendi okuma penceresinde açılır
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!/^https?:/.test(url)) return { action: 'deny' };
    openReader(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(baseUrl)) { e.preventDefault(); openReader(url); }
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  await win.loadURL(baseUrl);
}

// Orijinal haber sayfası için uygulama içi pencere (tarayıcı açılmaz)
function openReader(url) {
  const [x, y] = win ? win.getPosition() : [undefined, undefined];
  const reader = new BrowserWindow({
    width: 1100,
    height: 820,
    x: x !== undefined ? x + 40 : undefined,
    y: y !== undefined ? y + 40 : undefined,
    title: 'Haber',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e0e10' : '#ffffff',
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  // Bu pencerede açılmak istenen yeni sekmeler de aynı pencerede açılır
  reader.webContents.setWindowOpenHandler(({ url: next }) => {
    if (/^https?:/.test(next)) reader.loadURL(next);
    return { action: 'deny' };
  });
  reader.loadURL(url);
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
