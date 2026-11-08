// Diálogo "Novo arquivo / Nova pasta": uma linha de campo e dois botões, como no design da IDE.
// Devolve o texto digitado, ou null se o usuário cancelar.
export function promptText({ title, value = "", confirmLabel = "Ok", selectBase = false, placeholder = "" }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML =
      '<div class="dialog prompt-dialog" role="dialog" aria-modal="true">' +
      '<div class="dialog-title"></div>' +
      '<input class="dialog-input" type="text" spellcheck="false" autocomplete="off" />' +
      '<div class="dialog-actions">' +
      '<button class="btn" type="button" data-act="cancel">Cancelar</button>' +
      '<button class="btn primary" type="button" data-act="ok"></button>' +
      "</div></div>";

    const cancelBtn = overlay.querySelector('[data-act="cancel"]');
    const okBtn = overlay.querySelector('[data-act="ok"]');
    const input = overlay.querySelector(".dialog-input");
    overlay.querySelector(".dialog-title").textContent = title;
    okBtn.textContent = confirmLabel;
    input.value = value;
    input.placeholder = placeholder;

    const finish = (result) => {
      overlay.remove();
      previous?.focus?.();
      resolve(result);
    };

    const accept = () => finish(input.value.trim() || null);

    okBtn.addEventListener("click", accept);
    cancelBtn.addEventListener("click", () => finish(null));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) finish(null);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        accept();
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
