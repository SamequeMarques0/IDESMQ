// Caixa de diálogo com um campo de texto (usada para nomear arquivos e pastas).
// Devolve o texto digitado, ou null se o usuário cancelar.
export function promptText({ title, value = "", confirmLabel = "Ok", selectBase = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML =
      '<div class="dialog" role="dialog" aria-modal="true">' +
      '<div class="dialog-title"></div>' +
      '<input class="dialog-input" type="text" spellcheck="false" autocomplete="off" />' +
      '<div class="dialog-actions">' +
      '<button class="btn" type="button">Cancelar</button>' +
      '<button class="btn primary" type="button"></button>' +
      "</div></div>";

    const [cancelBtn, okBtn] = overlay.querySelectorAll(".btn");
    const input = overlay.querySelector(".dialog-input");
    overlay.querySelector(".dialog-title").textContent = title;
    okBtn.textContent = confirmLabel;
    input.value = value;

    const finish = (result) => {
      overlay.remove();
      previous?.focus?.();
      resolve(result);
    };

    okBtn.addEventListener("click", () => finish(input.value.trim() || null));
    cancelBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) finish(null);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(input.value.trim() || null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    });

    document.body.appendChild(overlay);
    input.focus();
    const dot = value.lastIndexOf(".");
    input.setSelectionRange(0, selectBase && dot > 0 ? dot : value.length); // seleciona só o nome, sem a extensão
  });
}
