/*
 * Emmet (subconjunto): escreve uma abreviação e pressiona Tab para expandir.
 *
 *   html5 + Tab          -> estrutura completa do HTML5
 *   ! + Tab              -> o mesmo (atalho curto do html5)
 *   !!! + Tab            -> <!doctype html>
 *   div + Tab            -> <div></div>
 *   p>a + Tab            -> <p><a href=""></a></p>
 *   ul>li*3 + Tab        -> três <li>
 *   a{texto} + Tab       -> <a href="">texto</a>
 *   .caixa#topo + Tab    -> <div class="caixa" id="topo"></div>
 *   button:btn + Tab     -> <button class="btn" type="button"></button>
 *
 * O Tab do CodeMirror só troca de foco quando o comando devolve `false`,
 * então quem escreve fora da abreviação (indentação normal) continua com o Tab de sempre.
 */

export const HTML5 = [
  "<!DOCTYPE html>",
  '<html lang="pt-BR">',
  "<head>",
  '  <meta charset="UTF-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  "  <title>$|</title>",
  "</head>",
  "<body>",
  "  ",
  "</body>",
  "</html>",
].join("\n");

const SNIPPETS = {
  html5: HTML5,
  "!": HTML5,
  html: HTML5,
  "!!!": "<!DOCTYPE html>$|",
  doctype: "<!DOCTYPE html>$|",
};

// Atributos que o Emmet coloca por padrão
const DEFAULT_ATTRS = {
  a: [["href", ""]],
  img: [["src", ""], ["alt", ""]],
  iframe: [["src", ""]],
  script: [["src", ""]],
  link: [["rel", "stylesheet"], ["href", ""]],
  input: [["type", "text"]],
  form: [["action", ""]],
};

// `nome:atalho` -> tag, classe extra e atributos (só o essencial)
const ALIASES = {
  btn: { tag: "button", cls: "btn", attrs: [["type", "button"]] },
  button: { tag: "button", attrs: [["type", "button"]] },
  submit: { tag: "button", cls: "btn", attrs: [["type", "submit"]] },
  reset: { tag: "button", cls: "btn", attrs: [["type", "reset"]] },
  text: { attrs: [["type", "text"]] },
  css: { attrs: [["rel", "stylesheet"]] },
  src: { attrs: [["src", ""]] },
};

// Elementos vazios (sem fechamento)
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);

// Elementos em linha: não recebem uma quebra de linha antes do conteúdo
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "cite", "code", "data", "dfn", "em", "i", "kbd", "mark", "q", "rp", "rt",
  "ruby", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var",
]);

// <html> e <head> ficam com um atributo por linha, como no Emmet
const WRAPPED = new Set(["html", "head"]);

// O que pode aparecer numa abreviação (para não transformar texto comum em HTML)
const ABBREVIATION = /^(!+|[a-zA-Z][\w-]*(:[\w-]+)?|[.#][\w-]+)([.#][\w-]+)*(\{[^}]*\})?(\[[^\]\n]*\])?(\*\d{1,3})?([>+^][\s\S]*)?$/;

/* ---------- Parser ---------- */

function parse(source) {
  let i = 0;
  const fail = () => {
    throw new Error("abreviação inválida");
  };
  const readWhile = (re) => {
    const m = re.exec(source.slice(i));
    if (!m) fail();
    i += m[0].length;
    return m[0];
  };

  function readModifiers(node) {
    for (;;) {
      const c = source[i];
      if (c === "#") {
        i++;
        node.id = readWhile(/^[\w-]+/);
      } else if (c === ".") {
        i++;
        node.classes.push(readWhile(/^[\w-]+/));
      } else if (c === "{") {
        i++;
        const end = source.indexOf("}", i);
        if (end < 0) fail();
        node.text = source.slice(i, end);
        i = end + 1;
      } else if (c === "[") {
        i++;
        const end = source.indexOf("]", i);
        if (end < 0) fail();
        for (const part of source.slice(i, end).split(/\s+/).filter(Boolean)) {
          const eq = part.indexOf("=");
          if (eq < 0) node.attrs.push([part, ""]);
          else node.attrs.push([part.slice(0, eq), part.slice(eq + 1).replace(/^["']|["']$/g, "")]);
        }
        i = end + 1;
      } else if (c === "*") {
        i++;
        node.repeat = Math.min(Number(readWhile(/^\d{1,3}/)), 100);
      } else {
        return node;
      }
    }
  }

  function parseTerm() {
    const node = { tag: null, id: null, classes: [], text: null, attrs: [], repeat: 1, children: [] };
    if (/^[a-zA-Z]/.test(source[i] ?? "")) node.tag = readWhile(/^[a-zA-Z][\w-]*/);
    if (source[i] === ":") {
      i++;
      const name = readWhile(/^[\w-]+/);
      const alias = ALIASES[name];
      if (alias) {
        node.tag = alias.tag ?? node.tag;
        if (alias.cls) node.classes.push(alias.cls);
        node.attrs.push(...(alias.attrs ?? []));
      } else {
        node.attrs.push([name, ""]); // atributo solto, como no Emmet
      }
    }
    return readModifiers(node);
  }

  function parseExpression() {
    let current = parseTerm();
    const root = current;
    while (i < source.length) {
      const c = source[i];
      if (c === ">") {
        i++;
        const child = parseTerm();
        current.children.push(child);
        current = child;
      } else if (c === "+") {
        i++;
        current = parseTerm();
      } else {
        fail();
      }
    }
    return root;
  }

  const root = parseExpression();
  if (i < source.length) fail();
  return root;
}

/* ---------- Renderização ---------- */

const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s) => escapeText(s).replace(/"/g, "&quot;");
const attrText = ([name, value]) => (value === "" ? name : `${name}="${escapeAttr(value)}"`);

function attrsOf(node) {
  const attrs = [];
  if (node.id) attrs.push(["id", node.id]);
  if (node.classes.length) attrs.push(["class", [...new Set(node.classes)].join(" ")]);
  const seen = new Set(attrs.map(([k]) => k));
  for (const [name, value] of [...(DEFAULT_ATTRS[node.tag] ?? []), ...node.attrs]) {
    if (seen.has(name)) continue;
    seen.add(name);
    attrs.push([name, value]);
  }
  return attrs;
}

function renderAttrs(node, indent) {
  const attrs = attrsOf(node);
  if (attrs.length === 0) return "";
  if (WRAPPED.has(node.tag) && attrs.length > 1) {
    return attrs.map((attr) => `\n${indent}  ${attrText(attr)}`).join("");
  }
  return ` ${attrs.map(attrText).join(" ")}`;
}

function render(node, indent = "") {
  const tag = node.tag ?? "div";
  const open = `${indent}<${tag}${renderAttrs(node, indent)}>`;
  if (VOID.has(tag)) return open;

  const close = `</${tag}>`;
  const parts = [];
  if (node.text !== null) parts.push(escapeText(node.text));
  for (const child of node.children) parts.push(render(child, `${indent}  `));

  if (parts.length === 0) return `${open}${close}`;
  const body = parts.join("\n");
  if (node.children.length === 0) {
    // só texto: em linha fica na mesma linha; bloco ganha uma linha indentada
    return INLINE.has(tag) ? `${open}${body}${close}` : `${open}\n${indent}  ${body}\n${indent}${close}`;
  }
  return `${open}\n${body}\n${indent}${close}`;
}

/* ---------- API ---------- */

const isAbbreviation = (text) => text.length > 0 && text.length <= 120 && ABBREVIATION.test(text);

// Onde a abreviação começa: do cursor para trás até um espaço, aspas ou quebra de linha
export function abbreviationAt(doc, head, lineStart) {
  let start = Math.max(head, lineStart);
  const floor = Math.min(start, lineStart);
  while (start > floor) {
    const ch = doc.sliceString(start - 1, start);
    if (/[\s"'`]/.test(ch)) break;
    start--;
  }
  const text = doc.sliceString(start, head);
  return text ? { from: start, to: head, text } : null;
}

// Devolve { text, cursor } (cursor = deslocamento dentro de text) ou null se não houver o que expandir.
export function expand(abbreviation) {
  const key = abbreviation.trim();
  const snippet = SNIPPETS[key] ?? SNIPPETS[key.toLowerCase()];
  if (snippet) {
    const i = snippet.indexOf("$|");
    return i < 0
      ? { text: snippet, cursor: snippet.length }
      : { text: snippet.slice(0, i) + snippet.slice(i + 2), cursor: i };
  }
  if (!isAbbreviation(key)) return null;
  let root;
  try {
    root = parse(key);
  } catch {
    return null;
  }
  const text = render(root);
  const end = text.indexOf("></");
  const cursor = end < 0 ? text.length : end + 1;
  return { text, cursor };
}

// Expansão com a indentação da linha: cada linha seguinte recebe o mesmo recuo da abreviação
export function expandWithIndent(abbreviation, indent) {
  const result = expand(abbreviation);
  if (!result) return null;
  return { text: result.text.split("\n").join(`\n${indent}`), cursor: result.cursor };
}
