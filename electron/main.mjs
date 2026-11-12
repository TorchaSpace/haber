// Haber masaüstü uygulaması: haber sunucusunu uygulamanın içinde başlatır ve kendi penceresinde açar.
import { app, BrowserWindow, nativeTheme, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Canlı mod: paketlenmiş uygulama, derlendiği repo klasöründeki güncel kodu çalıştırır.
// Böylece `git pull` sonrası uygulamayı yeniden derlemeye gerek kalmaz; pull anında kendini yeniler.
function findLiveRepo() {
  try {
    const { repo } = JSON.parse(fs.readFileSync(path.join(here, 'repo-path.json'), 'utf8'));
    if (repo && fs.existsSync(path.join(repo, 'src', 'server.js')) && fs.existsSync(path.join(repo, 'node_modules', 'express'))) return repo;
  } catch {}
  return null;
}
const liveRepo = app.isPackaged ? findLiveRepo() : null;
const { startServer } = await import(liveRepo ? pathToFileURL(path.join(liveRepo, 'src', 'server.js')).href : '../src/server.js');

// Repodaki dosyalar değişince (git pull): arayüz değiştiyse sayfayı yenile, sunucu kodu değiştiyse uygulamayı yeniden başlat
function watchLive() {
  if (!liveRepo) return;
  let t1, t2;
  const watch = (dir, fn) => { try { fs.watch(path.join(liveRepo, dir), { recursive: true }, () => fn()); } catch {} };
  watch('public', () => { clearTimeout(t1); t1 = setTimeout(() => win?.webContents.reloadIgnoringCache(), 600); });
  watch('src', () => { clearTimeout(t2); t2 = setTimeout(() => { app.relaunch(); app.exit(0); }, 1500); });
}
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

// ---------- Menü çubuğunda son dakika ----------
// Son 6 saatte en çok kaynağın yazdığı haberler menü çubuğunda döner; tıklayınca uygulamada açılır.
let tray = null;
let trayItems = [];
let trayIdx = 0;
const short = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function showInApp(link) {
  if (!win) return createWindow().then(() => setTimeout(() => showInApp(link), 1500));
  win.show(); win.focus();
  win.webContents.executeJavaScript(`window.openByLink && window.openByLink(${JSON.stringify(link)})`);
}

async function refreshTray() {
  try {
    const { items } = await fetch(`${baseUrl}/api/news?limit=600`).then((r) => r.json());
    const recent = items.filter((i) => Date.now() - new Date(i.date || 0) < 6 * 3600e3);
    const seen = new Set();
    trayItems = recent
      .sort((a, b) => (b.storySize || 1) - (a.storySize || 1) || new Date(b.date) - new Date(a.date))
      .filter((i) => !seen.has(i.storyId) && seen.add(i.storyId))
      .slice(0, 10);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Şu an çok konuşulanlar', enabled: false },
      ...trayItems.map((i) => ({
        label: `${short(i.title, 70)}  ·  ${i.source}${i.storySize > 1 ? ` (+${i.storySize - 1})` : ''}`,
        click: () => showInApp(i.link),
      })),
      { type: 'separator' },
      { label: "Haber'i aç", click: () => (win ? (win.show(), win.focus()) : createWindow()) },
      { label: 'Menü çubuğu başlığını gizle/göster', click: () => { trayTitleOn = !trayTitleOn; rotateTray(); } },
      { label: 'Çık', role: 'quit' },
    ]));
    rotateTray();
  } catch {}
}
let trayTitleOn = true;
function rotateTray() {
  if (!tray) return;
  const i = trayItems[trayIdx++ % Math.max(1, trayItems.length)];
  tray.setTitle(trayTitleOn && i ? ` ${short(i.title, 42)}` : '', { fontType: 'monospacedDigit' });
  tray.setToolTip(i ? `${i.source}: ${i.title}` : 'Haber');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(here, 'trayTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  refreshTray();
  setInterval(refreshTray, 5 * 60 * 1000);
  setInterval(rotateTray, 20 * 1000);
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
  createWindow().then(createTray).then(watchLive);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
