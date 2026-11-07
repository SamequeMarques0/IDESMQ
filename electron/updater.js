const { app, dialog, shell } = require("electron");
const pkg = require("../package.json");

// No macOS, a atualização automática exige o aplicativo assinado pela Apple.
// Sem assinatura, a IDE avisa da versão nova e abre a página de download. Mude para true se assinar o app.
const MAC_AUTO_INSTALL = false;

// Opcional: se o módulo não carregar, a IDE funciona normalmente, só sem atualização automática.
let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch {
  autoUpdater = null;
}

function releasesUrl() {
  const publish = pkg.build && pkg.build.publish;
  const cfg = Array.isArray(publish) ? publish[0] : publish;
  if (cfg && cfg.provider === "github") return `https://github.com/${cfg.owner}/${cfg.repo}/releases/latest`;
  return (cfg && cfg.url) || null;
}

// A IDE consegue se atualizar sozinha neste sistema?
function canSelfUpdate() {
  if (process.platform === "win32") return true;
  if (process.platform === "linux") return Boolean(process.env.APPIMAGE); // só o AppImage se atualiza
  return MAC_AUTO_INSTALL;
}

function formatNotes(notes) {
  if (!notes) return "";
  const text = Array.isArray(notes) ? notes.map((n) => (n && n.note) || "").join("\n") : String(notes);
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 600);
}

/*
 * Atualização automática:
 *   abre o app -> verifica -> pergunta -> baixa (com progresso) -> instala e reinicia.
 * Se houver alterações não salvas, pergunta antes de reiniciar.
 */
function createUpdater({ getWindow, send, hasUnsaved, prepareToQuit }) {
  const enabled = app.isPackaged && autoUpdater !== null; // em desenvolvimento (npm start) não há o que atualizar
  let manualCheck = false;
  let busy = false; // perguntando ou baixando
  let downloading = false;

  const win = () => {
    const w = getWindow();
    return w && !w.isDestroyed() ? w : null;
  };
  const box = (options) => {
    const w = win();
    return w ? dialog.showMessageBox(w, options) : dialog.showMessageBox(options);
  };
  const setProgress = (value) => {
    const w = win();
    if (w) w.setProgressBar(value); // barra de progresso no ícone da barra de tarefas
  };

  function failed(err) {
    const wasDownloading = downloading;
    downloading = false;
    busy = false;
    setProgress(-1);
    send("update:state", { phase: "error" });
    if (manualCheck || wasDownloading) {
      box({
        type: "error",
        title: "Atualização",
        message: wasDownloading ? "Não foi possível baixar a atualização." : "Não foi possível verificar atualizações.",
        detail: String((err && err.message) || err).slice(0, 400),
        buttons: ["Ok"],
      });
    }
  }

  async function installNow(version) {
    if (hasUnsaved()) {
      const { response } = await box({
        type: "warning",
        title: "Atualização pronta",
        message: "A atualização foi baixada, mas há alterações não salvas.",
        detail: "Salve seus arquivos e escolha \"Instalar ao fechar\", ou reinicie agora e descarte as alterações.",
        buttons: ["Instalar ao fechar o app", "Reiniciar agora (descartar alterações)"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response === 0) {
        busy = false;
        send("update:state", { phase: "pending", version }); // instala sozinha quando o app for fechado
        return;
      }
    }
    prepareToQuit();
    send("update:state", { phase: "installing", version });
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 800); // silencioso e reabre o app depois
  }

  if (enabled) {
    autoUpdater.autoDownload = false; // só baixa depois de o usuário aceitar
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", async (info) => {
      if (busy) return;
      busy = true;
      const selfUpdate = canSelfUpdate();
      const notes = formatNotes(info.releaseNotes);
      const { response } = await box({
        type: "info",
        title: "Atualização disponível",
        message: `Uma nova versão do SMQIDE está disponível: ${info.version}`,
        detail:
          `Você está na versão ${app.getVersion()}. ` +
          (selfUpdate
            ? "Deseja atualizar agora? A IDE baixa a atualização e reinicia sozinha."
            : "Deseja abrir a página de download?") +
          (notes ? `\n\nNovidades:\n${notes}` : ""),
        buttons: [selfUpdate ? "Atualizar agora" : "Abrir página de download", "Depois"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (response !== 0) {
        busy = false;
        return;
      }
      if (!selfUpdate) {
        const url = releasesUrl();
        if (url) shell.openExternal(url);
        busy = false;
        return;
      }
      downloading = true;
      send("update:state", { phase: "downloading", percent: 0, version: info.version });
      autoUpdater.downloadUpdate().catch(() => {}); // erros chegam pelo evento "error"
    });

    autoUpdater.on("update-not-available", () => {
      if (manualCheck) {
        box({
          type: "info",
          title: "Atualização",
          message: "Você já está usando a versão mais recente.",
          detail: `Versão ${app.getVersion()}.`,
          buttons: ["Ok"],
        });
      }
    });

    autoUpdater.on("download-progress", (p) => {
      const percent = Math.round(p.percent || 0);
      setProgress((p.percent || 0) / 100);
      send("update:state", { phase: "downloading", percent });
    });

    autoUpdater.on("update-downloaded", (info) => {
      downloading = false;
      setProgress(-1);
      send("update:state", { phase: "ready", version: info.version });
      installNow(info.version);
    });

    autoUpdater.on("error", failed);
  }

  async function check({ manual = false } = {}) {
    manualCheck = manual;
    if (!enabled) {
      if (manual) {
        await box({
          type: "info",
          title: "Atualização",
          message: "A atualização automática só funciona no aplicativo instalado.",
          detail: app.isPackaged
            ? "O módulo de atualização não foi encontrado nesta instalação."
            : "Você está executando em modo de desenvolvimento (npm start).",
          buttons: ["Ok"],
        });
      }
      return;
    }
    if (busy) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch {
      /* o evento "error" já trata e avisa (só quando a verificação foi pedida pelo usuário) */
    }
  }

  return {
    check,
    // Verificação silenciosa ao abrir o app: sem internet ou sem versão nova, não incomoda ninguém
    checkOnStartup() {
      if (enabled) setTimeout(() => check({ manual: false }), 4000);
    },
  };
}

module.exports = { createUpdater, canSelfUpdate, releasesUrl };
