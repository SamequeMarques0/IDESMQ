let current = null;

export function closePopover() {
  if (!current) return;
  current.cleanup();
  current.pop.remove();
  current = null;
}

export const isPopoverOpenFor = (anchor) => current?.anchor === anchor;

// anchor: um elemento, ou um ponto { x, y } (usado no menu de clique direito)
// side: "below" (abaixo do botão), "left" (à esquerda do botão) ou "point" (no ponto)
export function openPopover(anchor, content, side = "below") {
  closePopover();
  const isElement = anchor instanceof Element;
  const pop = document.createElement("div");
  pop.className = "popover";
  pop.appendChild(content);
  document.body.appendChild(pop);

  const r = isElement
    ? anchor.getBoundingClientRect()
    : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };

  const maxLeft = window.innerWidth - pop.offsetWidth - 8;
  const maxTop = window.innerHeight - pop.offsetHeight - 8;
  if (side === "below") {
    pop.style.left = `${Math.max(8, Math.min(r.left, maxLeft))}px`;
    pop.style.top = `${r.bottom + 4}px`;
  } else if (side === "left") {
    pop.style.left = `${Math.max(8, r.left - pop.offsetWidth - 8)}px`;
    pop.style.top = `${Math.max(8, Math.min(r.top, maxTop))}px`;
  } else {
    pop.style.left = `${Math.max(8, Math.min(r.left, maxLeft))}px`;
    pop.style.top = `${Math.max(8, Math.min(r.top, maxTop))}px`;
  }

  const onDown = (e) => {
    if (!pop.contains(e.target) && !(isElement && anchor.contains(e.target))) closePopover();
  };
  const onKey = (e) => {
    if (e.key === "Escape") closePopover();
  };
  document.addEventListener("mousedown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  current = {
    anchor: isElement ? anchor : null,
    pop,
    cleanup: () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    },
  };
}

// Torna um elemento um divisor arrastável; onMove recebe o evento do mouse.
export function makeResizer(handle, cursor, onMove) {
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.body.classList.add("dragging");
    document.body.style.cursor = cursor;
    const up = () => {
      document.body.classList.remove("dragging");
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", up);
  });
}
