// Monta a pasta build/icons que o electron-builder usa no Linux (arquivos NxN.png),
// a partir dos PNGs da pasta assets (32.png, 64.png, 128.png, 256.png).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const target = path.join(root, "build", "icons");
fs.mkdirSync(target, { recursive: true });

let copied = 0;
for (const size of [32, 64, 128, 256]) {
  const source = path.join(root, "assets", `${size}.png`);
  if (!fs.existsSync(source)) {
    console.warn(`Aviso: assets/${size}.png não encontrado (ícone ${size}x${size} do Linux ficará de fora).`);
    continue;
  }
  fs.copyFileSync(source, path.join(target, `${size}x${size}.png`));
  copied++;
}

for (const required of ["256.ico", "256.icns", "256.png"]) {
  if (!fs.existsSync(path.join(root, "assets", required))) {
    console.warn(`Aviso: assets/${required} não encontrado.`);
  }
}
console.log(`Ícones preparados em build/icons (${copied} arquivos).`);
