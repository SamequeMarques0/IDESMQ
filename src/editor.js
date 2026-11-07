import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";

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
      ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--line)" },
      ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--line)" },
      ".cm-textfield": { backgroundColor: "var(--bg)", border: "1px solid var(--line)", color: "var(--fg)" },
      ".cm-button": {
        backgroundImage: "none",
        backgroundColor: "var(--hover)",
        border: "1px solid var(--line)",
        color: "var(--fg)",
      },
      ".cm-searchMatch": { backgroundColor: "rgba(230,180,85,0.25)" },
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

export function makeState(text, path, onUpdate) {
  return EditorState.create({
    doc: text,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      themeCompartment.of(cmTheme(darkMode)),
      syntaxHighlighting(highlight),
      langCompartment.of(detectLanguage(path).ext()),
      placeholder("Ctrl+O abre um arquivo. Ctrl+Shift+O abre uma pasta."),
      EditorView.updateListener.of(onUpdate),
    ],
  });
}
