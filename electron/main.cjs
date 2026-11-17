// 亚洲战场 · Windows 本地版主进程：本地静态服务（仅 127.0.0.1）喂游戏 dist，窗口直开。
// 游戏内 fetch/GLB/音频在 file:// 下会被 CORS 拦，故走 http://127.0.0.1 零改游戏代码。
const { app, BrowserWindow } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function gameRoot() {
  // 打包后：resources/game；开发时：../game/dist
  const packaged = path.join(process.resourcesPath, "game");
  if (app.isPackaged && fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "game", "dist");
}

function startServer(root) {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      const file = path.join(root, rel);
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404).end("not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
        res.end(data);
      });
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

app.whenReady().then(async () => {
  const { port } = await startServer(gameRoot());
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#10161d",
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = new BrowserWindow({ width: 1440, height: 900, autoHideMenuBar: true });
      void w.loadURL(`http://127.0.0.1:${port}/`);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
