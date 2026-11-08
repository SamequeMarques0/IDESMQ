import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab, indentLess } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { openSearchPanel } from "@codemirror/search";
import { abbreviationAt, expandWithIndent } from "./emmet.js";

/* ---------- Aparência (as cores vêm das variáveis CSS do tema) ---------- */

function cmTheme(dark) {
  return EditorView.theme(
    {
      "&": { height: "100%", backgroundColor: "var(--bg)", color: "var(--fg)" },
      ".cm-scroller": { fontFamily: "var(--mono)", fontSize: "13.5px", lineHeight: "1.65" },
      ".cm-content": { caretColor: "var(--accent)", padding: "10px 0" },
      ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
      ".cm-gutters": { backgroundColor: "var(--bg)", color: "var(--muted)", border: "none" },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 14px 0 18px" },
      ".cm-activeLine": { backgroundColor: "var(--hover)" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--fg)" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "var(--selection)",
      },
      "&.cm-focused .cm-matchingBracket": { backgroundColor: "var(--selection)", outline: "none" },
      ".cm-placeholder": { color: "var(--muted)" },
      ".cm-panels": { backgroundColor: "var(--bg-chrome)", color: "var(--fg)" },
      ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--line)", borderBottom: "none" },
      ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--line)" },
      ".cm-textfield": { backgroundColor: "var(--bg)", border: "1px solid var(--line)", color: "var(--fg)" },
      ".cm-button": {
        backgroundImage: "none",
        backgroundColor: "var(--hover)",
        border: "1px solid var(--line)",
        color: "var(--fg)",
      },
      /* Barra de busca (Ctrl+F): uma linha, com os botões ao lado do campo */
      ".cm-panel.cm-search": {
        padding: "6px 34px 6px 8px",
        borderTop: "1px solid var(--line)",
        backgroundColor: "var(--bg-chrome)",
      },
      ".cm-panel.cm-search br": { display: "none" },
      ".cm-panel.cm-search .cm-textfield": {
        height: "26px",
        margin: "0 6px 0 0",
        padding: "0 8px",
        borderRadius: "5px",
        font: "inherit",
        fontSize: "12.5px",
        outline: "none",
      },
      ".cm-panel.cm-search .cm-textfield:focus": { borderColor: "var(--accent)" },
      ".cm-panel.cm-search [name=search]": { width: "200px", textTransform: "capitalize" },
      ".cm-panel.cm-search [name=replace]": { width: "160px", textTransform: "capitalize" },
      /* match case, regexp e by word: fora da barra */
      ".cm-panel.cm-search label:has(input[type=checkbox])": { display: "none" },
      ".cm-panel.cm-search .cm-button": {
        height: "26px",
        margin: "0 6px 0 0",
        padding: "0 10px",
        borderRadius: "5px",
        fontSize: "12px",
        cursor: "pointer",
      },
      ".cm-panel.cm-search .cm-button:hover": { backgroundColor: "var(--selection)" },
      ".cm-panel.cm-search [name=close]": {
        top: "8px",
        right: "8px",
        width: "20px",
        height: "20px",
        color: "var(--muted)",
        fontSize: "15px",
        lineHeight: "18px",
        cursor: "pointer",
        borderRadius: "4px",
      },
      ".cm-panel.cm-search [name=close]:hover": { color: "var(--fg)", backgroundColor: "var(--hover)" },
      ".cm-searchMatch": { backgroundColor: "rgba(230,180,85,0.25)", borderRadius: "2px" },
      ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(230,180,85,0.55)" },
      ".cm-tooltip": { backgroundColor: "var(--bg-chrome)", border: "1px solid var(--line)", color: "var(--fg)" },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--selection)", color: "var(--fg)" },
    },
    { dark }
  );
}

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--syn-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syn-number)" },
  { tag: [t.tagName, t.angleBracket], color: "var(--syn-tag)" },
  { tag: [t.attributeName, t.propertyName], color: "var(--syn-attr)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--syn-func)" },
  { tag: [t.className, t.typeName], color: "var(--syn-class)" },
  { tag: [t.punctuation, t.separator, t.bracket], color: "var(--syn-punct)" },
  { tag: t.link, color: "var(--syn-link)", textDecoration: "underline" },
]);

/* ---------- Linguagens ---------- */

const languages = {
  html: { name: "HTML", ext: () => html() },
  htm: { name: "HTML", ext: () => html() },
  svg: { name: "SVG", ext: () => html() },
  css: { name: "CSS", ext: () => css() },
  js: { name: "JavaScript", ext: () => javascript() },
  mjs: { name: "JavaScript", ext: () => javascript() },
  cjs: { name: "JavaScript", ext: () => javascript() },
  jsx: { name: "JavaScript (JSX)", ext: () => javascript({ jsx: true }) },
  ts: { name: "TypeScript", ext: () => javascript({ typescript: true }) },
  tsx: { name: "TypeScript (TSX)", ext: () => javascript({ typescript: true, jsx: true }) },
  json: { name: "JSON", ext: () => json() },
};

export function detectLanguage(path) {
  const ext = path?.split(".").pop()?.toLowerCase();
  return languages[ext] ?? { name: "Texto", ext: () => [] };
}

/* ---------- Estado do editor ---------- */

const themeCompartment = new Compartment();
const langCompartment = new Compartment();
let darkMode = true;

export function setEditorDark(dark) {
  darkMode = dark;
}

export const themeEffect = (dark) => themeCompartment.reconfigure(cmTheme(dark));
export const languageEffect = (path) => langCompartment.reconfigure(detectLanguage(path).ext());

/* ---------- Emmet: Tab expande a abreviação ---------- */

// O CodeMirror troca de foco quando um comando devolve false. Aqui devolvemos false
// só quando não há o que expandir (aí o Tab continua indentando ou saindo do editor).
export function expandAbbreviation(view) {
  const { state } = view;
  const ranges = state.selection.ranges;
  if (ranges.length !== 1) return false;
  const { from, to } = ranges[0];
  const line = state.doc.lineAt(from);
  const found = abbreviationAt(state.doc, from, line.from);
  if (!found) return false;
  const indent = /^[ \t]*/.exec(line.text)[0];
  const result = expandWithIndent(found.text, indent);
  if (!result) return false;
  view.dispatch({
    changes: { from: found.from, to, insert: result.text },
    selection: { anchor: found.from + result.cursor },
    scrollIntoView: true,
    userEvent: "input.complete",
  });
  return true;
}

// Shift+Tab: desindenta a linha, ou expande a abreviação quando ela está selecionada
function unindentOrExpand(view) {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  if (!range.empty && !/[\s]/.test(text)) {
    const result = expandWithIndent(text, /^[ \t]*/.exec(state.doc.lineAt(range.from).text)[0]);
    if (result) {
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: result.text },
        selection: { anchor: range.from + result.cursor },
        scrollIntoView: true,
        userEvent: "input.complete",
      });
      return true;
    }
  }
  return indentLess(view);
}

// Ctrl+Enter abre o que está selecionado por fora: div>.caixa -> <div class="caixa"></div>
function wrapSelection(view) {
  const { state } = view;
  const range = state.selection.main;
  if (range.empty) return false;
  const selected = state.sliceDoc(range.from, range.to);
  const tag = /^[a-zA-Z][\w-]*/.exec(selected.trim())?.[0] ?? "div";
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  view.dispatch({
    changes: [
      { from: range.from, insert: open },
      { from: range.to, insert: close },
    ],
    selection: { anchor: range.from + open.length, head: range.to + open.length },
    scrollIntoView: true,
    userEvent: "input.complete",
  });
  return true;
}

const emmetKeymap = keymap.of([
  { key: "Tab", run: expandAbbreviation },
  { key: "Shift-Tab", run: unindentOrExpand },
  { key: "Ctrl-Enter", run: wrapSelection },
]);

// Os textos da barra de busca (o CodeMirror usa "Find", "Replace", "next"…)
const SEARCH_PHRASES = {
  Find: "Buscar",
  Replace: "Alterar",
  next: "Próximo",
  previous: "Anterior",
  all: "Todos",
  replace: "Alterar",
  "replace all": "Alterar todos",
  close: "Fechar",
};
const searchPhrases = EditorState.phrases.of(SEARCH_PHRASES);

// Coloca a primeira letra maiúscula no que foi digitado nos campos de busca e de alteração
export function capitalizeFields(view) {
  const fields = view.dom.querySelectorAll('.cm-search input[name="search"], .cm-search input[name="replace"]');
  for (const field of fields) {
    const value = field.value;
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
    if (value && capitalized !== value) field.value = capitalized;
  }
}

const searchKeymap = keymap.of([
  { key: "Mod-f", run: (view) => (openSearchPanel(view), capitalizeFields(view), true) },
]);

export function makeState(text, path, onUpdate) {
  return EditorState.create({
    doc: text,
    extensions: [
      basicSetup,
      emmetKeymap, // antes do indentWithTab: o Tab expande a abreviação e, sem abreviação, indenta
      keymap.of([indentWithTab]),
      themeCompartment.of(cmTheme(darkMode)),
      syntaxHighlighting(highlight),
      langCompartment.of(detectLanguage(path).ext()),
      searchPhrases,
      searchKeymap,
      placeholder("Ctrl+O abre um arquivo. Ctrl+Shift+O abre uma pasta."),
      EditorView.updateListener.of(onUpdate),
    ],
  });
}
