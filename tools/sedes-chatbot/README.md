# Protótipo de chatbot do SEDES

Um chatbot que responde, em português, perguntas sobre os dados do SEDES. É um
**protótipo local**: roda na máquina de quem demonstra, dentro do Claude Code,
sem chave de API e sem interface própria.

O "bot" é o Claude com um servidor MCP que dá a ele quatro ferramentas, todas
só de leitura. As ferramentas nativas do Claude Code (Bash, leitura de
arquivos, web) ficam desligadas, então ele só sabe o que as ferramentas
devolvem.

| Ferramenta             | O que faz                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `listar_indices`       | Catálogo do tabelão: o que cada índice mede, classes, períodos, data dos dados.                               |
| `buscar_territorio`    | Acha município, estado, bioma etc. pelo nome, sem acento, e devolve todos os homônimos com UF.                |
| `consultar_sql`        | SELECT no tabelão (só leitura, até 200 linhas, 10 s). Fonte principal: valores, rankings, séries.             |
| `relatorio_territorio` | Chama `/api/municipal-report` do site (dado atual do Earth Engine, ~40 índices). Lento (5–15 s); complemento. |

## Como rodar a demonstração

Pré-requisitos: Node 24, Claude Code logado, o SQLite antigo em
`data/runtime/sap-analytics.sqlite` (fora do git).

```bash
# 1. Uma vez: dependências e tabelão (~1 min, ~200 MB de RAM, gera 1,1 GB)
cd tools/sedes-chatbot
npm install
npm run tabelao

# 2. Em outro terminal, o site com a plataforma aberta (sem login),
#    para a ferramenta de relatório. Não altera o .env.
cd /home/marcelo/SAP-frontend
PLATFORM_ACCESS_GUARD_ENABLED=false npm run dev

# 3. O chat
cd tools/sedes-chatbot
./conversar.sh          # Sonnet 5.5
./conversar.sh haiku    # Haiku 5.5
```

Outro endereço para o site: `SEDES_BASE_URL=https://... ./conversar.sh`.

## Avaliação

`perguntas.md` tem 35 perguntas com a resposta esperada e a consulta SQL feita
à mão. `npm run consultas` roda essas consultas no tabelão.

```bash
PERGUNTAS="C01 H01" ./avaliar.sh haiku   # teste rápido
./avaliar.sh                              # todas, Haiku e Sonnet
```

Cada execução é um `claude -p` isolado; o resultado vai para
`resultados/<modelo>.md` (resposta, ferramentas chamadas e tempo). A
comparação comentada está em `resultados/avaliacao.md`.

## O tabelão

`npm run tabelao` lê o SQLite antigo (só leitura) e grava `data/sedes.sqlite`:

- `indices`, `classes`: catálogo, com o significado de cada valor;
- `territorios`: 5.571 municípios, 27 estados, Brasil, 5 regiões, 6 biomas,
  Semiárido e 2 recortes de ASD, com UF, região, bioma predominante e se é
  Semiárido (de `src/data/municipalityTerritories.json`);
- `valores`: formato longo, uma linha por índice × período × território ×
  classe (15 milhões de linhas), com o valor já na unidade final;
- `valores_com_nomes`: visão com nomes de território e de classe.

**Escala.** No SQLite antigo, nos períodos com `values_scale = 10`, estados e
Brasil estão em décimos de ponto percentual (as classes somam ~1000), herdados
do Contentful. Municípios e recortes já estão em % (somam 100). O tabelão
divide só estados e Brasil. Linhas com todas as classes zeradas são "sem dado"
e ficam de fora (17.245 de 2,76 milhões), exceto no S2iD, em que 0 é contagem.

**Conferência com o site** (12/11/2026, Campina Grande, Paraíba e Brasil):
Monitor de Secas, as três pobrezas e carbono do solo batem; degradação e ODS
batem nos municípios mas não nos estados; S2iD, cobertura da terra, produção
primária e aridez foram recalculados no site; o CDI do site é decendial. Cada
índice traz isso na coluna `observacao`.

## Limites conhecidos

- Os dados são de 24/07/2026. O site hoje tem mais períodos e mais índices.
- Região, bioma e Semiárido só têm valor próprio no Monitor de Secas e na
  previsão de chuva. Para os outros índices, o bot usa o relatório do site.
- Pobreza de estado e Brasil é média simples dos municípios.
- A previsão de chuva do tabelão é antiga (maio a outubro de 2026).
