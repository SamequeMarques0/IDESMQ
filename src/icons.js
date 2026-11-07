const svg = (body, size = 16, extra = "") =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

/* ---------- Ícones da interface ---------- */

export const ui = {
  play: svg('<polygon points="7 4 20 12 7 20 7 4" fill="currentColor" stroke="none"/>', 18),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>', 18),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 18),
  terminal: svg('<polyline points="5 8 10 12 5 16"/><line x1="12" y1="17" x2="19" y2="17"/>', 18),
  palette: svg(
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/>' +
      '<circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7" r="1" fill="currentColor"/>' +
      '<circle cx="15" cy="7.5" r="1" fill="currentColor"/>',
    18
  ),
  close: svg('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>', 12),
  chevron: svg('<polyline points="9 6 15 12 9 18"/>', 12),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><polyline points="20 4 20 11 13 11"/>', 14),
  file: svg(
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/>' +
      '<line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>',
    18
  ),
  keyboard: svg(
    '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
      '<path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5"/>',
    18
  ),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 14),
  trash: svg(
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
      '<path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    14
  ),
  preview: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="14" y1="4" x2="14" y2="20"/>', 18),
  external: svg(
    '<path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    14
  ),
  filePlus: svg(
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/>' +
      '<line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>',
    14
  ),
  folderPlus: svg(
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
      '<line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/>',
    14
  ),
};

/* ---------- Ícones de arquivos e pastas ---------- */

const FILE = '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/>';
const FOLDER = '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>';
const FOLDER_OPEN = '<path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v2"/><path d="M5 19l2.5-8H22l-2.5 8z"/>';

// extensão: [cor, texto, tamanho da fonte]
const BADGES = {
  html: ["#e5603a", "&lt;&gt;", 8],
  htm: ["#e5603a", "&lt;&gt;", 8],
  css: ["#4a9be0", "#", 11],
  scss: ["#d46ba3", "#", 11],
  js: ["#e8c547", "JS", 9],
  mjs: ["#e8c547", "JS", 9],
  cjs: ["#e8c547", "JS", 9],
  jsx: ["#5fc9e8", "JSX", 7],
  ts: ["#4a8fd6", "TS", 9],
  tsx: ["#4a8fd6", "TSX", 7],
  json: ["#c9a85b", "{}", 10],
  md: ["#8aa0b5", "M", 10],
  svg: ["#f0a050", "S", 10],
  png: ["#7ab87a", "IMG", 7],
  jpg: ["#7ab87a", "IMG", 7],
  jpeg: ["#7ab87a", "IMG", 7],
  gif: ["#7ab87a", "IMG", 7],
  webp: ["#7ab87a", "IMG", 7],
};

export function fileIcon(name, pack) {
  if (pack === "colorido") {
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    const badge = BADGES[ext];
    if (badge) {
      const [color, label, size] = badge;
      return (
        `<svg class="ic" width="16" height="16" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="${color}"/>` +
        `<text x="12" y="${size > 9 ? 16.5 : 15.5}" text-anchor="middle" font-size="${size}" font-weight="700" ` +
        `font-family="system-ui,sans-serif" fill="#1a1d22">${label}</text></svg>`
      );
    }
  }
  return svg(FILE, 16, 'style="color:var(--muted)"');
}

export function folderIcon(open, pack) {
  const color = pack === "colorido" ? "#d9a441" : "var(--muted)";
  return svg(open ? FOLDER_OPEN : FOLDER, 16, `style="color:${color}"`);
}
