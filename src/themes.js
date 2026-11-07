const make = (dark, o) => ({
  name: o.name,
  dark,
  vars: {
    "--bg": o.bg,
    "--bg-chrome": o.chrome,
    "--fg": o.fg,
    "--muted": o.muted,
    "--line": o.line,
    "--selection": o.selection,
    "--accent": o.accent,
    "--danger": o.danger,
    "--hover": dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    "--syn-comment": o.comment,
    "--syn-keyword": o.keyword,
    "--syn-string": o.string,
    "--syn-number": o.number,
    "--syn-tag": o.tag,
    "--syn-attr": o.attr,
    "--syn-func": o.func,
    "--syn-class": o.cls,
    "--syn-punct": o.punct,
    "--syn-link": o.link,
  },
});

// Para criar um tema novo, copie um bloco abaixo, mude o id e as cores.
export const THEMES = {
  grafite: make(true, {
    name: "Grafite", bg: "#1f2329", chrome: "#1a1d22", fg: "#c9d1d9", muted: "#6b7480", line: "#2a2f37",
    selection: "#34404f", accent: "#e6b455", danger: "#e06c75",
    comment: "#5c6673", keyword: "#d98fa8", string: "#a6c98a", number: "#e0a070", tag: "#7fb4e0",
    attr: "#e6c07b", func: "#8fc7c0", cls: "#e6c07b", punct: "#8a93a0", link: "#7fb4e0",
  }),
  mariana: make(true, {
    name: "Mariana", bg: "#303841", chrome: "#262d35", fg: "#d8dee9", muted: "#7c8896", line: "#3b4550",
    selection: "#4e5a65", accent: "#fac863", danger: "#ec5f66",
    comment: "#65737e", keyword: "#c594c5", string: "#99c794", number: "#f99157", tag: "#ec5f66",
    attr: "#fac863", func: "#6699cc", cls: "#fac863", punct: "#a7adba", link: "#6699cc",
  }),
  monokai: make(true, {
    name: "Monokai", bg: "#272822", chrome: "#1e1f1a", fg: "#f8f8f2", muted: "#8a8873", line: "#383930",
    selection: "#49483e", accent: "#a6e22e", danger: "#f92672",
    comment: "#75715e", keyword: "#f92672", string: "#e6db74", number: "#ae81ff", tag: "#f92672",
    attr: "#a6e22e", func: "#a6e22e", cls: "#66d9ef", punct: "#c4c4b8", link: "#66d9ef",
  }),
  claro: make(false, {
    name: "Claro", bg: "#fbfbfa", chrome: "#efefec", fg: "#2b2f36", muted: "#868c95", line: "#dcdcd7",
    selection: "#cfe0f5", accent: "#b9770e", danger: "#c0392b",
    comment: "#9aa0a8", keyword: "#b0457a", string: "#4f8a3c", number: "#b5651d", tag: "#2f6fb0",
    attr: "#8f6408", func: "#23787a", cls: "#8f6408", punct: "#6b7480", link: "#2f6fb0",
  }),
};

export const DEFAULT_THEME = "grafite";

export function applyTheme(id) {
  const theme = THEMES[id] ?? THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(name, value);
  root.style.colorScheme = theme.dark ? "dark" : "light";
  return theme;
}
