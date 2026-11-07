/*
 * Atalhos e macros: um atalho de teclado que insere um texto (por exemplo, aspas).
 * Os atalhos são guardados pela tecla física (event.code), então funcionam em qualquer layout de teclado.
 * No texto, "$|" marca onde o cursor fica (ou onde entra o texto selecionado).
 */

export const DEFAULT_MACROS = [
  { id: "aspas-simples", name: "Aspas simples", combo: "Alt+Digit1", text: "'" },
  { id: "aspas-duplas", name: "Aspas duplas", combo: "Alt+Digit2", text: '"' },
  { id: "par-aspas-simples", name: "Par de aspas simples", combo: "Alt+Digit3", text: "'$|'" },
  { id: "par-aspas-duplas", name: "Par de aspas duplas", combo: "Alt+Digit4", text: '"$|"' },
];

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight", "AltGraph", "OS",
]);

// Combinações que a IDE e o editor já usam: não podem ser redefinidas
const RESERVED = new Set();
for (const base of [
  "Ctrl+KeyS", "Ctrl+Shift+KeyS", "Ctrl+KeyO", "Ctrl+Shift+KeyO", "Ctrl+KeyN", "Ctrl+KeyW", "Ctrl+KeyB",
  "Ctrl+KeyP", "Ctrl+Shift+KeyP", "Ctrl+Backquote", "Ctrl+Tab", "Ctrl+Shift+Tab",
  "Ctrl+KeyC", "Ctrl+KeyV", "Ctrl+KeyX", "Ctrl+KeyZ", "Ctrl+KeyY", "Ctrl+Shift+KeyZ", "Ctrl+KeyA", "Ctrl+KeyF",
]) {
  RESERVED.add(base);
  RESERVED.add(base.replace("Ctrl", "Meta")); // no macOS é a tecla Cmd
}

export const uid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Converte um evento de teclado em "Ctrl+Alt+Shift+Meta+<tecla>". Retorna null se não servir como atalho.
export function eventToCombo(e) {
  if (!e.code || MODIFIER_CODES.has(e.code)) return null;
  const isFunctionKey = /^F\d{1,2}$/.test(e.code);
  if (!(e.ctrlKey || e.altKey || e.metaKey || isFunctionKey)) return null; // sem modificador atrapalharia a digitação
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(e.code);
  return parts.join("+");
}

const CODE_LABELS = {
  Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", IntlBackslash: "\\",
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Space: "Espaço",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};

function codeLabel(code) {
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  let m = code.match(/^Key([A-Z])$/);
  if (m) return m[1];
  m = code.match(/^Digit(\d)$/);
  if (m) return m[1];
  m = code.match(/^Numpad(.+)$/);
  if (m) return `Num ${m[1]}`;
  return code;
}

export function prettyCombo(combo, platform = "win32") {
  if (!combo) return "";
  return combo
    .split("+")
    .map((part) => {
      if (part === "Meta") return platform === "darwin" ? "Cmd" : "Win";
      if (part === "Ctrl" || part === "Alt" || part === "Shift") return part;
      return codeLabel(part);
    })
    .join("+");
}

export const isReserved = (combo) => RESERVED.has(combo);

// Resolve o "$|": devolve o texto final e onde ficam o cursor/seleção (from e to, relativos ao início do texto)
export function expandTemplate(template, selected = "") {
  const i = template.indexOf("$|");
  if (i < 0) return { text: template, from: template.length, to: template.length };
  const before = template.slice(0, i);
  const after = template.slice(i + 2).split("$|").join("");
  return {
    text: before + selected + after,
    from: before.length,
    to: before.length + selected.length,
  };
}

// Janela para criar ou editar um atalho. Devolve { id, name, combo, text } ou null se cancelar.
export function editMacro({ macro = null, macros, platform }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    let combo = macro?.combo ?? "";

    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML =
      '<div class="dialog macro-dialog" role="dialog" aria-modal="true">' +
      '<div class="dialog-title"></div>' +
      '<label class="field"><span>Nome</span>' +
      '<input class="dialog-input" data-field="name" type="text" spellcheck="false" autocomplete="off" placeholder="Ex.: Aspas duplas" /></label>' +
      '<label class="field"><span>Atalho</span>' +
      '<input class="dialog-input" data-recorder type="text" readonly placeholder="Clique aqui e pressione as teclas" /></label>' +
      '<label class="field"><span>Texto inserido</span>' +
      '<textarea class="dialog-input macro-text" rows="3" spellcheck="false"></textarea></label>' +
      '<div class="dialog-hint">Use <code>$|</code> para marcar onde o cursor fica (ou onde entra o texto selecionado).</div>' +
      '<div class="dialog-error" hidden></div>' +
      '<div class="dialog-actions">' +
      '<button class="btn" type="button" data-act="clear">Limpar atalho</button><span class="spacer"></span>' +
      '<button class="btn" type="button" data-act="cancel">Cancelar</button>' +
      '<button class="btn primary" type="button" data-act="save">Salvar</button>' +
      "</div></div>";

    const q = (selector) => overlay.querySelector(selector);
    const nameInput = q('[data-field="name"]');
    const recorder = q("[data-recorder]");
    const textArea = q("textarea");
    const errorBox = q(".dialog-error");

    q(".dialog-title").textContent = macro ? "Editar atalho" : "Novo atalho";
    nameInput.value = macro?.name ?? "";
    textArea.value = macro?.text ?? "";

    const showCombo = () => {
      recorder.value = combo ? prettyCombo(combo, platform) : "";
    };
    const showError = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = !message;
    };
    const finish = (result) => {
      overlay.remove();
      previous?.focus?.();
      resolve(result);
    };
    showCombo();

    // Campo "Atalho": grava a combinação pressionada
    recorder.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) return; // deixa sair do campo
      e.preventDefault();
      if (e.key === "Escape") return finish(null);
      const next = eventToCombo(e);
      if (next) {
        combo = next;
        showCombo();
        showError("");
      } else if (e.key === "Backspace" || e.key === "Delete") {
        combo = "";
        showCombo();
        showError("");
      } else if (!MODIFIER_CODES.has(e.code)) {
        showError("Use Ctrl, Alt ou Cmd junto com outra tecla.");
      }
    });

    const save = () => {
      const name = nameInput.value.trim();
      const text = textArea.value;
      if (!name) return showError("Dê um nome ao atalho.");
      if (!text) return showError("Digite o texto que será inserido.");
      if (combo) {
        if (isReserved(combo)) {
          return showError(`${prettyCombo(combo, platform)} já é usado pela IDE ou pelo editor. Escolha outra combinação.`);
        }
        const other = macros.find((m) => m.combo === combo && m.id !== macro?.id);
        if (other) return showError(`${prettyCombo(combo, platform)} já está em uso por "${other.name}".`);
      }
      finish({ id: macro?.id ?? uid(), name, combo, text });
    };

    q('[data-act="save"]').addEventListener("click", save);
    q('[data-act="cancel"]').addEventListener("click", () => finish(null));
    q('[data-act="clear"]').addEventListener("click", () => {
      combo = "";
      showCombo();
      showError("");
    });
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) finish(null);
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") finish(null);
      else if (e.key === "Enter" && e.target === nameInput) save();
    });

    document.body.appendChild(overlay);
    nameInput.focus();
    nameInput.select();
  });
}
