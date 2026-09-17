# Servidores MCP do projeto

O `.mcp.json` na raiz declara os servidores MCP que o time usa neste repositório.
Um servidor MCP é um processo local que dá ao agente (Claude Code, Cursor, Copilot)
um conjunto de ferramentas — aqui, ferramentas para ver o produto rodando e para
consultar as fontes de dado da plataforma.

Cada cliente pede confirmação antes de usar as ferramentas de um servidor novo.

## `chrome-devtools` — abrir o produto num Chrome de verdade

Serve para o agente conferir uma mudança no `npm run dev` em vez de só rodar teste:
navegar, clicar, ler o console, medir o tempo real de carregamento de `/platform` e
tirar print para anexar numa PR.

Como está configurado:

- `tools/mcp/chrome-devtools-mcp.sh` sobe o [`chrome-devtools-mcp`][cdt] oficial.
- O executável do Chrome é resolvido em tempo de execução: `CHROME_PATH`, depois um
  `google-chrome`/`chromium` do sistema, depois o Chromium que o Playwright já baixa
  para os testes (`npx playwright install --with-deps`). Em WSL normalmente não há
  Chrome instalado, e é o do Playwright que acaba sendo usado.
- Roda sem janela (`--headless`), porque o ambiente de dev costuma não ter display.
- O perfil do navegador é persistente, então o login na plataforma sobrevive entre
  sessões e o agente não precisa refazer o fluxo do Firebase toda vez.
- Estatísticas de uso do Google e o envio de URLs para a API do CrUX ficam desligados —
  as URLs visitadas aqui são `localhost` e ambientes internos.

Variáveis opcionais: `SAP_MCP_CHROME_HEADED=1` (abre a janela, se houver display),
`SAP_MCP_CHROME_ISOLATED=1` (perfil descartável, sem login salvo),
`SAP_MCP_CHROME_VIEWPORT=1920x1080`, `CHROME_PATH=/caminho/do/chrome`.

O servidor enxerga tudo que estiver aberto nesse Chrome, inclusive sessões logadas.
Use o perfil do MCP para a plataforma, não para navegação pessoal.

[cdt]: https://github.com/ChromeDevTools/chrome-devtools-mcp
