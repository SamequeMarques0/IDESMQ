const MAX_RESULTS = 60;

// Pontua uma busca "aproximada": as letras precisam aparecer na ordem, não necessariamente juntas.
// Retorna -1 se não casar.
function fuzzy(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] !== q[qi]) continue;
    score += i === last + 1 ? 5 : 1; // letras seguidas valem mais
    if (i === 0 || "/\\-_. ".includes(t[i - 1])) score += 3; // início de palavra também
    last = i;
    qi++;
  }
  return qi === q.length ? score - t.length * 0.01 : -1;
}

function scoreItem(query, item) {
  const byName = item.name ? fuzzy(query, item.name) : -1;
  const byText = fuzzy(query, item.search ?? item.label);
  return Math.max(byName >= 0 ? byName + 10 : -1, byText);
}

// items: [{ label, detail?, hint?, name?, search?, run }]
export function openPalette({ placeholder, items }) {
  const previous = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML =
    '<div class="palette">' +
    '<input class="palette-input" type="text" spellcheck="false" autocomplete="off" />' +
    '<div class="palette-list"></div></div>';

  const input = overlay.querySelector(".palette-input");
  const list = overlay.querySelector(".palette-list");
  input.placeholder = placeholder;

  let results = items.slice(0, MAX_RESULTS);
  let selected = 0;

  const close = () => {
    overlay.remove();
    previous?.focus?.();
  };
  const run = (item) => {
    close();
    item.run();
  };

  function markSelected() {
    [...list.children].forEach((el, i) => el.classList.toggle("selected", i === selected));
    list.children[selected]?.scrollIntoView({ block: "nearest" });
  }

  function render() {
    list.replaceChildren();
    if (results.length === 0) {
      const empty = document.createElement("div");
      empty.className = "palette-empty";
      empty.textContent = "Nenhum resultado";
      list.appendChild(empty);
      return;
    }
    results.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "palette-item" + (i === selected ? " selected" : "");

      const label = document.createElement("span");
      label.textContent = item.label;
      const detail = document.createElement("span");
      detail.className = "palette-detail";
      detail.textContent = item.detail ?? "";
      row.append(label, detail);

      if (item.hint) {
        const hint = document.createElement("span");
        hint.className = "palette-hint";
        hint.textContent = item.hint;
        row.appendChild(hint);
      }
      row.addEventListener("mousemove", () => {
        if (selected !== i) {
          selected = i;
          markSelected();
        }
      });
      row.addEventListener("click", () => run(item));
      list.appendChild(row);
    });
  }

  function filter() {
    const query = input.value.trim();
    if (!query) {
      results = items.slice(0, MAX_RESULTS);
    } else {
      results = items
        .map((item, index) => ({ item, index, score: scoreItem(query, item) }))
        .filter((r) => r.score >= 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, MAX_RESULTS)
        .map((r) => r.item);
    }
    selected = 0;
    render();
  }

  input.addEventListener("input", filter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      selected = (selected + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      markSelected();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selected]) run(results[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  document.body.appendChild(overlay);
  render();
  input.focus();
}
