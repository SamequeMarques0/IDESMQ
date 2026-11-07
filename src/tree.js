import { ui, fileIcon, folderIcon } from "./icons.js";
import { api } from "./api.js";

const isUnder = (p, root) => p === root || p.startsWith(root + "\\") || p.startsWith(root + "/");

export function createTree({ container, getIconPack, onOpenFile, onContext }) {
  const expanded = new Set();
  let root = null;
  let activePath = null;
  let token = 0;

  function messageRow(text, depth) {
    const row = document.createElement("div");
    row.className = "tree-row tree-msg";
    row.style.paddingLeft = `${8 + depth * 14 + 18}px`;
    row.textContent = text;
    return row;
  }

  async function renderDir(dirPath, parent, depth) {
    let entries;
    try {
      entries = await api.readDir(dirPath);
    } catch {
      parent.appendChild(messageRow("Não foi possível ler esta pasta.", depth));
      return;
    }
    if (entries.length === 0 && depth > 0) parent.appendChild(messageRow("Pasta vazia", depth));

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "tree-row" + (entry.name.startsWith(".") || entry.name === "node_modules" ? " dim" : "");
      row.style.paddingLeft = `${8 + depth * 14}px`;
      row.dataset.path = entry.path;
      parent.appendChild(row);

      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext?.({ path: entry.path, isDir: entry.isDir, isRoot: false, x: e.clientX, y: e.clientY });
      });

      if (entry.isDir) {
        const kids = document.createElement("div");
        parent.appendChild(kids);
        let open = expanded.has(entry.path);

        const paint = () => {
          row.innerHTML =
            `<span class="chev${open ? " open" : ""}">${ui.chevron}</span>` +
            `<span class="ico">${folderIcon(open, getIconPack())}</span><span class="tree-name"></span>`;
          row.querySelector(".tree-name").textContent = entry.name;
        };
        paint();
        if (open) await renderDir(entry.path, kids, depth + 1);

        row.addEventListener("click", async () => {
          open = !open;
          paint();
          kids.replaceChildren();
          if (open) {
            expanded.add(entry.path);
            await renderDir(entry.path, kids, depth + 1);
          } else {
            expanded.delete(entry.path);
          }
        });
      } else {
        row.innerHTML =
          `<span class="chev"></span><span class="ico">${fileIcon(entry.name, getIconPack())}</span>` +
          `<span class="tree-name"></span>`;
        row.querySelector(".tree-name").textContent = entry.name;
        if (entry.path === activePath) row.classList.add("active");
        row.addEventListener("click", () => onOpenFile(entry.path));
      }
    }
  }

  async function render() {
    const mine = ++token;
    if (!root) {
      container.replaceChildren();
      return;
    }
    const fresh = document.createElement("div");
    await renderDir(root, fresh, 0);
    if (mine !== token) return; // uma atualização mais nova já está em andamento
    const scroll = container.scrollTop;
    container.replaceChildren(fresh);
    container.scrollTop = scroll;
  }

  // Clique direito no espaço vazio da árvore = menu da pasta raiz
  container.addEventListener("contextmenu", (e) => {
    if (!root || e.defaultPrevented) return;
    e.preventDefault();
    onContext?.({ path: root, isDir: true, isRoot: true, x: e.clientX, y: e.clientY });
  });

  return {
    setRoot(path) {
      root = path;
      expanded.clear();
      return render();
    },
    refresh: render,
    getRoot: () => root,
    expand(path) {
      expanded.add(path);
    },
    // Depois de renomear uma pasta, mantém aberto o que estava aberto
    renamePaths(from, to) {
      const next = [...expanded].map((p) => (isUnder(p, from) ? to + p.slice(from.length) : p));
      expanded.clear();
      next.forEach((p) => expanded.add(p));
      if (activePath && isUnder(activePath, from)) activePath = to + activePath.slice(from.length);
    },
    setActive(path) {
      activePath = path ?? null;
      container.querySelectorAll(".tree-row.active").forEach((r) => r.classList.remove("active"));
      if (!activePath) return;
      for (const row of container.querySelectorAll(".tree-row")) {
        if (row.dataset.path === activePath) {
          row.classList.add("active");
          break;
        }
      }
    },
  };
}
