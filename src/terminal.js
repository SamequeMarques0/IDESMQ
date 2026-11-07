import { Terminal } from "@xterm/xterm";
import { api } from "./api.js";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

<<<<<<< HEAD
// Sequências de controle (cores, cursor, título da janela) que não devem aparecer como texto
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
=======
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
const MAX_NODES = 3000;
const SIMPLE_NOTICE =
  "Modo simples: o terminal completo (node-pty) não carregou. " +
  "Rode `npm run rebuild` na pasta da IDE e reinicie para ativá-lo.\n\n";

<<<<<<< HEAD
/* ---------- Leitura da saída: porcentagem e última linha ---------- */

// Procura porcentagens ("45%", "100% | electron") e a última linha útil de um trecho da saída
export function parseProgress(text) {
  const clean = text.replace(ANSI, "");
  let percent = null;
  for (const m of clean.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)) {
    const value = parseFloat(m[1].replace(",", "."));
    if (value >= 0 && value <= 100) percent = value;
  }
  const lines = clean.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const last = lines.length
    ? lines[lines.length - 1]
        .replace(/[=#█▓▒░■>\-]{4,}/g, "") // desenho da barra de progresso
        .replace(/\[\s*\]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 120)
    : "";
  return { percent, line: last || null };
}

// A linha onde está o cursor parece um prompt de shell (comando terminou e o terminal espera outro)?
export function isPromptText(text) {
  if (text.length < 2) return false;
  if (/^(PS )?[A-Za-z]:[\\/].*>$/.test(text)) return true; // cmd.exe e PowerShell
  if (/^[#=\-\s>█▓▒░■]+$/.test(text)) return false; // barra de progresso
  return /[$#❯»]$/.test(text); // bash, zsh e similares
}

/* ---------- Indicador de atividade (barra de progresso + status) ---------- */

function createActivity({ progress, fill, status, stopBtn, onChange, onStop }) {
  const pctEl = document.createElement("span");
  pctEl.className = "term-pct";
  const timeEl = document.createElement("span");
  timeEl.className = "term-time";
  const lastEl = document.createElement("span");
  lastEl.className = "term-last";
  status.replaceChildren(pctEl, timeEl, lastEl);
  stopBtn.addEventListener("click", () => onStop());

  let busy = false;
  let startedAt = 0;
  let percent = null;
  let percentAt = 0;
  let lastLine = "";
  let ticker = null;
  let hideTimer = null;
  let queued = false;

  const elapsed = () => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function render() {
    queued = false;
    if (!busy) return;
    const fresh = percent !== null && Date.now() - percentAt < 4000; // porcentagem recente = barra com valor
    progress.hidden = false;
    progress.classList.toggle("indeterminate", !fresh);
    fill.style.width = fresh ? `${percent}%` : "";
    status.hidden = false;
    status.className = "term-status";
    pctEl.textContent = fresh ? `${Math.round(percent)}%` : "";
    timeEl.textContent = `Executando ${elapsed()}`;
    lastEl.textContent = lastLine;
  }

  return {
    isBusy: () => busy,
    start() {
      if (busy) return;
      busy = true;
      startedAt = Date.now();
      percent = null;
      lastLine = "";
      clearTimeout(hideTimer);
      clearInterval(ticker);
      ticker = setInterval(render, 1000);
      stopBtn.hidden = false;
      onChange(true);
      render();
    },
    feed(text) {
      if (!busy) return;
      const { percent: p, line } = parseProgress(text);
      if (p !== null) {
        percent = p;
        percentAt = Date.now();
      }
      if (line) lastLine = line;
      if (!queued) {
        queued = true;
        setTimeout(render, 120);
      }
    },
    finish({ failed = false, detail = "" } = {}) {
      if (!busy) return;
      const time = elapsed();
      busy = false;
      clearInterval(ticker);
      progress.hidden = true;
      stopBtn.hidden = true;
      status.hidden = false;
      status.className = `term-status ${failed ? "failed" : "done"}`;
      pctEl.textContent = "";
      lastEl.textContent = "";
      timeEl.textContent = `${failed ? "Falhou" : "Concluído"} em ${time}${detail ? ` (${detail})` : ""}`;
      onChange(false);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!busy) status.hidden = true;
      }, 5000);
    },
  };
}

=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
/*
 * Terminal da barra inferior.
 * - Com node-pty: terminal completo (xterm.js), e o campo da barra envia comandos para ele.
 * - Sem node-pty: modo simples, que roda um comando por vez e mostra a saída.
 */
<<<<<<< HEAD
export async function createTerminal({
  panel, out, xtermBox, input, promptEl, home, platform,
  progress, progressFill, status, stopBtn, onEscape, onBusyChange,
}) {
=======
export async function createTerminal({ panel, out, xtermBox, input, promptEl, home, platform, onEscape }) {
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
  const usePty = await api.ptyAvailable();

  let cwd = home;
  let open = false;
  const history = [];
  let historyIndex = 0;

  const folderLabel = () => cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;

<<<<<<< HEAD
  const activity = createActivity({
    progress,
    fill: progressFill,
    status,
    stopBtn,
    onChange: (busy) => onBusyChange?.(busy),
    onStop: () => impl.interrupt(),
  });

=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
  /* ============ Modo completo (xterm.js + node-pty) ============ */

  function ptyMode() {
    let term = null;
    let fit = null;
    let ptyId = null;
<<<<<<< HEAD
    let startTimer = null;
    let doneTimer = null;
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    const ignored = new Set(); // sessões encerradas por nós (ao trocar de pasta)

    const termTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const v = (name) => css.getPropertyValue(name).trim();
      return { background: v("--bg"), foreground: v("--fg"), cursor: v("--accent"), selectionBackground: v("--selection") };
    };

    const safeFit = () => {
      try {
        fit.fit();
      } catch {}
    };

<<<<<<< HEAD
    // Texto da linha do cursor (juntando linhas quebradas) e se o cursor está no fim dela
    function cursorLine() {
      if (!term) return null;
      const buf = term.buffer.active;
      let y = buf.baseY + buf.cursorY;
      let line = buf.getLine(y);
      if (!line) return null;
      const last = line.translateToString(true).trimEnd();
      let text = line.translateToString(true);
      while (line.isWrapped && y > 0) {
        y--;
        line = buf.getLine(y);
        text = line.translateToString(false) + text;
      }
      return { text: text.trimEnd(), atEnd: buf.cursorX >= last.length };
    }

    const looksLikePrompt = () => {
      const line = cursorLine();
      return Boolean(line && line.atEnd && isPromptText(line.text));
    };

    // Depois de um Enter: se o terminal não voltou ao prompt, há um comando em andamento
    function armStart() {
      clearTimeout(startTimer);
      startTimer = setTimeout(() => {
        if (!activity.isBusy() && ptyId !== null && !looksLikePrompt()) activity.start();
      }, 350);
    }

    // Quando a saída silencia e o cursor está num prompt, o comando terminou
    function scheduleDoneCheck() {
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => {
        if (activity.isBusy() && looksLikePrompt()) activity.finish();
      }, 250);
    }

=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    function ensureTerm() {
      if (term) return;
      term = new Terminal({
        fontFamily: '"JetBrains Mono", "Cascadia Code", "SF Mono", Menlo, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.25,
        cursorBlink: true,
        scrollback: 5000,
        minimumContrastRatio: 4.5,
        theme: termTheme(),
      });
      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(xtermBox);

      // Ctrl+C copia quando há texto selecionado; sem seleção, interrompe o processo como de costume
      term.attachCustomKeyEventHandler((e) => {
        if (e.type === "keydown" && e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "c" && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          term.clearSelection();
          return false;
        }
        return true;
      });

      term.onData((data) => {
        if (ptyId !== null) api.ptyWrite(ptyId, data);
<<<<<<< HEAD
        if (data.includes("\r")) armStart(); // Enter digitado direto no terminal
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
      });
      term.onResize(({ cols, rows }) => {
        if (ptyId !== null) api.ptyResize(ptyId, cols, rows);
      });
      new ResizeObserver(() => {
        if (open) safeFit();
      }).observe(xtermBox);
    }

    async function ensureSession() {
      ensureTerm();
      if (ptyId !== null) return true;
      safeFit();
      try {
        ptyId = await api.ptyCreate(cwd, term.cols, term.rows);
        return true;
      } catch (err) {
        const message = String(err?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
        term.write(`\r\nNão foi possível iniciar o terminal: ${message}\r\n`);
        return false;
      }
    }

    api.onPtyData(({ id, data }) => {
      if (ignored.has(id) || (ptyId !== null && id !== ptyId)) return;
<<<<<<< HEAD
      activity.feed(data);
      term?.write(data, () => {
        if (activity.isBusy()) scheduleDoneCheck();
      });
=======
      term?.write(data);
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    });

    api.onPtyExit(({ id }) => {
      if (ignored.has(id) || (ptyId !== null && id !== ptyId)) return;
      ptyId = null;
<<<<<<< HEAD
      activity.finish();
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
      term?.write("\r\n[sessão encerrada. Envie um comando para iniciar outra]\r\n");
    });

    async function setOpen(value, focus = false) {
      open = value;
      xtermBox.hidden = !value;
      panel.classList.toggle("open", value);
      if (!value) return;
      ensureTerm();
      await ensureSession();
      requestAnimationFrame(() => {
        safeFit();
        if (focus) term.focus();
      });
    }

    promptEl.textContent = "$";

    return {
      async submit() {
        const command = input.value;
        input.value = "";
        if (command.trim()) {
          history.push(command.trim());
          historyIndex = history.length;
        }
        await setOpen(true, false);
<<<<<<< HEAD
        if (ptyId !== null) {
          api.ptyWrite(ptyId, `${command}\r`);
          armStart();
        }
=======
        if (ptyId !== null) api.ptyWrite(ptyId, `${command}\r`);
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
      },
      running: () => false,
      interrupt: () => {
        if (ptyId !== null) api.ptyWrite(ptyId, "\x03");
      },
      clear: () => term?.clear(),
      typeText: (text) => term?.paste(text),
      toggle: () => setOpen(!open, true),
      setCwd(path) {
        if (path === cwd) return;
        cwd = path;
        if (ptyId !== null) {
          ignored.add(ptyId);
          api.ptyKill(ptyId);
          ptyId = null;
          term?.reset();
<<<<<<< HEAD
          activity.finish();
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
        }
      },
      refreshTheme() {
        if (term) term.options.theme = termTheme();
      },
    };
  }

  /* ============ Modo simples (um comando por vez) ============ */

  function simpleMode() {
    let runningId = null;
    let noticed = false;

    const updatePrompt = () => {
      promptEl.textContent = `${folderLabel()} $`;
    };

    function setOpen(value) {
      open = value;
      out.hidden = !value;
      panel.classList.toggle("open", value);
      if (value) {
        if (!noticed) {
          noticed = true;
          print(SIMPLE_NOTICE, "term-cmd");
        }
        out.scrollTop = out.scrollHeight;
      }
    }

    function print(text, cls = "") {
      const clean = text.replace(ANSI, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!clean) return;
      const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
      const span = document.createElement("span");
      if (cls) span.className = cls;
      span.textContent = clean;
      out.appendChild(span);
      while (out.childNodes.length > MAX_NODES) out.removeChild(out.firstChild);
      if (atBottom) out.scrollTop = out.scrollHeight;
    }

    function setRunning(id) {
      runningId = id;
      input.placeholder =
        id === null
          ? "Digite um comando e pressione Enter"
          : "Em execução. Enter envia texto ao processo, Ctrl+C interrompe";
    }

    async function goTo(target) {
      try {
        cwd = await api.termCd(cwd, target);
        updatePrompt();
      } catch {
        print(`cd: pasta não encontrada: ${target}\n`, "term-err");
      }
    }

    async function changeDir(arg) {
      let target = arg.trim().replace(/^["']|["']$/g, "");
      if (!target) {
        if (platform === "win32") print(`${cwd}\n`);
        else await goTo(home);
        return;
      }
      if (target === "~" || target.startsWith("~/") || target.startsWith("~\\")) target = home + target.slice(1);
      await goTo(target);
    }

    api.onTermData(({ id, stream, data }) => {
      if (runningId !== null && id !== runningId) return;
<<<<<<< HEAD
      activity.feed(data);
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
      print(data, stream === "err" ? "term-err" : "");
    });

    api.onTermExit(({ id, code, signal }) => {
      if (runningId !== null && id !== runningId) return;
      setRunning(null);
      if (signal) print("Processo interrompido.\n", "term-err");
      else if (code) print(`Processo encerrado com código ${code}.\n`, "term-err");
<<<<<<< HEAD
      activity.finish({ failed: Boolean(signal || code), detail: signal ? "interrompido" : code ? `código ${code}` : "" });
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    });

    updatePrompt();

    return {
      async submit() {
        const text = input.value;
        if (runningId !== null) {
          // Há um processo rodando: o texto vai para a entrada dele
          print(`${text}\n`, "term-in");
          api.termStdin(runningId, `${text}\n`);
          input.value = "";
          return;
        }
        const command = text.trim();
        if (!command) return;
        input.value = "";
        history.push(command);
        historyIndex = history.length;

        setOpen(true);
        print(`${folderLabel()} $ ${command}\n`, "term-cmd");

        if (command === "clear" || command === "cls") {
          out.textContent = "";
          return;
        }
        const cd = command.match(/^cd\b\s*(?:\/d\s+)?(.*)$/i);
        if (cd) {
          await changeDir(cd[1]);
          return;
        }
        setRunning(await api.termRun(command, cwd));
<<<<<<< HEAD
        activity.start();
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
      },
      running: () => runningId !== null,
      interrupt: () => {
        if (runningId !== null) api.termKill(runningId);
      },
      clear: () => {
        out.textContent = "";
      },
      toggle() {
        setOpen(!open);
        if (open) input.focus();
      },
      setCwd(path) {
        cwd = path;
        updatePrompt();
      },
      refreshTheme() {},
      typeText() {},
    };
  }

  const impl = usePty ? ptyMode() : simpleMode();

  /* ============ Campo de comando (comum aos dois modos) ============ */

  input.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (e.key === "Enter") {
      e.preventDefault();
      impl.submit();
    } else if (e.key === "ArrowUp" && !impl.running()) {
      e.preventDefault();
      if (historyIndex > 0) input.value = history[--historyIndex];
    } else if (e.key === "ArrowDown" && !impl.running()) {
      e.preventDefault();
      historyIndex = Math.min(historyIndex + 1, history.length);
      input.value = history[historyIndex] ?? "";
    } else if (e.ctrlKey && key === "c" && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      impl.interrupt();
    } else if (e.ctrlKey && key === "l") {
      e.preventDefault();
      impl.clear();
    } else if (e.key === "Escape") {
      onEscape?.();
    }
  });

  return {
    isPty: usePty,
<<<<<<< HEAD
    isBusy: () => activity.isBusy(),
=======
>>>>>>> 59cd7c52025fd43fb035406738230164d3448db3
    setCwd: (path) => impl.setCwd(path),
    focus: () => input.focus(),
    toggle: () => impl.toggle(),
    refreshTheme: () => impl.refreshTheme(),
    typeText: (text) => impl.typeText(text),
  };
}
