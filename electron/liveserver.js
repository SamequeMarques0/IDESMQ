const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wasm": "application/wasm",
};

// Funções que atualizam a página. Usadas pelo script injetado (navegador/painel) e,
// na janela de pré-visualização do Electron, executadas direto pela IDE (sem depender de conexão).
const CLIENT_FUNCTIONS =
  'function swapCss(){document.querySelectorAll(\'link[rel="stylesheet"]\').forEach(function(l){' +
  "var u=new URL(l.href);if(u.origin!==location.origin)return;" +
  'u.searchParams.set("_lr",Date.now());l.href=u.toString();});}' +
  "function patch(){" +
  'fetch(location.href,{cache:"no-store"}).then(function(r){return r.text();}).then(function(t){' +
  'var d=new DOMParser().parseFromString(t,"text/html");' +
  'if(d.querySelector("script:not([data-lr])")||document.querySelector("script:not([data-lr])")){location.reload();return;}' +
  "if(d.title)document.title=d.title;" +
  "if(document.head.innerHTML!==d.head.innerHTML)document.head.innerHTML=d.head.innerHTML;" +
  "document.body.className=d.body.className;" +
  'document.body.setAttribute("style",d.body.getAttribute("style")||"");' +
  "document.body.innerHTML=d.body.innerHTML;" +
  "}).catch(function(){location.reload();});}";

// Script injetado nas páginas HTML. Recebe do servidor:
//   "css"    -> troca só as folhas de estilo (sem recarregar)
//   "html"   -> atualiza o conteúdo da página sem recarregar (se houver <script>, recarrega)
//   "reload" -> recarrega a página
const SNIPPET =
  "<script data-lr>(function(){var lost=false;" +
  CLIENT_FUNCTIONS +
  "function connect(){" +
  'var es=new EventSource("/__livereload");' +
  "es.onopen=function(){if(lost)location.reload();};" +
  "es.onerror=function(){lost=true;};" +
  'es.onmessage=function(e){if(e.data==="css")swapCss();else if(e.data==="html")patch();else location.reload();};' +
  "}connect();})();</script>";

// A janela de pré-visualização do Electron se identifica no User-Agent e não recebe o script
const PREVIEW_UA = "SMQIDEPreview";

const IGNORED = /(^|[\\/])(node_modules|\.git)([\\/]|$)/;
const CASE_INSENSITIVE = process.platform === "win32" || process.platform === "darwin";

const keyOf = (p) => {
  const resolved = path.resolve(p);
  return CASE_INSENSITIVE ? resolved.toLowerCase() : resolved;
};

function kindFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".css") return "css";
  if (ext === ".html" || ext === ".htm") return "html";
  return "reload";
}

function inject(html, withClient = true) {
  if (!withClient) return html;
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, () => SNIPPET + "</body>")
    : html + SNIPPET;
}

function sendText(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

class LiveServer {
  constructor() {
    this.server = null;
    this.watcher = null;
    this.root = null;
    this.clients = new Set();
    this.changed = new Set();
    this.overlay = new Map(); // conteúdo ainda não salvo, enviado pela IDE enquanto o usuário digita
    this.handled = new Map(); // arquivos que a IDE já avisou (evita aviso duplicado do watcher)
    this.timer = null;
    this.heartbeat = null;
    this.onClients = null; // callback(quantidade de navegadores conectados)
    this.onBroadcast = null; // callback("css" | "html" | "reload")
  }

  get running() {
    return this.server !== null;
  }

  async start(root, firstPort = 5500) {
    await this.stop();
    this.root = path.resolve(root);
    const server = http.createServer((req, res) => this.handle(req, res));
    for (let port = firstPort; port < firstPort + 20; port++) {
      try {
        await listen(server, port);
        this.server = server;
        this.watch();
        this.heartbeat = setInterval(() => {
          for (const res of this.clients) res.write(": ping\n\n");
        }, 20000);
        return port;
      } catch (err) {
        if (err.code !== "EADDRINUSE") throw err;
      }
    }
    throw new Error(`Nenhuma porta livre entre ${firstPort} e ${firstPort + 19}.`);
  }

  insideRoot(file) {
    if (!this.root) return false;
    const rel = path.relative(this.root, path.resolve(file));
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  }

  broadcast(message) {
    for (const res of this.clients) res.write(`data: ${message}\n\n`);
    if (this.onBroadcast) this.onBroadcast(message); // a IDE usa isto para atualizar a janela de pré-visualização
  }

  notifyClients() {
    if (this.onClients) this.onClients(this.clients.size);
  }

  /* ---------- Avisos vindos da IDE ---------- */

  // Conteúdo digitado (ainda não salvo): o servidor passa a servir este texto no lugar do arquivo.
  push(file, text) {
    if (!this.server || !this.insideRoot(file)) return false;
    const key = keyOf(file);
    this.overlay.set(key, text);
    this.handled.set(key, Date.now());
    this.broadcast(kindFor(file));
    return true;
  }

  // O arquivo foi salvo pela IDE: avisa os navegadores sem depender do watcher do sistema.
  fileSaved(file, contents) {
    if (!this.server || !this.insideRoot(file)) return;
    const key = keyOf(file);
    const alreadyShown = this.overlay.get(key) === contents;
    this.overlay.delete(key);
    this.handled.set(key, Date.now());
    if (!alreadyShown) this.broadcast(kindFor(file));
  }

  // Alterações descartadas: volta a servir o arquivo do disco.
  clearOverlay(file) {
    if (this.overlay.delete(keyOf(file))) this.broadcast(kindFor(file));
  }

  /* ---------- Watcher (mudanças feitas fora da IDE) ---------- */

  watch() {
    const onChange = (_event, filename) => {
      if (!filename || IGNORED.test(String(filename))) return;
      const abs = path.join(this.root, String(filename));
      const handledAt = this.handled.get(keyOf(abs));
      if (handledAt && Date.now() - handledAt < 800) return;
      this.changed.add(abs);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), 80);
    };
    try {
      this.watcher = fs.watch(this.root, { recursive: true }, onChange);
    } catch {
      this.watcher = fs.watch(this.root, onChange); // sistemas sem suporte a watch recursivo
    }
    this.watcher.on("error", () => {});
  }

  flush() {
    const kinds = new Set([...this.changed].map(kindFor));
    this.changed.clear();
    if (kinds.size === 0) return;
    this.broadcast(kinds.size === 1 ? [...kinds][0] : "reload");
  }

  /* ---------- HTTP ---------- */

  async handle(req, res) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return sendText(res, 400, "Requisição inválida");
    }

    if (pathname === "/__livereload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 1000\n\n");
      this.clients.add(res);
      this.notifyClients();
      res.on("close", () => {
        this.clients.delete(res);
        this.notifyClients();
      });
      return;
    }

    let filePath = path.join(this.root, pathname);
    const rel = path.relative(this.root, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return sendText(res, 403, "Acesso negado");

    try {
      let stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        stat = await fs.promises.stat(filePath);
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || "application/octet-stream";
      const isHtml = ext === ".html" || ext === ".htm";

      const unsaved = this.overlay.get(keyOf(filePath));
      if (unsaved !== undefined || isHtml) {
        const text = unsaved !== undefined ? unsaved : await fs.promises.readFile(filePath, "utf8");
        const fromPreviewWindow = String(req.headers["user-agent"] || "").includes(PREVIEW_UA);
        const body = Buffer.from(isHtml ? inject(text, !fromPreviewWindow) : text, "utf8");
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache", "Content-Length": body.length });
        res.end(body);
      } else {
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache", "Content-Length": stat.size });
        const stream = fs.createReadStream(filePath);
        stream.on("error", () => res.destroy());
        stream.pipe(res);
      }
    } catch {
      sendText(res, 404, "Arquivo não encontrado");
    }
  }

  async stop() {
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.changed.clear();
    this.overlay.clear();
    this.handled.clear();
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const res of this.clients) res.end();
    this.clients.clear();
    if (this.server) {
      const server = this.server;
      this.server = null;
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve()));
    }
    this.notifyClients();
  }
}

module.exports = { LiveServer, CLIENT_FUNCTIONS, PREVIEW_UA };
