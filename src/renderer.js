import { EditorView } from "@codemirror/view";
import { makeState, detectLanguage, languageEffect, themeEffect, setEditorDark } from "./editor.js";
import { THEMES, DEFAULT_THEME, applyTheme } from "./themes.js";
import { ui, fileIcon, folderIcon } from "./icons.js";
import { createTree } from "./tree.js";
import { createTerminal } from "./terminal.js";
import { openPopover, closePopover, isPopoverOpenFor, makeResizer } from "./ui.js";
import { promptText } from "./modal.js";
import { openPalette } from "./palette.js";
import { api, missingApi, hasBridge } from "./api.js";
import { showNotice } from "./diagnostics.js";
import { EditorSelection } from "@codemirror/state";
import { DEFAULT_MACROS, eventToCombo, prettyCombo, expandTemplate, editMacro } from "./macros.js";

const missingIds = new Set();

// Se algum elemento faltar no HTML (arquivo desatualizado), devolve um elemento solto: a IDE continua
// funcionando em vez de travar a tela inteira, e um aviso mostra o que está faltando.
const $ = (id) => {
  const el = document.getElementById(id);
  if (el) return el;
  missingIds.add(id);
  return document.createElement("div");
};

// Garante que os botões novos da barra da direita existam, mesmo com um index.html antigo
function ensureRailButton(id, title, beforeId, first = false) {
  if (document.getElementById(id)) return;
  const rail = document.getElementById("rail");
  if (!rail) return;
  const button = document.createElement("button");
  button.id = id;
  button.className = "rail-btn";
  button.title = title;
  const before = first ? rail.firstElementChild : beforeId ? document.getElementById(beforeId) : null;
  rail.insertBefore(button, before && before.parentNode === rail ? before : null);
}

const ICON_PACKS = [
  { id: "colorido", name: "Colorido" },
  { id: "minimalista", name: "Minimalista" },
];

const LIVE_MODES = [
  { id: "type", name: "Atualizar ao digitar" },
  { id: "save", name: "Atualizar ao salvar" },
];

/* ---------- Configurações salvas ---------- */

const SETTINGS_KEY = "frontide.settings";

function loadSettings() {
  const defaults = { theme: DEFAULT_THEME, icons: "colorido", folder: null, liveMode: "type", macros: null };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

const settings = loadSettings();
if (!THEMES[settings.theme]) settings.theme = DEFAULT_THEME;
if (!ICON_PACKS.some((p) => p.id === settings.icons)) settings.icons = "colorido";
if (!LIVE_MODES.some((m) => m.id === settings.liveMode)) settings.liveMode = "type";
if (Array.isArray(settings.macros)) {
  settings.macros = settings.macros.filter(
    (m) => m && typeof m.id === "string" && typeof m.name === "string" && typeof m.text === "string"
  );
  settings.macros.forEach((m) => {
    if (typeof m.combo !== "string") m.combo = "";
  });
} else {
  settings.macros = DEFAULT_MACROS.map((m) => ({ ...m })); // primeira vez: atalhos das aspas
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/* ---------- Utilidades ---------- */

const baseName = (p) => p.split(/[\\/]/).pop();
const normalize = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const sepOf = (p) => (p.includes("\\") ? "\\" : "/");
const joinPath = (dir, name) => dir.replace(/[\\/]+$/, "") + sepOf(dir) + name;
const isUnder = (p, root) => p === root || p.startsWith(root + "\\") || p.startsWith(root + "/");
const isHtml = (p) => /\.html?$/i.test(p);
const isLiveFile = (p) => /\.(html?|css|m?js|json|svg)$/i.test(p);
const cleanError = (err) =>
  String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

function dirName(p) {
  const d = p.replace(/[\\/][^\\/]*$/, "");
  return /^[A-Za-z]:$/.test(d) ? `${d}\\` : d || "/";
}

function relDir(rel) {
  const i = Math.max(rel.lastIndexOf("/"), rel.lastIndexOf("\\"));
  return i > 0 ? rel.slice(0, i) : "";
}

async function init() {
  if (!hasBridge) {
    showNotice("A ponte com o Electron (electron/preload.js) não carregou. Copie a pasta electron/ inteira do projeto e reinicie.");
  }
  ensureRailButton("btn-file", "Arquivo", null, true);
  ensureRailButton("btn-macros", "Atalhos e macros (aspas, textos…)", "btn-theme");

  const info = (await api.info()) ?? {
    platform: String(navigator.platform ?? "").toLowerCase().includes("mac") ? "darwin" : "win32",
    home: "",
  };
  const hint = (s) => (info.platform === "darwin" ? s.replace("Ctrl", "⌘") : s);

  const theme = applyTheme(settings.theme);
  setEditorDark(theme.dark);

  $("btn-file").innerHTML = ui.file;
  $("btn-live").innerHTML = ui.play;
  $("btn-preview").innerHTML = ui.preview;
  $("btn-folder").innerHTML = ui.folder;
  $("btn-terminal").innerHTML = ui.terminal;
  $("btn-theme").innerHTML = ui.palette;
  $("btn-macros").innerHTML = ui.keyboard;
  $("btn-refresh").innerHTML = ui.refresh;
  $("btn-new-file").innerHTML = ui.filePlus;
  $("btn-new-folder").innerHTML = ui.folderPlus;
  $("term-toggle").innerHTML = ui.chevron;
<<<<<<< HEAD
  $("term-stop").innerHTML = ui.stop;
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
  $("preview-reload").innerHTML = ui.refresh;
  $("preview-external").innerHTML = ui.external;
  $("preview-close").innerHTML = ui.close;

  let folder = null;
  let live = null; // { port, root } quando o Live Server está ligado
  let liveClients = 0;
  let previewOpen = false; // painel dentro da IDE
  let previewWinOpen = false; // janela de pré-visualização do Electron
  let fileCache = null; // lista de arquivos da pasta (busca rápida)

  const tree = createTree({
    container: $("tree"),
    getIconPack: () => settings.icons,
    onOpenFile: (path) => openPath(path),
    onContext: (target) => showTreeMenu(target),
  });

  const terminal = await createTerminal({
    panel: $("terminal"),
    out: $("term-out"),
    xtermBox: $("term-xterm"),
    input: $("term-input"),
    promptEl: $("term-prompt"),
    home: info.home,
    platform: info.platform,
<<<<<<< HEAD
    progress: $("term-progress"),
    progressFill: $("term-progress-fill"),
    status: $("term-status"),
    stopBtn: $("term-stop"),
    onBusyChange: (busy) => $("btn-terminal").classList.toggle("busy", busy),
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    onEscape: () => view.focus(),
  });

  /* ---------- Documentos e abas ---------- */

  const docs = [];
  let active = null;
  let nextId = 1;
  let untitledCount = 0;
  let loading = false;
  let pushTimer = null;

  function onEditorUpdate(u) {
    if (u.docChanged && !loading && active) {
      if (!active.dirty) {
        active.dirty = true;
        renderTabs();
      }
      scheduleLivePush(active);
    }
    if (u.selectionSet || u.docChanged) renderCursor(u.state);
  }

  function createDoc(text, path) {
    const d = { id: nextId++, path, dirty: false, untitled: path ? 0 : ++untitledCount, state: null };
    d.state = makeState(text, path, onEditorUpdate);
    docs.push(d);
    return d;
  }

  const docLabel = (d) =>
    d.path ? baseName(d.path) : d.untitled > 1 ? `sem título ${d.untitled}` : "sem título";

  function renderCursor(state) {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);
    $("status-pos").textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
  }

  function renderTabs() {
    $("tabs").replaceChildren(
      ...docs.map((d) => {
        const tab = document.createElement("div");
        tab.className = "tab" + (d === active ? " active" : "") + (d.dirty ? " dirty" : "");
        tab.title = d.path ?? "";

        const name = document.createElement("span");
        name.textContent = docLabel(d);

        const close = document.createElement("button");
        close.className = "tab-close";
        close.title = "Fechar (Ctrl+W)";
        close.innerHTML = ui.close;

        tab.append(name, close);
        tab.addEventListener("click", () => activate(d));
        tab.addEventListener("mousedown", (e) => {
          if (e.button === 1) {
            e.preventDefault();
            closeDoc(d);
          }
        });
        close.addEventListener("click", (e) => {
          e.stopPropagation();
          closeDoc(d);
        });
        return tab;
      })
    );
    $("tabs").querySelector(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const first = createDoc("", null);
  const view = new EditorView({ state: first.state, parent: $("editor") });

  function activate(d) {
    if (active && active !== d) active.state = view.state;
    active = d;
    loading = true;
    view.setState(d.state);
    view.dispatch({ effects: themeEffect(THEMES[settings.theme].dark) });
    loading = false;
    renderTabs();
    $("status-lang").textContent = detectLanguage(d.path).name;
    renderCursor(view.state);
    tree.setActive(d.path);
    if (previewOpen && d.path && isHtml(d.path)) loadPreview(false); // a pré-visualização acompanha o HTML aberto
    if (previewWinOpen && live && d.path && isHtml(d.path)) api.previewNavigate(liveUrlFor(d.path));
    view.focus();
  }

  function addFileDoc(path, text) {
    // a aba vazia do início é substituída pelo primeiro arquivo aberto
    if (active && !active.path && !active.dirty && view.state.doc.length === 0) {
      docs.splice(docs.indexOf(active), 1);
      active = null;
    }
    activate(createDoc(text, path));
  }

  // aba sem arquivo, sem alterações e sem texto
  const isPristine = (d) =>
    !d.path && !d.dirty && (d === active ? view.state.doc.length : d.state.doc.length) === 0;

  function forceCloseDoc(d) {
    const i = docs.indexOf(d);
    if (i < 0) return;
    docs.splice(i, 1);
    if (d.path && d.dirty && live) api.liveClear(d.path); // alterações descartadas: o navegador volta ao arquivo salvo
    if (docs.length === 0) {
      active = null;
      untitledCount = 0; // recomeça a numeração: volta a ser só "sem título"
      activate(createDoc("", null));
    } else if (d === active) {
      active = null;
      activate(docs[Math.min(i, docs.length - 1)]);
    } else {
      renderTabs();
    }
  }

  async function closeDoc(d) {
    if (!d) return;
    if (docs.length === 1 && isPristine(d)) return; // já é a aba vazia: não há nada para fechar
    if (d.dirty && !(await api.confirmDiscard(`"${docLabel(d)}" tem alterações não salvas. Descartar e fechar?`))) return;
    forceCloseDoc(d);
  }

  function cycleTab(step) {
    if (docs.length < 2) return;
    const i = docs.indexOf(active);
    activate(docs[(i + step + docs.length) % docs.length]);
  }

  /* ---------- Arquivos ---------- */

  function newFile() {
    if (active && isPristine(active)) {
      view.focus(); // já há uma aba vazia: reaproveita em vez de criar outra
      return;
    }
    activate(createDoc("", null));
  }

  async function openPath(path) {
    const existing = docs.find((d) => d.path === path);
    if (existing) return activate(existing);
    try {
      const { contents } = await api.readFile(path);
      addFileDoc(path, contents);
    } catch (err) {
      await api.showError("Erro ao abrir", `Não foi possível abrir o arquivo.\n${cleanError(err)}`);
    }
  }

  async function openFileDialog() {
    try {
      const result = await api.openFile();
      if (!result) return;
      const existing = docs.find((d) => d.path === result.path);
      if (existing) activate(existing);
      else addFileDoc(result.path, result.contents);
    } catch (err) {
      await api.showError("Erro ao abrir", `Não foi possível abrir o arquivo.\n${cleanError(err)}`);
    }
  }

  async function saveActive(forceDialog = false) {
    const d = active;
    const text = view.state.doc.toString();
    try {
      const savedPath = await api.saveFile(d.path, text, forceDialog);
      if (!savedPath) return;
      const pathChanged = savedPath !== d.path;
      d.path = savedPath;
      d.dirty = false;
      if (pathChanged) {
        if (d === active) view.dispatch({ effects: languageEffect(savedPath) });
        else d.state = d.state.update({ effects: languageEffect(savedPath) }).state;
        if (folder) tree.refresh();
      }
      if (d === active) {
        $("status-lang").textContent = detectLanguage(savedPath).name;
        tree.setActive(savedPath);
      }
      renderTabs();
    } catch (err) {
      await api.showError("Erro ao salvar", `Não foi possível salvar o arquivo.\n${cleanError(err)}`);
    }
  }

  /* ---------- Criar, renomear e excluir (árvore) ---------- */

  async function createEntry(dir, isDir) {
    const name = await promptText({
      title: isDir ? "Nova pasta" : "Novo arquivo",
      confirmLabel: "Criar",
    });
    if (!name) return;
    try {
      const target = await api.createItem(dir, name, isDir);
      tree.expand(dir);
      fileCache = null;
      await tree.refresh();
      if (!isDir) await openPath(target);
    } catch (err) {
      await api.showError("Não foi possível criar", cleanError(err));
    }
  }

  function remapDocs(from, to) {
    for (const d of docs) {
      if (!d.path || !isUnder(d.path, from)) continue;
      if (d.dirty && live) api.liveClear(d.path);
      d.path = to + d.path.slice(from.length);
      if (d === active) view.dispatch({ effects: languageEffect(d.path) });
      else d.state = d.state.update({ effects: languageEffect(d.path) }).state;
    }
    renderTabs();
    if (active) $("status-lang").textContent = detectLanguage(active.path).name;
  }

  async function renameEntry(path) {
    const oldName = baseName(path);
    const name = await promptText({ title: "Renomear", value: oldName, confirmLabel: "Renomear", selectBase: true });
    if (!name || name === oldName) return;
    try {
      const target = await api.renameItem(path, name);
      remapDocs(path, target);
      tree.renamePaths(path, target);
      fileCache = null;
      await tree.refresh();
      tree.setActive(active?.path);
    } catch (err) {
      await api.showError("Não foi possível renomear", cleanError(err));
    }
  }

  async function deleteEntry(path, isDir) {
    const affected = docs.filter((d) => d.path && isUnder(d.path, path));
    const unsaved = affected.some((d) => d.dirty);
    const detail = unsaved
      ? "Há alterações não salvas em arquivos abertos desta seleção. Elas serão perdidas."
      : isDir
        ? "A pasta e todo o conteúdo serão movidos."
        : "";
    if (!(await api.confirm(`Mover "${baseName(path)}" para a lixeira?`, detail, "Mover para a lixeira"))) return;
    try {
      await api.deleteItem(path);
    } catch (err) {
      await api.showError("Não foi possível excluir", cleanError(err));
      return;
    }
    affected.forEach(forceCloseDoc);
    fileCache = null;
    await tree.refresh();
  }

  function showTreeMenu({ path, isDir, isRoot, x, y }) {
    const dir = isDir ? path : dirName(path);
    const items = [
      { label: "Novo arquivo…", action: () => createEntry(dir, false) },
      { label: "Nova pasta…", action: () => createEntry(dir, true) },
    ];
    if (!isRoot) {
      items.push(
        "-",
        { label: "Renomear…", action: () => renameEntry(path) },
        { label: "Mover para a lixeira", danger: true, action: () => deleteEntry(path, isDir) }
      );
    }
    openPopover({ x, y }, buildMenu(items), "point");
  }

  /* ---------- Pasta lateral ---------- */

  async function setFolder(path) {
    if (live) await stopLive();
    folder = path;
    fileCache = null;
    settings.folder = path;
    saveSettings();
    $("folder-name").textContent = baseName(path) || path;
    $("folder-name").title = path;
    $("sidebar").hidden = false;
    terminal.setCwd(path);
    api.watchStart(path);
    await tree.setRoot(path);
    tree.setActive(active?.path);
  }

  async function openFolderDialog() {
    const path = await api.openFolder();
    if (path) await setFolder(path);
  }

  function toggleSidebar() {
    if (!folder) return openFolderDialog();
    $("sidebar").hidden = !$("sidebar").hidden;
  }

  api.onFolderChanged(() => {
    fileCache = null;
    if (folder) tree.refresh();
  });

  /* ---------- Live Server ---------- */

  function renderLive() {
    const on = live !== null;
    $("btn-live").innerHTML = on ? ui.stop : ui.play;
    $("btn-live").classList.toggle("on", on);
    $("btn-live").title = on ? `Parar Live Server (porta ${live.port})` : "Iniciar Live Server e abrir a janela de pré-visualização";
    $("status-live").hidden = !on;
    if (on) {
      const clients =
        liveClients === 0 ? "nenhuma página conectada" : liveClients === 1 ? "1 conectado" : `${liveClients} conectados`;
      $("status-live").textContent = `Live Server: porta ${live.port} (${clients})`;
    }
  }

  api.onPreviewState((open) => {
    previewWinOpen = open;
  });

  api.onLiveClients((count) => {
    liveClients = count;
    if (live) renderLive();
  });

  function liveRoot() {
    if (folder) return folder;
    if (active?.path) return dirName(active.path);
    return null;
  }

  function liveUrlFor(file) {
    let urlPath = "/";
    if (file && isHtml(file)) {
      const root = normalize(live.root);
      const f = normalize(file);
      if (f.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
        urlPath = "/" + f.slice(root.length + 1).split("/").map(encodeURIComponent).join("/");
      }
    }
    return `http://127.0.0.1:${live.port}${urlPath}`;
  }

  // Abre (ou traz para a frente) a janela de pré-visualização do Electron
  function openLiveUrl() {
    if (live) api.previewOpen(liveUrlFor(active?.path));
  }

  function openInBrowser() {
    if (live) api.openExternal(liveUrlFor(active?.path));
  }

  // Envia ao servidor o texto que está sendo digitado (ainda sem salvar)
  function scheduleLivePush(d) {
    if (!live || settings.liveMode !== "type" || !d.path || !isLiveFile(d.path)) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (live && d === active && d.dirty) api.livePush(d.path, view.state.doc.toString());
    }, 200);
  }

  function pushDirtyDocs() {
    if (!live || settings.liveMode !== "type") return;
    for (const d of docs) {
      if (d.dirty && d.path && isLiveFile(d.path)) {
        api.livePush(d.path, d === active ? view.state.doc.toString() : d.state.doc.toString());
      }
    }
  }

  function setLiveMode(mode) {
    settings.liveMode = mode;
    saveSettings();
    if (!live) return;
    if (mode === "type") pushDirtyDocs();
    else for (const d of docs) if (d.dirty && d.path) api.liveClear(d.path);
  }

  async function startLive({ openWindow = true } = {}) {
    const root = liveRoot();
    if (!root) {
      await api.showError("Live Server", "Abra uma pasta, ou salve um arquivo HTML, antes de iniciar o Live Server.");
      return false;
    }
    try {
      const { port } = await api.liveStart(root);
      live = { port, root };
      liveClients = 0;
      renderLive();
      pushDirtyDocs();
      if (openWindow) openLiveUrl();
      return true;
    } catch (err) {
      await api.showError("Live Server", `Não foi possível iniciar o servidor.\n${cleanError(err)}`);
      return false;
    }
  }

  async function stopLive() {
    closePreview();
    await api.liveStop();
    live = null;
    liveClients = 0;
    renderLive();
  }

  async function toggleLive() {
    if (live) await stopLive();
    else await startLive();
  }

  /* ---------- Pré-visualização dentro da IDE ---------- */

  function loadPreview(force) {
    const url = liveUrlFor(active?.path);
    const host = $("preview-body");
    let frame = host.querySelector("iframe");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.title = "Pré-visualização";
      host.replaceChildren(frame);
    } else if (!force && frame.dataset.url === url) {
      return;
    }
    frame.dataset.url = url;
    frame.src = url;
    $("preview-url").textContent = url.replace("http://", "");
  }

  function closePreview() {
    previewOpen = false;
    $("preview").hidden = true;
    $("preview-body").replaceChildren(); // descarta a página para ela deixar de contar como conectada
    $("btn-preview").classList.remove("on");
  }

  async function togglePreview() {
    if (previewOpen) return closePreview();
    if (!live && !(await startLive({ openWindow: false }))) return;
    previewOpen = true;
    $("preview").hidden = false;
    $("btn-preview").classList.add("on");
    loadPreview(true);
  }

  $("preview-reload").addEventListener("click", () => previewOpen && loadPreview(true));
  $("preview-external").addEventListener("click", () => {
    const url = $("preview-body").querySelector("iframe")?.dataset.url;
    if (url) api.openExternal(url);
  });
  $("preview-close").addEventListener("click", closePreview);

  /* ---------- Busca rápida e paleta de comandos ---------- */

  async function openQuickOpen() {
    if (!folder) {
      openPalette({
        placeholder: "Abra uma pasta para buscar arquivos",
        items: [{ label: "Abrir pasta…", hint: hint("Ctrl+Shift+O"), run: openFolderDialog }],
      });
      return;
    }
    if (!fileCache) fileCache = await api.listFiles(folder);
    const root = folder;
    openPalette({
      placeholder: "Buscar arquivo na pasta…",
      items: fileCache.map((rel) => ({
        name: baseName(rel),
        label: baseName(rel),
        detail: relDir(rel),
        search: rel,
        run: () => openPath(joinPath(root, rel)),
      })),
    });
  }

  function openCommandPalette() {
    const withFolder = (fn) => () => (folder ? fn() : openFolderDialog());
    const items = [
      { label: "Arquivo: Novo", hint: "Ctrl+N", run: newFile },
      { label: "Arquivo: Abrir arquivo…", hint: "Ctrl+O", run: openFileDialog },
      { label: "Arquivo: Abrir pasta…", hint: "Ctrl+Shift+O", run: openFolderDialog },
      { label: "Arquivo: Salvar", hint: "Ctrl+S", run: () => saveActive(false) },
      { label: "Arquivo: Salvar como…", hint: "Ctrl+Shift+S", run: () => saveActive(true) },
      { label: "Arquivo: Fechar aba", hint: "Ctrl+W", run: () => closeDoc(active) },
      { label: "Ir para arquivo…", hint: "Ctrl+P", run: openQuickOpen },
      { label: "Pasta: Novo arquivo na pasta aberta…", run: withFolder(() => createEntry(folder, false)) },
      { label: "Pasta: Nova pasta na pasta aberta…", run: withFolder(() => createEntry(folder, true)) },
      { label: "Pasta: Atualizar", run: withFolder(() => tree.refresh()) },
      { label: "Exibir: Alternar pasta lateral", hint: "Ctrl+B", run: toggleSidebar },
      { label: "Exibir: Alternar terminal", hint: "Ctrl+`", run: () => terminal.toggle() },
      { label: "Exibir: Alternar pré-visualização", run: togglePreview },
      { label: "Live Server: Iniciar ou parar", run: toggleLive },
      { label: "Live Server: Abrir janela de pré-visualização", run: openLiveUrl },
      { label: "Live Server: Abrir no navegador", run: openInBrowser },
      { label: "Live Server: Atualizar ao digitar", run: () => setLiveMode("type") },
      { label: "Live Server: Atualizar ao salvar", run: () => setLiveMode("save") },
      ...Object.entries(THEMES).map(([id, t]) => ({ label: `Tema: ${t.name}`, run: () => setTheme(id) })),
      ...ICON_PACKS.map((p) => ({ label: `Ícones: ${p.name}`, run: () => setIcons(p.id) })),
    ].map((item) => (item.hint ? { ...item, hint: hint(item.hint) } : item));
    const macroItems = [
      ...settings.macros.map((m) => ({
        label: `Macro: ${m.name}`,
        hint: m.combo ? prettyCombo(m.combo, info.platform) : undefined,
        run: () => runMacro(m),
      })),
      { label: "Macro: Novo atalho…", run: newMacroFlow },
    ];
    openPalette({ placeholder: "Digite um comando…", items: [...items, ...macroItems] });
  }

  /* ---------- Atalhos e macros ---------- */

  // Último campo de texto em que o usuário esteve (para o botão "inserir agora" saber onde escrever)
  let lastTextTarget = null;
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t.closest?.("[data-recorder]") || t.closest?.(".overlay")) return;
    if (t.closest?.(".cm-editor, .xterm") || t.matches?.("input, textarea")) lastTextTarget = t;
  });

  function insertIntoEditor(template) {
    const state = view.state;
    const main = state.selection.main;
    let effective = template;

    // Uma aspa sozinha se comporta como ao digitar: pula a aspa que já está à frente, ou envolve a seleção
    if (template.length === 1 && "\"'`".includes(template)) {
      if (state.selection.ranges.length === 1 && main.empty && state.sliceDoc(main.head, main.head + 1) === template) {
        view.dispatch({ selection: { anchor: main.head + 1 }, scrollIntoView: true });
        view.focus();
        return;
      }
      if (!main.empty) effective = `${template}$|${template}`;
    }

    const spec = state.changeByRange((range) => {
      const r = expandTemplate(effective, state.sliceDoc(range.from, range.to));
      return {
        changes: { from: range.from, to: range.to, insert: r.text },
        range: EditorSelection.range(range.from + r.from, range.from + r.to),
      };
    });
    view.dispatch(state.update(spec, { scrollIntoView: true, userEvent: "input.type" }));
    view.focus();
  }

  function insertIntoField(el, template) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const r = expandTemplate(template, el.value.slice(start, end));
    el.setRangeText(r.text, start, end, "end");
    el.setSelectionRange(start + r.from, start + r.to);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Insere o texto do atalho onde o cursor estiver: terminal, campo de texto ou editor
  function runMacro(macro, target = lastTextTarget) {
    const el = target?.isConnected ? target : null;
    if (el?.closest?.(".xterm")) {
      terminal.typeText(expandTemplate(macro.text, "").text);
      return;
    }
    if (el && el.matches?.("input, textarea") && !el.readOnly && !el.disabled) {
      insertIntoField(el, macro.text);
      return;
    }
    insertIntoEditor(macro.text);
  }

  async function newMacroFlow() {
    const created = await editMacro({ macros: settings.macros, platform: info.platform });
    if (created) {
      settings.macros.push(created);
      saveSettings();
    }
  }

  function openMacroMenu() {
    openPopover($("btn-macros"), buildMacroMenu(), "left");
  }

  function buildMacroMenu() {
    const box = document.createElement("div");
    box.className = "macro-menu";

    const title = document.createElement("div");
    title.className = "menu-title";
    title.textContent = settings.macros.length ? "Atalhos e macros (clique para inserir)" : "Nenhum atalho criado ainda";
    box.appendChild(title);

    for (const macro of settings.macros) {
      const row = document.createElement("div");
      row.className = "macro-row";

      const run = document.createElement("button");
      run.className = "menu-item macro-run";
      run.title = "Inserir agora";
      run.innerHTML = '<span class="macro-name"></span><kbd class="kbd-chip"></kbd>';
      run.querySelector(".macro-name").textContent = macro.name;
      run.querySelector("kbd").textContent = macro.combo ? prettyCombo(macro.combo, info.platform) : "sem atalho";
      run.addEventListener("click", () => {
        closePopover();
        runMacro(macro);
      });

      const edit = document.createElement("button");
      edit.className = "icon-btn";
      edit.title = "Editar";
      edit.innerHTML = ui.pencil;
      edit.addEventListener("click", async () => {
        closePopover();
        const updated = await editMacro({ macro, macros: settings.macros, platform: info.platform });
        if (updated) {
          settings.macros[settings.macros.findIndex((m) => m.id === macro.id)] = updated;
          saveSettings();
        }
        openMacroMenu();
      });

      const remove = document.createElement("button");
      remove.className = "icon-btn";
      remove.title = "Excluir";
      remove.innerHTML = ui.trash;
      remove.addEventListener("click", async () => {
        closePopover();
        if (await api.confirm(`Excluir o atalho "${macro.name}"?`, "", "Excluir")) {
          settings.macros = settings.macros.filter((m) => m.id !== macro.id);
          saveSettings();
        }
        openMacroMenu();
      });

      row.append(run, edit, remove);
      box.appendChild(row);
    }

    const sep = document.createElement("div");
    sep.className = "menu-sep";
    box.appendChild(sep);

    const add = document.createElement("button");
    add.className = "menu-item";
    add.innerHTML = "<span>Novo atalho…</span><kbd></kbd>";
    add.addEventListener("click", async () => {
      closePopover();
      await newMacroFlow();
      openMacroMenu();
    });
    box.appendChild(add);

    const restore = document.createElement("button");
    restore.className = "menu-item";
    restore.innerHTML = "<span>Restaurar atalhos padrão (aspas)</span><kbd></kbd>";
    restore.addEventListener("click", async () => {
      closePopover();
      if (await api.confirm("Restaurar os atalhos padrão?", "A lista atual será substituída pelos atalhos das aspas.", "Restaurar")) {
        settings.macros = DEFAULT_MACROS.map((m) => ({ ...m }));
        saveSettings();
      }
      openMacroMenu();
    });
    box.appendChild(restore);
    return box;
  }

  /* ---------- Menus ---------- */

  function buildMenu(items) {
    const box = document.createElement("div");
    for (const item of items) {
      if (item === "-") {
        const sep = document.createElement("div");
        sep.className = "menu-sep";
        box.appendChild(sep);
        continue;
      }
      const b = document.createElement("button");
      b.className = "menu-item" + (item.danger ? " danger" : "");
      b.innerHTML = "<span></span><kbd></kbd>";
      b.children[0].textContent = item.label;
      b.children[1].textContent = item.hint ? hint(item.hint) : "";
      b.addEventListener("click", () => {
        closePopover();
        item.action();
      });
      box.appendChild(b);
    }
    return box;
  }

  $("btn-file").addEventListener("click", (e) => {
    if (isPopoverOpenFor(e.currentTarget)) return closePopover();
    openPopover(
      e.currentTarget,
      buildMenu([
        { label: "Novo", hint: "Ctrl+N", action: newFile },
        { label: "Abrir arquivo…", hint: "Ctrl+O", action: openFileDialog },
        { label: "Abrir pasta…", hint: "Ctrl+Shift+O", action: openFolderDialog },
        "-",
        { label: "Salvar", hint: "Ctrl+S", action: () => saveActive(false) },
        { label: "Salvar como…", hint: "Ctrl+Shift+S", action: () => saveActive(true) },
        "-",
        { label: "Ir para arquivo…", hint: "Ctrl+P", action: openQuickOpen },
        { label: "Paleta de comandos…", hint: "Ctrl+Shift+P", action: openCommandPalette },
        "-",
        { label: "Fechar aba", hint: "Ctrl+W", action: () => closeDoc(active) },
      ]),
      "left"
    );
  });

  function setTheme(id) {
    settings.theme = id;
    saveSettings();
    const t = applyTheme(id);
    setEditorDark(t.dark);
    view.dispatch({ effects: themeEffect(t.dark) });
    terminal.refreshTheme();
  }

  function setIcons(id) {
    settings.icons = id;
    saveSettings();
    tree.refresh();
  }

  function buildPersonalize() {
    const box = document.createElement("div");

    const section = (title, items, getCurrent, onPick) => {
      const heading = document.createElement("div");
      heading.className = "menu-title";
      heading.textContent = title;
      box.appendChild(heading);

      const buttons = items.map((item) => {
        const b = document.createElement("button");
        b.className = "menu-item option" + (item.id === getCurrent() ? " selected" : "");
        b.innerHTML = `<span class="opt-left">${item.preview ?? ""}<span class="opt-name"></span></span><span class="opt-check">✓</span>`;
        b.querySelector(".opt-name").textContent = item.name;
        b.addEventListener("click", () => {
          onPick(item.id);
          buttons.forEach((x, i) => x.classList.toggle("selected", items[i].id === item.id));
        });
        box.appendChild(b);
        return b;
      });
    };

    const separator = () => {
      const sep = document.createElement("div");
      sep.className = "menu-sep";
      box.appendChild(sep);
    };

    section(
      "Tema",
      Object.entries(THEMES).map(([id, t]) => ({
        id,
        name: t.name,
        preview:
          `<span class="swatch" style="background:${t.vars["--bg"]};border-color:${t.vars["--line"]}">` +
          `<i style="background:${t.vars["--accent"]}"></i></span>`,
      })),
      () => settings.theme,
      setTheme
    );
    separator();
    section(
      "Ícones",
      ICON_PACKS.map((p) => ({
        ...p,
        preview: `<span class="icon-preview">${folderIcon(false, p.id)}${fileIcon("app.js", p.id)}</span>`,
      })),
      () => settings.icons,
      setIcons
    );
    separator();
    section("Live Server", LIVE_MODES, () => settings.liveMode, setLiveMode);
    return box;
  }

  $("btn-theme").addEventListener("click", (e) => {
    if (isPopoverOpenFor(e.currentTarget)) return closePopover();
    openPopover(e.currentTarget, buildPersonalize(), "left");
  });

  /* ---------- Ligações da interface ---------- */

  $("btn-live").addEventListener("click", toggleLive);
  $("btn-preview").addEventListener("click", togglePreview);
  $("btn-macros").addEventListener("click", (e) => {
    if (isPopoverOpenFor(e.currentTarget)) return closePopover();
    openMacroMenu();
  });
  $("status-live").addEventListener("click", openLiveUrl);
  $("btn-folder").addEventListener("click", toggleSidebar);
  $("btn-terminal").addEventListener("click", () => terminal.toggle());
  $("term-toggle").addEventListener("click", () => terminal.toggle());
  $("btn-refresh").addEventListener("click", () => tree.refresh());
  $("btn-new-file").addEventListener("click", () => folder && createEntry(folder, false));
  $("btn-new-folder").addEventListener("click", () => folder && createEntry(folder, true));

  makeResizer($("resizer-sidebar"), "col-resize", (e) => {
    const w = Math.min(520, Math.max(140, e.clientX));
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  });

  makeResizer($("resizer-term"), "row-resize", (e) => {
    // 24px da barra de status + 30px da linha de comando
    const h = Math.min(window.innerHeight * 0.7, Math.max(80, window.innerHeight - e.clientY - 54));
    document.documentElement.style.setProperty("--term-h", `${h}px`);
  });

  makeResizer($("resizer-preview"), "col-resize", (e) => {
    // 44px da barra da direita
    const w = Math.min(window.innerWidth * 0.7, Math.max(260, window.innerWidth - 44 - e.clientX));
    document.documentElement.style.setProperty("--preview-w", `${w}px`);
  });

  window.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (document.querySelector(".overlay")) return; // diálogo ou paleta aberta
    const key = e.key.toLowerCase();
    // Dentro do terminal, os atalhos pertencem ao shell (Ctrl+W, Ctrl+B etc.)
    if (e.target.closest?.(".xterm") && e.key !== "`") return;

    if (key === "s") { e.preventDefault(); saveActive(e.shiftKey); }
    else if (key === "o") { e.preventDefault(); if (e.shiftKey) openFolderDialog(); else openFileDialog(); }
    else if (key === "n") { e.preventDefault(); newFile(); }
    else if (key === "w") { e.preventDefault(); closeDoc(active); }
    else if (key === "b") { e.preventDefault(); toggleSidebar(); }
    else if (key === "p") { e.preventDefault(); if (e.shiftKey) openCommandPalette(); else openQuickOpen(); }
    else if (e.key === "`") { e.preventDefault(); terminal.focus(); }
    else if (e.key === "Tab" && e.ctrlKey) { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); }
  });

  // Atalhos de macro: captura antes do editor e do terminal, para funcionar em qualquer lugar
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.target.closest?.("[data-recorder]")) return; // gravando um atalho novo
      const combo = eventToCombo(e);
      if (!combo) return;
      const macro = settings.macros.find((m) => m.combo === combo);
      if (!macro) return;
      e.preventDefault();
      e.stopPropagation();
      runMacro(macro, e.target);
    },
    true
  );

  api.onBeforeClose(async () => {
    const hasUnsaved = docs.some((d) => d.dirty);
    if (!hasUnsaved || (await api.confirmDiscard("Há alterações não salvas. Sair mesmo assim?"))) api.closeNow();
  });

  /* ---------- Início ---------- */

  active = null;
  activate(first);

  if (settings.folder) {
    try {
      await api.readDir(settings.folder);
      await setFolder(settings.folder);
    } catch {
      settings.folder = null;
      saveSettings();
    }
  }

  reportMissing();
  setTimeout(reportMissing, 2000);
}

// Mostra o que está desatualizado (HTML ou preload de uma versão diferente da interface)
function reportMissing() {
  if (missingIds.size) {
    showNotice(
      `O arquivo src/index.html está desatualizado (faltam: ${[...missingIds].join(", ")}). Copie a pasta src/ inteira do projeto e reinicie.`
    );
  }
  if (missingApi.size) {
    showNotice(
      `Os arquivos da pasta electron/ estão desatualizados (faltam: ${[...missingApi].join(", ")}). Copie a pasta electron/ inteira do projeto e reinicie.`
    );
  }
}

window.addEventListener("error", (e) => showNotice(`Erro: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => showNotice(`Erro: ${e.reason?.message ?? e.reason}`));

init().catch((err) => {
  console.error(err);
  showNotice(`Erro ao iniciar a IDE: ${err?.message ?? err}. Pressione F12 para ver detalhes.`);
});
