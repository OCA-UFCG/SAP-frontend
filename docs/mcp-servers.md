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

## `contentful` — consultar e corrigir o conteúdo da plataforma

Quase todo "bug de frontend" aqui é conteúdo: um período que falta no `panelLayer`,
um `imageData` que não passa na validação, um índice de teste publicado que aparece
no beta. Hoje, responder a cada uma dessas perguntas significa escrever um `.mjs`
avulso com o token de gestão. Com o servidor MCP oficial do Contentful, o agente
consulta o content model e as entradas direto.

Como está configurado:

- `tools/mcp/contentful-mcp.sh` sobe o [`@contentful/mcp-server`][cf] oficial.
- As credenciais vêm do `.env`/`.env.local` que o projeto já usa. O script traduz os
  nomes daqui (`CONTENTFUL_MANAGEMENT_TOKEN`, `CONTENTFUL_SPACE_ID` ou
  `NEXT_PUBLIC_CONTENTFUL_SPACE_ID`, `CONTENTFUL_ENVIRONMENT`) para os que o servidor
  espera. Nenhum segredo entra no `.mcp.json`, que é versionado.
- O `.env` não é carregado com `source`: ele tem valores multilinha (a chave da
  service account do GEE) que quebram o shell. O script lê só as variáveis do
  Contentful.
- `MAX_BULK_SIZE` fica em 5 (o padrão do servidor é 10) para limitar o estrago de um
  publish ou delete em lote disparado por engano. Ajustável em
  `SAP_MCP_CONTENTFUL_MAX_BULK`.

### Cuidado: esse token escreve em produção

O token de gestão do Contentful não tem modo somente-leitura, e o ambiente padrão é
o `master` — o mesmo conteúdo que a plataforma serve. O servidor expõe ferramentas
de criar, publicar e apagar entradas e content types.

Duas proteções valem a pena, e nenhuma delas cabe neste repositório porque
`/.claude/` é ignorado pelo Git. Configure no seu `~/.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "mcp__contentful__delete_entry",
      "mcp__contentful__delete_asset",
      "mcp__contentful__delete_content_type",
      "mcp__contentful__delete_environment",
      "mcp__contentful__delete_locale"
    ]
  }
}
```

O resto continua valendo como sempre: escrita em massa é trabalho do pipeline em
`tools/drive-contentful-pipeline`, com dry-run antes, e não de uma sequência de
chamadas do agente.

[cf]: https://github.com/contentful/contentful-mcp-server
