// Aviso visível na janela (para a IDE nunca ficar "morta" sem explicar o motivo).
const lines = new Set();
let box = null;

function render() {
  const title = document.createElement("div");
  title.textContent = "Atenção";
  title.style.fontWeight = "600";
  title.style.marginBottom = "4px";

  const items = [...lines].map((text) => {
    const p = document.createElement("div");
    p.textContent = text;
    p.style.marginTop = "4px";
    return p;
  });

  const close = document.createElement("button");
  close.textContent = "Fechar";
  Object.assign(close.style, {
    marginTop: "8px", padding: "3px 10px", background: "transparent", color: "inherit",
    border: "1px solid currentColor", borderRadius: "4px", cursor: "pointer", font: "inherit",
  });
  close.addEventListener("click", () => {
    box.remove();
    box = null;
    lines.clear();
  });

  box.replaceChildren(title, ...items, close);
}

export function showNotice(text) {
  if (lines.has(text)) return;
  lines.add(text);
  if (!box) {
    box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed", right: "56px", bottom: "36px", zIndex: "200", maxWidth: "460px", padding: "10px 12px",
      background: "#3a1f24", color: "#f2c9cf", border: "1px solid #e06c75", borderRadius: "6px",
      font: "12px/1.5 system-ui, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    });
    document.body.appendChild(box);
  }
  render();
}
