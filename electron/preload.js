const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const listen = (channel, callback) => ipcRenderer.on(channel, (_event, payload) => callback(payload));

// Única ponte entre a interface (HTML/JS) e o sistema.
contextBridge.exposeInMainWorld("api", {
  info: () => invoke("app:info"),

  // Arquivos e pastas
  openFile: () => invoke("file:open"),
  openFolder: () => invoke("folder:open"),
  readFile: (path) => invoke("file:read", path),
  readDir: (path) => invoke("dir:read", path),
  saveFile: (path, contents, forceDialog = false) => invoke("file:save", path, contents, forceDialog),
  createItem: (dirPath, name, isDir) => invoke("fs:create", dirPath, name, isDir),
  renameItem: (path, newName) => invoke("fs:rename", path, newName),
  deleteItem: (path) => invoke("fs:delete", path),
  listFiles: (root) => invoke("fs:list-files", root),
  watchStart: (root) => invoke("watch:start", root),
  watchStop: () => invoke("watch:stop"),
  onFolderChanged: (callback) => listen("folder:changed", callback),

  // Diálogos
  confirmDiscard: (message) => invoke("dialog:confirm-discard", message),
  confirm: (message, detail, okLabel) => invoke("dialog:confirm", message, detail, okLabel),
  showError: (title, message) => invoke("dialog:error", title, message),

  // Live Server
  liveStart: (root) => invoke("live:start", root),
  liveStop: () => invoke("live:stop"),
  livePush: (path, text) => invoke("live:push", path, text),
  liveClear: (path) => invoke("live:clear", path),
  onLiveClients: (callback) => listen("live:clients", callback),
  openExternal: (url) => invoke("shell:open-external", url),
  previewOpen: (url) => invoke("preview:open", url),
  previewNavigate: (url) => invoke("preview:navigate", url),
  previewClose: () => invoke("preview:close"),
  onPreviewState: (callback) => listen("preview:state", callback),

  // Terminal completo (node-pty)
  ptyAvailable: () => invoke("pty:available"),
  ptyCreate: (cwd, cols, rows) => invoke("pty:create", cwd, cols, rows),
  ptyWrite: (id, data) => invoke("pty:write", id, data),
  ptyResize: (id, cols, rows) => invoke("pty:resize", id, cols, rows),
  ptyKill: (id) => invoke("pty:kill", id),
  onPtyData: (callback) => listen("pty:data", callback),
  onPtyExit: (callback) => listen("pty:exit", callback),

  // Terminal simples (usado quando o node-pty não está disponível)
  termRun: (command, cwd) => invoke("term:run", command, cwd),
  termKill: (id) => invoke("term:kill", id),
  termStdin: (id, text) => invoke("term:stdin", id, text),
  termCd: (cwd, target) => invoke("term:cd", cwd, target),
  onTermData: (callback) => listen("term:data", callback),
  onTermExit: (callback) => listen("term:exit", callback),

  // Janela
  onBeforeClose: (callback) => listen("app:before-close", callback),
  closeNow: () => invoke("app:close-now"),
});
