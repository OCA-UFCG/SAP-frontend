# Protótipo de chatbot do SEDES

Um chatbot que responde, em português, perguntas sobre os dados do SEDES. É um
**protótipo local**: roda na máquina de quem demonstra, dentro do Claude Code,
sem chave de API: pela página de chat local (`npm run chat`) ou pelo terminal.

O "bot" é o Claude com um servidor MCP que dá a ele sete ferramentas, todas
só de leitura. As ferramentas nativas do Claude Code (Bash, leitura de
arquivos, web) ficam desligadas, então ele só sabe o que as ferramentas
devolvem.

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

`src/chat/servidor-chat.ts` serve a página e, para cada conversa, abre um
`claude -p` em modo stream-json com as **mesmas opções do `conversar.sh`** (lidas
do `comum.sh`). Por isso usa a assinatura de quem roda, sem chave de API, e
segue o mesmo prompt e as mesmas ferramentas. O processo de uma conversa fecha
depois de 20 min parada; a próxima pergunta reabre com `--resume`, e as
conversas antigas, abertas pela lista ao lado, podem ser continuadas.

Na página: o modelo (Sonnet ou Haiku, fixo durante a conversa), a resposta
enquanto é escrita, os passos que o bot fez (com o SQL e o resultado de cada
ferramenta), o botão de parar e 👍/👎 com comentário em cada resposta.

Cada conversa fica gravada em `conversas/<data>_<id>.jsonl` (fora do git), uma
linha por evento:

| `tipo`      | Campos                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `inicio`    | `id`, `modelo`, `modelo_id`                                                                                              |
| `turno`     | `pergunta`, `resposta`, `ferramentas` (nome, entrada, saída, erro, ms), `ms`, `uso`, `custo_usd`, `interrompida`, `erro` |
| `avaliacao` | `turno`, `nota` (`bom`, `ruim` ou `null`), `comentario`; vale a última de cada turno                                     |

O servidor só escuta em `127.0.0.1` e recusa pedidos vindos de outra origem,
para que outro site aberto no navegador não mande perguntas para ele. Perguntas
com mais de 2.000 caracteres são recusadas.

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
