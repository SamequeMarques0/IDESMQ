const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { LiveServer, CLIENT_FUNCTIONS, PREVIEW_UA } = require("./liveserver");
const { createUpdater } = require("./updater");

// Ícone do aplicativo (pasta assets). No Windows usa .ico; nos demais, .png.
const iconFile = (name) => {
  const file = path.join(__dirname, "..", "assets", name);
  return fsSync.existsSync(file) ? file : undefined;
};
const appIcon = iconFile(process.platform === "win32" ? "256.ico" : "256.png");

// Agrupa o ícone do app na barra de tarefas do Windows
if (process.platform === "win32") app.setAppUserModelId("com.samequemarques.smqide");

// Terminal completo: opcional. Se o node-pty não carregar, a IDE usa o terminal simples.
let nodePty = null;
try {
  nodePty = require("node-pty");
} catch {
  nodePty = null;
}

let win;
let forceClose = false;
let hasUnsaved = false; // a interface avisa quando há arquivos com alterações não salvas
let previewWin = null; // janela de pré-visualização do Live Server
const live = new LiveServer();

// Atualização automática (só no aplicativo instalado)
const updater = createUpdater({
  getWindow: () => win,
  send: (channel, payload) => sendToWindow(channel, payload),
  hasUnsaved: () => hasUnsaved,
  prepareToQuit: () => {
    forceClose = true; // deixa a janela fechar para o instalador poder trabalhar
  },
});
const procs = new Map();
const ptys = new Map();
let nextProcId = 1;
let nextPtyId = 1;

function sendToWindow(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

const isLocalUrl = (url) => /^http:\/\/(127\.0\.0\.1|localhost):\d+(\/|$)/.test(String(url));
const previewAlive = () => previewWin !== null && !previewWin.isDestroyed();

// Páginas conectadas = navegadores/painel (via SSE) + a janela de pré-visualização
function reportClients() {
  sendToWindow("live:clients", live.clients.size + (previewAlive() ? 1 : 0));
}

live.onClients = reportClients;

// A janela do Electron é atualizada direto pela IDE, sem depender da conexão SSE
live.onBroadcast = (kind) => {
  if (!previewAlive()) return;
  const action = kind === "css" ? "swapCss()" : kind === "html" ? "patch()" : "location.reload()";
  previewWin.webContents.executeJavaScript(`(function(){${CLIENT_FUNCTIONS}${action}})()`).catch(() => {});
};

function openPreviewWindow(url, focus) {
  if (previewAlive()) {
    if (previewWin.webContents.getURL() !== url) previewWin.loadURL(url);
    if (focus) {
      if (previewWin.isMinimized()) previewWin.restore();
      previewWin.show();
      previewWin.focus();
    }
    return;
  }

  previewWin = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    title: "Pré-visualização",
    backgroundColor: "#ffffff",
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const wc = previewWin.webContents;
  wc.setUserAgent(`${wc.getUserAgent()} ${PREVIEW_UA}`);
  previewWin.setMenuBarVisibility(false);
  previewWin.once("ready-to-show", () => previewWin?.showInactive()); // não tira o foco do editor

  // F5 / Ctrl+R recarrega, F12 abre o DevTools da página
  wc.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F12") wc.toggleDevTools();
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) wc.reloadIgnoringCache();
  });

  // Links para fora do servidor local abrem no navegador do sistema
  wc.setWindowOpenHandler(({ url: target }) => {
    if (isLocalUrl(target)) previewWin.loadURL(target);
    else if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, target) => {
    if (isLocalUrl(target)) return;
    event.preventDefault();
    if (/^https?:/i.test(target)) shell.openExternal(target);
  });

  previewWin.on("closed", () => {
    previewWin = null;
    sendToWindow("preview:state", false);
    reportClients();
  });

  previewWin.loadURL(url);
  sendToWindow("preview:state", true);
  reportClients();
}

function closePreviewWindow() {
  if (previewAlive()) previewWin.close();
}

function createWindow() {
  forceClose = false;
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: "#1f2329",
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  win.on("closed", closePreviewWindow);

  // Antes de fechar, a interface confirma se há alterações não salvas
  win.on("close", (event) => {
    if (forceClose || win.webContents.isLoading()) return;
    event.preventDefault();
    win.webContents.send("app:before-close");
  });

  // Atalhos de desenvolvimento: F5 / Ctrl+R recarrega, F12 abre o DevTools
  if (!app.isPackaged) {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (input.key === "F12") win.webContents.toggleDevTools();
      if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
        win.webContents.reload();
      }
    });
  }
}

// Visual limpo: sem barra de menu (no macOS mantém o menu padrão, que o sistema exige para copiar/colar)
if (process.platform !== "darwin") Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  if (process.platform === "darwin" && !app.isPackaged) {
    const png = iconFile("256.png");
    if (png) app.dock?.setIcon(png);
  }
  createWindow();
  updater.checkOnStartup();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  for (const child of procs.values()) killTree(child);
  for (const proc of ptys.values()) {
    try {
      proc.kill();
    } catch {}
  }
  stopFolderWatch();
  live.stop();
});

/* ---------- Utilidades ---------- */

const FRIENDLY_ERRORS = {
  EEXIST: "Já existe um item com esse nome.",
  ENOENT: "O item não existe mais.",
  EACCES: "Sem permissão para essa operação.",
  EPERM: "Sem permissão para essa operação.",
  EBUSY: "O item está em uso por outro programa.",
};

// Registra um handler IPC que devolve mensagens de erro em português
function handle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      throw new Error(FRIENDLY_ERRORS[err.code] || err.message);
    }
  });
}

const INVALID_NAME = /[<>:"/\\|?*\x00-\x1f]/;

function assertValidName(name) {
  if (!name || name === "." || name === ".." || INVALID_NAME.test(name)) {
    throw new Error('Nome inválido. Não use / \\ : * ? " < > | e não deixe em branco.');
  }
  if (process.platform === "win32" && /[. ]$/.test(name)) {
    throw new Error("No Windows, o nome não pode terminar com ponto ou espaço.");
  }
}

/* ---------- App ---------- */

ipcMain.handle("app:info", () => ({ platform: process.platform, home: os.homedir(), version: app.getVersion() }));

ipcMain.handle("app:set-unsaved", (_event, value) => {
  hasUnsaved = Boolean(value);
});

ipcMain.handle("update:check", () => updater.check({ manual: true }));

ipcMain.handle("app:close-now", () => {
  forceClose = true;
  win.close();
});

/* ---------- Arquivos e pastas ---------- */

const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function readTextFile(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FILE_SIZE) throw new Error("O arquivo é maior que 5 MB.");
  const buffer = await fs.readFile(filePath);
  if (buffer.subarray(0, 8000).includes(0)) throw new Error("Arquivo binário: não pode ser aberto no editor.");
  return buffer.toString("utf8");
}

handle("file:open", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ["openFile"] });
  if (canceled || filePaths.length === 0) return null;
  return { path: filePaths[0], contents: await readTextFile(filePaths[0]) };
});

handle("file:read", async (_event, filePath) => ({
  path: filePath,
  contents: await readTextFile(filePath),
}));

handle("file:save", async (_event, currentPath, contents, forceDialog) => {
  let target = currentPath;
  if (!target || forceDialog) {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: currentPath || "index.html",
    });
    if (canceled || !filePath) return null;
    target = filePath;
  }
  await fs.writeFile(target, contents, "utf8");
  live.fileSaved(target, contents); // avisa o navegador na hora, sem depender do watcher do sistema
  return target;
});

handle("folder:open", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ["openDirectory"] });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

handle("dir:read", async (_event, dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .map((e) => ({ name: e.name, path: path.join(dirPath, e.name), isDir: e.isDirectory() }))
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
});

handle("fs:create", async (_event, dirPath, name, isDir) => {
  assertValidName(name);
  const target = path.join(dirPath, name);
  if (isDir) await fs.mkdir(target);
  else await fs.writeFile(target, "", { flag: "wx" });
  return target;
});

handle("fs:rename", async (_event, oldPath, newName) => {
  assertValidName(newName);
  const target = path.join(path.dirname(oldPath), newName);
  if (target === oldPath) return target;
  const exists = await fs.access(target).then(() => true, () => false);
  // permite trocar só maiúsculas/minúsculas (o Windows considera o mesmo arquivo)
  if (exists && target.toLowerCase() !== oldPath.toLowerCase()) throw new Error("Já existe um item com esse nome.");
  await fs.rename(oldPath, target);
  return target;
});

handle("fs:delete", async (_event, targetPath) => {
  await shell.trashItem(targetPath); // vai para a lixeira, não apaga de vez
  return true;
});

const SKIP_DIRS = new Set(["node_modules", ".git", ".svn", ".hg", "__pycache__"]);

// Lista os arquivos da pasta (caminhos relativos) para a busca rápida
handle("fs:list-files", async (_event, root) => {
  const MAX = 20000;
  const out = [];
  async function walk(dir) {
    if (out.length >= MAX) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(full);
      } else {
        out.push(path.relative(root, full));
      }
    }
  }
  await walk(root);
  return out;
});

/* ---------- Observador da pasta aberta (atualiza a árvore) ---------- */

let folderWatcher = null;
let folderTimer = null;

function stopFolderWatch() {
  clearTimeout(folderTimer);
  if (folderWatcher) {
    folderWatcher.close();
    folderWatcher = null;
  }
}

ipcMain.handle("watch:start", (_event, root) => {
  stopFolderWatch();
  const onChange = (eventType, filename) => {
    // "rename" = arquivo criado, apagado ou renomeado (salvar o conteúdo não interessa à árvore)
    if (eventType !== "rename") return;
    if (filename && /(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(String(filename))) return;
    clearTimeout(folderTimer);
    folderTimer = setTimeout(() => sendToWindow("folder:changed", null), 300);
  };
  try {
    folderWatcher = fsSync.watch(root, { recursive: true }, onChange);
  } catch {
    try {
      folderWatcher = fsSync.watch(root, onChange);
    } catch {
      folderWatcher = null;
    }
  }
  if (folderWatcher) folderWatcher.on("error", () => {});
});

ipcMain.handle("watch:stop", () => stopFolderWatch());

/* ---------- Diálogos ---------- */

ipcMain.handle("dialog:confirm-discard", async (_event, message) => {
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    title: "Alterações não salvas",
    message: message || "Há alterações não salvas. Descartar e continuar?",
    buttons: ["Descartar", "Cancelar"],
    defaultId: 1,
    cancelId: 1,
  });
  return response === 0;
});

ipcMain.handle("dialog:confirm", async (_event, message, detail, okLabel) => {
  const { response } = await dialog.showMessageBox(win, {
    type: "warning",
    message,
    detail: detail || "",
    buttons: [okLabel || "Ok", "Cancelar"],
    defaultId: 1,
    cancelId: 1,
  });
  return response === 0;
});

ipcMain.handle("dialog:error", async (_event, title, message) => {
  await dialog.showMessageBox(win, { type: "error", title, message, buttons: ["Ok"] });
});

/* ---------- Live Server ---------- */

handle("live:start", async (_event, root) => {
  const port = await live.start(root);
  return { port, root };
});

ipcMain.handle("live:stop", async () => {
  closePreviewWindow();
  await live.stop();
});

ipcMain.handle("preview:open", (_event, url) => {
  if (isLocalUrl(url)) openPreviewWindow(url, true);
});

// Acompanha o arquivo HTML aberto no editor, sem tirar o foco
ipcMain.handle("preview:navigate", (_event, url) => {
  if (isLocalUrl(url) && previewAlive()) openPreviewWindow(url, false);
});

ipcMain.handle("preview:close", () => closePreviewWindow());
ipcMain.handle("live:push", (_event, filePath, text) => live.push(filePath, text));
ipcMain.handle("live:clear", (_event, filePath) => live.clearOverlay(filePath));

ipcMain.handle("shell:open-external", (_event, url) => {
  if (isLocalUrl(url)) return shell.openExternal(url);
});

/* ---------- Terminal completo (node-pty) ---------- */

ipcMain.handle("pty:available", () => nodePty !== null);

handle("pty:create", (_event, cwd, cols, rows) => {
  if (!nodePty) throw new Error("node-pty não está disponível.");
  const isWin = process.platform === "win32";
  // cmd.exe no Windows evita o bloqueio de scripts do PowerShell (npm.ps1)
  const shellPath = isWin ? process.env.COMSPEC || "cmd.exe" : process.env.SHELL || "/bin/bash";
  const proc = nodePty.spawn(shellPath, [], {
    name: "xterm-256color",
    cols: Math.max(cols || 80, 2),
    rows: Math.max(rows || 24, 1),
    cwd,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
  });
  const id = nextPtyId++;
  ptys.set(id, proc);
  proc.onData((data) => sendToWindow("pty:data", { id, data }));
  proc.onExit(() => {
    ptys.delete(id);
    sendToWindow("pty:exit", { id });
  });
  return id;
});

ipcMain.handle("pty:write", (_event, id, data) => {
  ptys.get(id)?.write(data);
});

ipcMain.handle("pty:resize", (_event, id, cols, rows) => {
  try {
    ptys.get(id)?.resize(Math.max(cols, 2), Math.max(rows, 1));
  } catch {}
});

ipcMain.handle("pty:kill", (_event, id) => {
  try {
    ptys.get(id)?.kill();
  } catch {}
});

/* ---------- Terminal simples (reserva) ---------- */

function killTree(child) {
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

ipcMain.handle("term:run", (_event, command, cwd) => {
  const id = nextProcId++;
  const isWin = process.platform === "win32";
  // No Windows, força UTF-8 no cmd.exe para os acentos saírem corretos
  const fullCommand = isWin ? `chcp 65001 >nul & ${command}` : command;

  const child = spawn(fullCommand, {
    cwd,
    shell: true,
    windowsHide: true,
    detached: !isWin,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TERM: "dumb" },
  });
  procs.set(id, child);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let finished = false;
  const finish = (code, signal) => {
    if (finished) return;
    finished = true;
    procs.delete(id);
    sendToWindow("term:exit", { id, code, signal });
  };

  child.stdout.on("data", (data) => sendToWindow("term:data", { id, stream: "out", data }));
  child.stderr.on("data", (data) => sendToWindow("term:data", { id, stream: "err", data }));
  child.on("error", (err) => {
    sendToWindow("term:data", { id, stream: "err", data: `${err.message}\n` });
    finish(-1, null);
  });
  child.on("close", (code, signal) => finish(code, signal));
  return id;
});

ipcMain.handle("term:kill", (_event, id) => {
  const child = procs.get(id);
  if (child) killTree(child);
});

ipcMain.handle("term:stdin", (_event, id, text) => {
  const child = procs.get(id);
  if (child && child.stdin.writable) child.stdin.write(text);
});

ipcMain.handle("term:cd", async (_event, cwd, target) => {
  const dest = path.resolve(cwd, target);
  const stat = await fs.stat(dest);
  if (!stat.isDirectory()) throw new Error("Não é uma pasta.");
  return dest;
});
