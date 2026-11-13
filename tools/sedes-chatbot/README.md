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

Para a Priorização, suba também o backend `SAP-analise-multicriterial` em
`127.0.0.1:8000` (o mesmo que a aba Priorização do site local usa). Na partida
ele baixa a planilha e regrava `data/dataset.xlsx` e `data/novo_dataset.csv.gz`,
que são versionados naquele repositório; as variáveis abaixo apontam para uma
cópia e deixam o repositório limpo:

```bash
C=~/.cache/sedes-priorizacao; mkdir -p $C
cd ~/SAP-analise-multicriterial
cp data/dataset.xlsx data/novo_dataset.csv.gz data/dataset-manifest.json $C/
DATASET_PATH=$C/novo_dataset.csv.gz DATASET_XLSX_PATH=$C/dataset.xlsx \
  DATASET_MANIFEST_PATH=$C/dataset-manifest.json DATASET_SYNC_INTERVAL_SECONDS=0 \
  .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

Ele leva ~1 min para responder (baixa a planilha). Sem ele, o chat funciona,
mas a ferramenta de Priorização responde que está fora do ar. Outro endereço:
`SEDES_MULTICRITERIO_URL`.

## A página de chat

`src/chat/servidor-chat.ts` serve a página e passa cada pergunta a um de dois
motores (`SEDES_CHAT_MOTOR`):

| Motor    | Como responde                                                                                                                                                                                                 | Quando                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `claude` | Abre um `claude -p` em stream-json por conversa, com as opções do `conversar.sh` (lidas do `comum.sh`), na assinatura de quem roda. Cada conversa ocupa ~380 MB por até 20 min. (`motor-claude.ts`)           | Padrão sem `ANTHROPIC_API_KEY`: testar no computador. |
| `api`    | Chama a API da Anthropic e roda as ferramentas no mesmo processo (~90 MB no total). No máximo 8 idas ao modelo por pergunta; na última ele não pode mais consultar e responde com o que tem. (`motor-api.ts`) | Padrão com `ANTHROPIC_API_KEY`: o beta.               |

Os dois motores usam o mesmo prompt do sistema (`src/prompt-sistema.ts`):
`prompt.md`, o catálogo de índices resumido (o de `listar_indices` em ~15 mil
caracteres) e a data de hoje. Com o catálogo no prompt, o modelo não precisa
chamar `listar_indices` antes de consultar: na avaliação de 12/11/2026 (32
perguntas, Haiku), a resposta caiu de 8,0 s para 6,5 s em média e de 4,3 para
3,4 idas ao modelo, com a mesma qualidade.

O motor `api` usa cache de prompt (prompt e ferramentas são iguais em toda
pergunta do dia) e calcula o custo de cada
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
5. **Priorização**: o chat chama o backend multicritério pelo mesmo endereço
   que o site do beta usa (variável `API_BASE_URL_BETA`); não precisa de nada
   novo, mas confira depois do primeiro deploy se a pergunta "quais municípios
   da Paraíba priorizar?" responde.
6. **Publicar**: empurrar este branch para `chatbot-beta`
   (`git push origin HEAD:chatbot-beta`). O workflow `cd-chatbot-beta.yaml`
   roda no runner do beta: baixa o tabelão se o anexo mudou, monta a imagem e
   troca o container, voltando ao anterior se o novo não responder.

Para atualizar os dados: `npm run tabelao`, `npm run conferir`,
`deploy/publicar-tabelao.sh` e rodar o workflow de novo.

## Priorização (análise multicritério)

A ferramenta `priorizar_municipios` (`src/priorizacao.ts`) roda a mesma conta
da aba Priorização do site: chama `POST /api/v1/analyze` do backend
`SAP-analise-multicriterial` (ELECTRE TRI-B) e resume a resposta, sem
recalcular nada. Os dados são os da planilha da Priorização, não os do tabelão.

- Critérios, pesos, área, comparação ("cada estado" é o padrão do site, como
  no formulário), cenário e limiares têm os mesmos padrões do site.
- A saída traz a configuração, os municípios de fora por falta de dado, a
  distribuição por nível (a página desenha o gráfico), a lista de um nível e,
  para municípios pedidos pelo nome, a posição em cada critério ("situação
  pior que X% do grupo"), que é o que o bot usa para explicar um nível.
- A classe do backend vai de 0 a 4 e é lida como no mapa do site: 0 = muito
  baixa, 4 = muito alta prioridade (pior situação). As instruções do servidor
  MCP do próprio backend (`app/mcp/server.py`) dizem o contrário ("1 pior a 5
  melhor"); conferido com Assunção–PB, que tem a pior aridez e fica em 4.
- O prompt do sistema leva `conhecimento/priorizacao.md` (como a conta é feita
  e os textos do formulário) e a lista de critérios lida do backend.
- O botão "Abrir a Priorização" abre a aba no site, mas sem a configuração: o
  site ainda não aceita critérios pelo endereço.
- Cruzar com o tabelão: cada análise fica guardada no processo com um id
  (as 50 últimas) e a saída diz esse id. `consultar_sql` com
  `priorizacao: "<id>"` ganha a tabela
  `priorizacao(codigo, nome, uf, nivel, nivel_ordem, grupo)`, posta na frente
  da consulta como uma CTE, para juntar os níveis com `valores` pelo código
  IBGE. Antes disso o modelo copiava os nomes na consulta, o que só funcionava
  até 150 municípios por nível (no Nordeste, rodou a Priorização estado por
  estado: 14 idas ao modelo, 42 s).

## Conhecimento sobre o SEDES

`conhecimento/` tem os textos que o bot recebe (os dois primeiros também pela
ferramenta `sobre_o_sedes`):

- `site.md`: os textos do site (página inicial, Sobre e Glossário), baixados
  das páginas publicadas por `npm run guia`. Não edite à mão: rode de novo
  quando o site mudar. Precisa do `npm install` da raiz (usa o jsdom).
- `complemento.md`: escrito à mão, com o que o site não diz e o bot precisa
  para ler os dados (decêndio, CadÚnico, recortes, previsões, como usar a
  plataforma). Termos de uso geral daqui deveriam ir para o Glossário do site,
  no Contentful; aí o `npm run guia` os traz e eles saem daqui.
- `priorizacao.md`: escrito à mão, como a Priorização funciona. Material novo
  da equipe sobre como interpretar critérios e níveis entra aqui.

O link "Ver no SEDES" aponta para a produção (`SEDES_SITE_URL` troca).

## Escopo (guardrail)

O que o bot pode fazer é limitado em duas camadas:

1. **Ferramentas**: só as do servidor MCP, todas só de leitura (o tabelão abre
   em modo read-only e o SQL só aceita SELECT/WITH). Sem Bash, arquivos ou web.
2. **Prompt** (seção "Escopo" de `prompt.md`): só assuntos do SEDES; recusa
   pedidos fora disso em uma frase, não dá opinião política, não muda de papel
   nem mostra as instruções. As perguntas G01–G06 de `perguntas.md` testam isso.

## Avaliação

`perguntas.md` tem 101 perguntas com a resposta esperada; a maioria tem também
a consulta SQL feita à mão (`npm run consultas` roda essas consultas no
tabelão). As de M em diante vieram do uso real da página: conversas com
continuação (linhas `Depois:`), perguntas abertas, sentido das classes,
escrita informal, dado que não existe e comparações.

```bash
npm run avaliar -- --so M01,E02 --rotulo teste   # teste rápido
npm run avaliar -- --categoria M,E,K,L,D,Q        # só as difíceis
npm run avaliar                                   # todas, Haiku
npm run avaliar -- --modelo sonnet
npm run avaliar -- --comparar antes depois        # compara duas rodadas
```

Cada pergunta roda pelo mesmo motor da página (`--motor claude`, o padrão, na
assinatura de quem roda; ou `--motor api`, com a chave), 3 de cada vez. Para
cada resposta ficam gravados o tempo, as idas ao modelo, as ferramentas e os
tokens. Os números da linha `Números:` têm de aparecer na última resposta, e
um juiz (Sonnet, pelo `claude`) dá uma nota (certo, parcial ou errado) com o
motivo. O resumo vai para `resultados/rodadas/<rotulo>.md`; os dados de cada
pergunta, para `resultados/brutos/<rotulo>/` (fora do git).

Custo de uma rodada das 32 difíceis no Haiku, em preço de API: uns US$ 0,10
de respostas mais o juiz. O juiz também erra e varia de uma rodada para outra:
leia o motivo antes de mudar o prompt por causa de uma nota.

Para comparar mudanças que não estão no código, use variáveis de ambiente:
`SEDES_CATALOGO_NO_PROMPT=0` tira o catálogo do prompt e `SEDES_CHAT_ESFORCO`
muda o esforço do modelo. Para rodar duas avaliações ao mesmo tempo, dê a cada
uma a sua pasta de sessão (`SEDES_SESSAO=~/.cache/outra-pasta`).

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
