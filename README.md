# SMQIDE

IDE leve e minimalista para desenvolvimento front end (HTML, CSS e JS).
Base: Electron + CodeMirror 6, tudo em JavaScript.

## O que tem

- **Arquivo**: Novo, Abrir arquivo, Abrir pasta, Salvar e Salvar como (primeiro botão da barra da direita)
- **Pasta lateral** com árvore de arquivos, abas e atualização automática quando algo muda na pasta
  - Botões para criar arquivo e pasta; **clique direito** para criar, renomear e excluir (vai para a lixeira)
- **Ir para arquivo** (Ctrl+P) e **Paleta de comandos** (Ctrl+Shift+P), com busca aproximada
- **Live Server** (barra da direita): serve a pasta em `127.0.0.1:5500` e abre uma **janela de pré-visualização do Electron**
  - A janela é atualizada direto pela IDE (não depende do navegador); F5 recarrega e **F12 abre o DevTools** da página
  - Para usar um navegador externo: paleta de comandos > "Live Server: Abrir no navegador"
  - **Atualizar ao digitar** (padrão): o navegador muda enquanto você edita, sem salvar
  - **Atualizar ao salvar**: o navegador muda só no Ctrl+S
  - CSS é trocado sem recarregar; HTML sem `<script>` é atualizado sem recarregar; o resto recarrega
  - A barra de status mostra quantos navegadores estão conectados
- **Pré-visualização dentro da IDE** (botão ao lado do ▶): painel lateral que acompanha o HTML aberto
- **Terminal completo** (xterm.js + node-pty) na barra inferior; o campo de comando envia linhas para ele
  - Sem node-pty, cai automaticamente num modo simples (um comando por vez)
- **Personalização**: 4 temas, 2 conjuntos de ícones (botão de paleta na barra da direita)
- **Atalhos e macros** (botão de teclado na barra da direita): atalhos que inserem um texto, útil para teclados sem
  algumas teclas. Já vêm configurados as aspas: `Alt+1` (`'`), `Alt+2` (`"`), `Alt+3` (par `''`) e `Alt+4` (par `""`).
  - Funcionam no editor, nos campos de texto e no terminal; dá para criar, editar e excluir
  - No texto de uma macro, `$|` marca onde o cursor fica (ou onde entra o texto selecionado). Ex.: `<div class="$|"></div>`
  - Uma aspa sozinha se comporta como ao digitar: com texto selecionado, envolve a seleção; antes de uma aspa igual, pula por cima dela

## Atalhos

| Atalho | Ação |
|---|---|
| Ctrl+N | Novo arquivo |
| Ctrl+O | Abrir arquivo |
| Ctrl+Shift+O | Abrir pasta |
| Ctrl+S / Ctrl+Shift+S | Salvar / Salvar como |
| Ctrl+W | Fechar aba |
| Ctrl+Tab | Próxima aba (com Shift, a anterior) |
| Ctrl+P | Ir para arquivo |
| Ctrl+Shift+P | Paleta de comandos |
| Ctrl+B | Mostrar ou ocultar a pasta lateral |
| Ctrl+` | Ir para o campo de terminal |

Com o foco dentro do terminal, os atalhos pertencem ao shell (Ctrl+W, Ctrl+B etc. não são capturados pela IDE).

## Se a tela abrir sem nenhuma ação

Isso acontece quando `src/` e `electron/` são de versões diferentes (por exemplo, depois de copiar só alguns arquivos).
A IDE agora continua funcionando e mostra um aviso no canto da janela dizendo o que está desatualizado.
A solução é sempre copiar as pastas `src/` e `electron/` **inteiras**. Para ver detalhes do erro, pressione F12 (modo `npm start`).

## Rodar

Requisito: Node.js 18+.

```bash
npm install
npm start
```

Durante o desenvolvimento, em outro terminal rode `npm run watch` (recompila a interface ao salvar)
e use F5 ou Ctrl+R na janela do app para recarregar. F12 abre o DevTools.

### Terminal completo (node-pty)

O `node-pty` é um módulo nativo e é instalado como opcional. Se o terminal mostrar o aviso
"Modo simples", rode:

```bash
npm run rebuild
```

Esse comando compila o módulo e exige as "Build Tools" do Visual Studio (carga "Desenvolvimento para desktop com C++").
Enquanto isso, o modo simples continua funcionando.

## Ícone do aplicativo

Os ícones ficam na pasta `assets/` (`32`, `64`, `128` e `256`, em `.png` e `.ico`, mais `256.icns` e os PNGs de `512` e `1024`). O desenho original (SVG) está em `assets/logo.svg`:

- Windows: `assets/256.ico` (janela, barra de tarefas, `.exe` e instalador)
- macOS: `assets/256.icns`
- Linux: PNGs de `assets/` (o script `npm run icons` monta `build/icons/32x32.png` etc.)

Os arquivos `.psd` e `.jpg` de `assets/` não entram no instalador.

## Gerar os instaladores

```bash
npm run dist:win     # Windows: instalador NSIS (.exe)
npm run dist:linux   # Linux: AppImage
npm run dist:mac     # macOS: .dmg
```

Os arquivos saem na pasta `release/`. Cada sistema deve ser empacotado no próprio sistema
(o `.dmg` só pode ser gerado em um Mac, e o `node-pty` é compilado para cada plataforma).

Para gerar os três de uma vez sem ter os três computadores, envie o projeto para o GitHub e rode a
ação **Instaladores** (aba Actions, ou crie uma tag `v0.3.0`): `.github/workflows/build.yml` gera
Windows, Linux e macOS e deixa os arquivos para baixar.

Observações:

- Para gerar também o pacote `.deb` no Linux, coloque seu e-mail em `author` (`"samequemarques <email>"`) e troque `"target": ["AppImage"]` por `["AppImage", "deb"]`.
- Sem assinatura de código, o Windows (SmartScreen) e o macOS (Gatekeeper) mostram um aviso na primeira abertura.
  O macOS gerado aqui não é assinado (`"identity": null`).
- O empacotamento não recompila o `node-pty` (`"npmRebuild": false`), então não exige o Visual Studio.
  O `node-pty` usa o binário pronto que vem no pacote (veja a pasta `node_modules/node-pty/prebuilds`).
  Se mesmo assim o app instalado abrir o terminal em "Modo simples", o binário não carregou: nesse caso instale as
  "Build Tools" do Visual Studio (carga "Desenvolvimento para desktop com C++") e remova a linha `npmRebuild`.
- No Windows, se aparecer um erro sobre "symbolic link" ao baixar as ferramentas do instalador, ative o
  Modo Desenvolvedor do Windows (Configurações > Para desenvolvedores) ou rode o terminal como administrador.

## Onde fica cada coisa

- `assets/`: ícones do aplicativo
- `scripts/prepare-icons.js`: prepara os ícones do Linux
- `electron/main.js`: janela, diálogos, arquivos, terminais e Live Server
- `electron/liveserver.js`: servidor HTTP local com atualização automática
- `electron/preload.js`: ponte segura entre a interface e o processo principal
- `src/index.html`, `src/style.css`: estrutura e visual
- `src/renderer.js`: abas, arquivos, menus, Live Server, pré-visualização e ligação entre as partes
- `src/editor.js`: editor (CodeMirror) e linguagens
- `src/tree.js`, `src/terminal.js`, `src/palette.js`, `src/modal.js`, `src/ui.js`: árvore, terminal, paleta, diálogos e menus
- `src/themes.js`: temas (basta copiar um bloco para criar outro)
- `src/icons.js`: ícones da interface e dos arquivos
