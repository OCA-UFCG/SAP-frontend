# Protótipo de chatbot do SEDES

Um chatbot que responde, em português, perguntas sobre os dados do SEDES. Roda
de dois jeitos, com as mesmas ferramentas e o mesmo prompt:

- **No computador**, sem chave de API: a página de chat (`npm run chat`) ou o
  terminal (`./conversar.sh`) usam o Claude Code de quem roda.
- **No beta, para a equipe** (`/chat/` no beta, com login do SEDES): a mesma
  página fala direto com a API da Anthropic. Veja "No beta", abaixo.

O "bot" é o Claude com sete ferramentas, todas só de leitura
(`src/ferramentas.ts`). Ele não tem Bash, leitura de arquivos nem web, então
só sabe o que as ferramentas devolvem.

| Ferramenta             | O que faz                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listar_indices`       | Catálogo do tabelão: o que cada índice mede, classes, períodos, data de atualização, ressalvas.                                                                               |
| `detalhar_indice`      | Descrição completa de um índice como está no catálogo do site, com classes e ressalvas.                                                                                       |
| `buscar_territorio`    | Acha município, estado, bioma etc. pelo nome, sem acento, e devolve todos os homônimos com UF.                                                                                |
| `consultar_sql`        | SELECT no tabelão (só leitura, até 200 linhas, 10 s). Fonte principal: valores, rankings, séries. Com o parâmetro `grafico`, a página desenha o resultado (série ou ranking). |
| `link_no_sedes`        | Monta o link do site com o mesmo dado: o relatório do território com os índices da resposta. A página mostra como botão "Ver no SEDES".                                       |
| `sobre_o_sedes`        | Os textos do site (início, Sobre, Glossário) e um complemento sobre como ler os dados.                                                                                        |
| `relatorio_territorio` | Chama `/api/municipal-report` do site: o que o site mostra agora. Complemento, para conferir o atual.                                                                         |

## Como rodar a demonstração

Pré-requisitos: Node 24, Claude Code logado e, para montar o tabelão, o `.env`
do site na raiz do repositório (chave do Earth Engine e do Contentful).

```bash
# 1. Uma vez: dependências e tabelão
#    (~7 min; lê 184 tabelas do Earth Engine, ~1,3 GB de RAM, gera ~5,4 GB)
cd tools/sedes-chatbot
npm install
npm run tabelao

# 2. Em outro terminal, o site com a plataforma aberta (sem login),
#    para a ferramenta de relatório. Não altera o .env.
cd /home/marcelo/SAP-frontend
PLATFORM_ACCESS_GUARD_ENABLED=false npm run dev

# 3. O chat, no navegador: http://localhost:3210
cd tools/sedes-chatbot
npm run chat

#    ou no terminal
./conversar.sh          # Sonnet 5.5
./conversar.sh haiku    # Haiku 5.5
```

O site (passo 2) só é preciso para perguntas sobre "o que o site mostra agora";
o resto sai do tabelão. Outro endereço para o site:
`SEDES_BASE_URL=https://... npm run chat`. Outra porta: `SEDES_CHAT_PORTA=...`.

## A página de chat

`src/chat/servidor-chat.ts` serve a página e passa cada pergunta a um de dois
motores (`SEDES_CHAT_MOTOR`):

| Motor    | Como responde                                                                                                                                                                                                 | Quando                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `claude` | Abre um `claude -p` em stream-json por conversa, com as opções do `conversar.sh` (lidas do `comum.sh`), na assinatura de quem roda. Cada conversa ocupa ~380 MB por até 20 min. (`motor-claude.ts`)           | Padrão sem `ANTHROPIC_API_KEY`: testar no computador. |
| `api`    | Chama a API da Anthropic e roda as ferramentas no mesmo processo (~90 MB no total). No máximo 8 idas ao modelo por pergunta; na última ele não pode mais consultar e responde com o que tem. (`motor-api.ts`) | Padrão com `ANTHROPIC_API_KEY`: o beta.               |

O motor `api` lê o mesmo `prompt.md`, usa cache de prompt (prompt e
ferramentas são iguais em toda pergunta do dia) e calcula o custo de cada
resposta pelos tokens. No Sonnet, liga o fallback da API para recusas por
engano. Conversa que não está na memória (o servidor reiniciou) continua só com
o texto das perguntas e respostas anteriores.

Na página: o modelo (Sonnet ou Haiku, fixo durante a conversa), a resposta
enquanto é escrita, os passos que o bot fez (com o SQL e o resultado de cada
ferramenta), o botão de parar e 👍/👎 com comentário em cada resposta.

Cada conversa fica gravada em `conversas/<data>_<id>.jsonl` (fora do git), uma
linha por evento:

| `tipo`      | Campos                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `inicio`    | `id`, `modelo`, `modelo_id`, `motor`, `email` (com login)                                                                |
| `turno`     | `pergunta`, `resposta`, `ferramentas` (nome, entrada, saída, erro, ms), `ms`, `uso`, `custo_usd`, `interrompida`, `erro` |
| `avaliacao` | `turno`, `nota` (`bom`, `ruim` ou `null`), `comentario`; vale a última de cada turno                                     |

Proteções:

- **Login** (`acesso.ts`): sem `SEDES_CHAT_EMAILS`, o servidor só escuta em
  `127.0.0.1` e não pede login (e se recusa a subir em outro endereço). Com a
  lista, exige o cookie de sessão do SEDES (a página fica no mesmo domínio do
  site), confere com o Firebase como o site faz e só deixa entrar quem está na
  lista (e-mails ou `@dominio`). Cada pessoa vê só as próprias conversas.
- **Limites por dia** (`limites.ts`): 40 perguntas por pessoa e teto de
  US$ 2 para o chat todo (`SEDES_CHAT_PERGUNTAS_POR_DIA`,
  `SEDES_CHAT_TETO_DIARIO_USD`). Recomeçam do que está gravado, então
  reiniciar não zera o dia. Valem além do limite mensal da chave no Console.
- Recusa pedidos de outra origem (`SEDES_CHAT_ORIGEM` diz a do beta), perguntas
  com mais de 2.000 caracteres e conversas com mais de 30 perguntas.
- A ferramenta de relatório repassa ao site o cookie de quem perguntou: no
  beta, com a plataforma fechada, ela continua funcionando.

`npm run testar` roda os testes do motor `api` e do servidor contra uma API de
mentira (sem chave, sem gasto): consulta real ao tabelão, ferramentas em
paralelo, limite de idas ao modelo, botão Parar, erro da API, gravação e teto.

## No beta

O chat fica em `https://beta-sap.lsd.ufcg.edu.br/chat/`, num container próprio
(`sedes-chat-beta`) na rede do Docker do beta, ao lado do site. A imagem é
montada na própria VM (`Dockerfile`); o tabelão e as conversas ficam em
`/home/ubuntu/sedes-chatbot/` na VM, fora da imagem.

Para subir pela primeira vez:

1. **Chave**: criar o secret `SEDES_CHAT_ANTHROPIC_API_KEY` no repositório.
2. **Quem pode usar**: criar a variável `SEDES_CHAT_EMAILS`
   (ex.: `fulano@lsd.ufcg.edu.br,@oca.ufcg.edu.br`). Opcionais:
   `SEDES_CHAT_MODELOS` (padrão `haiku`; `haiku,sonnet` mostra a escolha),
   `SEDES_CHAT_PERGUNTAS_POR_DIA`, `SEDES_CHAT_TETO_DIARIO_USD`.
3. **Tabelão**: `deploy/publicar-tabelao.sh` comprime (~570 MB) e anexa à
   release `tiles-2025`. Nunca numa release ou tag nova: toda tag publica a
   main em produção.
4. **nginx**: acrescentar ao `sap.conf` do beta o trecho de
   `deploy/nginx-chat.conf` e recarregar o nginx.
5. **Publicar**: empurrar este branch para `chatbot-beta`
   (`git push origin HEAD:chatbot-beta`). O workflow `cd-chatbot-beta.yaml`
   roda no runner do beta: baixa o tabelão se o anexo mudou, monta a imagem e
   troca o container, voltando ao anterior se o novo não responder.

Para atualizar os dados: `npm run tabelao`, `npm run conferir`,
`deploy/publicar-tabelao.sh` e rodar o workflow de novo.

## Conhecimento sobre o SEDES

`conhecimento/` tem o que a ferramenta `sobre_o_sedes` entrega:

- `site.md`: os textos do site (página inicial, Sobre e Glossário), baixados
  das páginas publicadas por `npm run guia`. Não edite à mão: rode de novo
  quando o site mudar. Precisa do `npm install` da raiz (usa o jsdom).
- `complemento.md`: escrito à mão, com o que o site não diz e o bot precisa
  para ler os dados (decêndio, CadÚnico, recortes, previsões, como usar a
  plataforma). Termos de uso geral daqui deveriam ir para o Glossário do site,
  no Contentful; aí o `npm run guia` os traz e eles saem daqui.

O link "Ver no SEDES" aponta para a produção (`SEDES_SITE_URL` troca).

## Escopo (guardrail)

O que o bot pode fazer é limitado em duas camadas:

1. **Ferramentas**: só as do servidor MCP, todas só de leitura (o tabelão abre
   em modo read-only e o SQL só aceita SELECT/WITH). Sem Bash, arquivos ou web.
2. **Prompt** (seção "Escopo" de `prompt.md`): só assuntos do SEDES; recusa
   pedidos fora disso em uma frase, não dá opinião política, não muda de papel
   nem mostra as instruções. As perguntas G01–G06 de `perguntas.md` testam isso.

## Avaliação

`perguntas.md` tem 48 perguntas com a resposta esperada e a consulta SQL feita
à mão. `npm run consultas` roda essas consultas no tabelão.

```bash
PERGUNTAS="C01 H01" ./avaliar.sh haiku   # teste rápido
./avaliar.sh                              # todas, Haiku e Sonnet
```

Cada execução é um `claude -p` isolado; o resultado vai para
`resultados/<modelo>.md` (resposta, ferramentas chamadas e tempo). A
comparação comentada está em `resultados/avaliacao.md`.

O beta usa o motor `api`, então a avaliação que vale para ele é a do mesmo
motor (gasta a chave: ~US$ 0,17 as 48 no Haiku, ~US$ 2,60 no Sonnet):

```bash
PERGUNTAS="C01 H01" npm run avaliar-api   # teste rápido, Haiku
npm run avaliar-api -- sonnet             # todas, Sonnet
```

O resultado vai para `resultados/<modelo>-api.md`, no mesmo formato.

## O tabelão

`npm run tabelao` (`src/gee/montar-tabelao.ts`) monta `data/sedes.sqlite`
direto das fontes que o relatório do site usa:

- os índices são os do catálogo do site (Contentful) que entram no relatório,
  menos os de teste: 42 hoje, com os mesmos ids do relatório;
- cada tabela estatística do Earth Engine é lida inteira, numa ida só, com
  todos os níveis (Brasil, regiões, biomas, ASD, Semiárido, estados,
  municípios), e as linhas passam pelas mesmas funções do site
  (`matchesStatisticsPeriod`, `mapGeeStatisticsRows`): mesmo período, mesma
  validação, mesmo descarte de linha zerada;
- os índices de planilha (S2iD, pobreza, PIB, IDH, mortalidade, analfabetismo)
  vêm do instantâneo publicado, que já traz estados e recortes calculados
  (soma ou média simples dos municípios, conforme o índice);
- `atualizado_em` de cada índice é a data em que a tabela do Earth Engine (ou o
  instantâneo da planilha) foi publicada pela última vez.

Tabelas: `indices`, `classes`, `periodos` (rótulo legível, como o trimestre de
uma previsão), `territorios` (com UF, região, bioma predominante, Semiárido e
ASD de `src/data/municipalityTerritories.json`), `valores` (formato longo,
uma linha por índice × período × território × classe) e a visão
`valores_com_nomes`.

`npm run conferir` compara o tabelão com o relatório do site num conjunto fixo
de territórios (Brasil, PB, CE, Nordeste, Caatinga, Amazônia, ASD, Semiárido,
Campina Grande) mais municípios sorteados, valor a valor, arredondado a 1 casa
como o relatório mostra.

Medido em 12/11/2026: 184 tabelas lidas em 302 s, 4 de cada vez (830 s
somados de vaga na fila do Earth Engine, ~14 min); 43,4 milhões de valores,
5.615 territórios, 42 índices; 7 min no total. Uma tabela cuja leitura estoura
o prazo de 30 s do cliente do site (acontece com anos do CDI enquanto outra
tabela é gravada) é lida de novo no fim, sozinha. A conferência com 29
territórios bateu em 224.261 de 224.261 valores.

Os arquivos de `src/gee/` importam código do site (`@/...`) e são conferidos
com `npx tsc -p tools/sedes-chatbot/tsconfig.gee.json`, a partir da raiz.

## Limites conhecidos

- O tabelão é uma cópia: um índice republicado no site depois dela só entra
  rodando `npm run tabelao` de novo.
- Pobreza, IDH, mortalidade e analfabetismo de estados e recortes são média
  simples dos municípios; S2iD e PIB são soma. Vem do próprio site.
- Ressalvas do cadastro estão em `src/observacoes.ts`, lido pelo servidor a cada pedido (por exemplo, a
  previsão de temperatura mensal por probabilidade do INMET lê a tabela de
  precipitação).
