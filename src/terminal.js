import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const MAX_NODES = 3000;
const SIMPLE_NOTICE =
  "Modo simples: o terminal completo (node-pty) não carregou. " +
  "Rode `npm run rebuild` na pasta da IDE e reinicie para ativá-lo.\n\n";

/*
 * Terminal da barra inferior.
 * - Com node-pty: terminal completo (xterm.js), e o campo da barra envia comandos para ele.
 * - Sem node-pty: modo simples, que roda um comando por vez e mostra a saída.
 */
export async function createTerminal({ panel, out, xtermBox, input, promptEl, home, platform, onEscape }) {
  const api = window.api;
  const usePty = await api.ptyAvailable();

  let cwd = home;
  let open = false;
  const history = [];
  let historyIndex = 0;

  const folderLabel = () => cwd.split(/[\\/]/).filter(Boolean).pop() || cwd;

  /* ============ Modo completo (xterm.js + node-pty) ============ */

  function ptyMode() {
    let term = null;
    let fit = null;
    let ptyId = null;
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
      term?.write(data);
    });

    api.onPtyExit(({ id }) => {
      if (ignored.has(id) || (ptyId !== null && id !== ptyId)) return;
      ptyId = null;
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
        if (ptyId !== null) api.ptyWrite(ptyId, `${command}\r`);
      },
      running: () => false,
      interrupt: () => {
        if (ptyId !== null) api.ptyWrite(ptyId, "\x03");
      },
      clear: () => term?.clear(),
      toggle: () => setOpen(!open, true),
      setCwd(path) {
        if (path === cwd) return;
        cwd = path;
        if (ptyId !== null) {
          ignored.add(ptyId);
          api.ptyKill(ptyId);
          ptyId = null;
          term?.reset();
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
      print(data, stream === "err" ? "term-err" : "");
    });

    api.onTermExit(({ id, code, signal }) => {
      if (runningId !== null && id !== runningId) return;
      setRunning(null);
      if (signal) print("Processo interrompido.\n", "term-err");
      else if (code) print(`Processo encerrado com código ${code}.\n`, "term-err");
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
    setCwd: (path) => impl.setCwd(path),
    focus: () => input.focus(),
    toggle: () => impl.toggle(),
    refreshTheme: () => impl.refreshTheme(),
  };
}
