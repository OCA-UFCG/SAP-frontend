# Municipal report data API

`GET /api/municipal-report/{chaveTerritorial}?period=YYYY` (ou `YYYY-MM`) exige uma sessão autenticada e retorna o contrato `MunicipalReportData` versão 1.

A chave territorial é a mesma de `/api/municipal-analysis`: código IBGE de 7
dígitos, UF de duas letras, `br`, ou um recorte agregado
(`2_regiao-nordeste`, `3_bioma-caatinga`, `4_asd-asd-entorno`,
`5_semiarido-semiarido-total`). Uma chave com forma inválida responde 400; uma
chave bem formada cujo território não existe responde 404.

Fora do município, o relatório monta só os índices com `statisticsSource` no
Earth Engine: os legados guardam valores por município nas partições
`municipalAnalysis` do Contentful e não têm linha para estado, bioma ou Brasil.
Um índice cujo catálogo declarou `reportConfig.includeInReport: false` fica fora
do relatório em todos os recortes.

Exemplo resumido:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-07T12:00:00.000Z",
  "requestedPeriod": "2024-01",
  "territory": {
    "locationKey": "5200050",
    "level": "municipality",
    "name": "Abadia de Goiás",
    "label": "Abadia de Goiás — GO",
    "kindLabel": "município",
    "prepositionalLabel": "No município de Abadia de Goiás — GO",
    "possessiveLabel": "do município de Abadia de Goiás — GO",
    "uf": "GO"
  },
  "municipality": { "code": "5200050", "name": "Abadia de Goiás", "uf": "GO" },
  "analyses": [
    {
      "id": "anaseca",
      "alias": "seca",
      "title": "Monitor de Secas",
      "unit": "%",
      "status": "available",
      "requestedPeriod": "2024-01",
      "effectivePeriod": "2024-01",
      "classes": [{ "id": "sem-seca", "label": "Sem seca", "color": "#fff" }],
      "snapshot": {
        "period": "2024-01",
        "label": "Janeiro de 2024",
        "distribution": [
          {
            "id": "sem-seca",
            "label": "Sem seca",
            "color": "#fff",
            "percentage": 62.4
          }
        ],
        "dominantClass": {
          "id": "sem-seca",
          "label": "Sem seca",
          "color": "#fff",
          "percentage": 62.4
        }
      },
      "timeSeries": []
    }
  ],
  "templateVariables": {
    "territorio": "Abadia de Goiás — GO",
    "recorte": "município",
    "no_territorio": "No município de Abadia de Goiás — GO",
    "do_territorio": "do município de Abadia de Goiás — GO",
    "municipio_uf": "Abadia de Goiás — GO",
    "municipio": "Abadia de Goiás",
    "uf": "GO",
    "codigoMunicipio": "5200050",
    "classe_seca": "Sem seca",
    "percentual_seca": 62.4,
    "periodo_seca": "2024-01",
    "periodo_extenso_seca": "janeiro de 2024"
  }
}
```

`territory` descreve o recorte do relatório e existe em todas as respostas;
`municipality` continua presente apenas no relatório de um município, para os
consumidores que dependem do código IBGE. As variáveis de território
(`no_territorio`, `do_territorio`, `territorio`, `recorte`) são as que o texto
escrito no catálogo usa para valer em qualquer recorte: `no_territorio` já vem
com a contração certa ("Na região Nordeste", "No bioma Caatinga"). `uf` fica
vazia nos recortes que não têm uma.

Cada análise pode ter estado `available`, `unavailable` ou `period_not_found`. Falhas parciais não invalidam as demais análises. As variáveis são valores estruturados; esta API não interpola templates.

Cada análise contribui com `classe_<alias>`, `percentual_<alias>`,
`valor_<alias>`, `unidade_<alias>`, `valor_com_unidade_<alias>`,
`periodo_<alias>` e `periodo_extenso_<alias>`. O último é o período já escrito
por extenso ("janeiro de 2024"), e existe para o texto que o catálogo publica:
`2024-01` no meio de uma frase lê-se mal, e quem escreve não deve ter que
formatar data à mão para cada índice.

## Variáveis de série, por índice

Além dessas, cada análise contribui com as **variáveis de série** que aquele
índice comporta — `classe_anterior_<alias>`, `status_tendencia_<alias>`,
`janela_12_meses_<alias>` e as demais de
`src/utils/reportSeriesVariables.ts`. Elas saem da série que a análise já
carrega, sem nenhuma leitura nova no Contentful ou no Earth Engine.

O conjunto **varia por índice**, e é decidido pelo perfil temporal
(`describeReportVariableProfile`), nunca pelos dados do município:

| Exige                          | Quem recebe                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| dois períodos                  | qualquer índice com série                                                                               |
| distribuição por classes       | índices com mais de uma classe; os de valor único recebem `valor_anterior` e `diferenca_valor` no lugar |
| mensal com mais de 12 períodos | `janela_12_meses`, `classe_mesmo_mes_ano_anterior`, `variacao_ano_a_ano`                                |
| ordem de gravidade declarada   | `status_tendencia`, `classe_maior_severidade`, `periodo_maior_severidade`                               |
| classe neutra declarada        | `quantidade_periodos_com_fenomeno`, `percentual_condicao_neutra`                                        |

Um índice de **previsão** — cujo último período ainda não chegou — não recebe
nenhuma delas: os períodos dele são horizontes de uma mesma emissão, e
compará-los não é comparar história.

A disponibilidade é uma propriedade do índice, e não do município, de
propósito: fosse do município, um texto escrito com a lista de Campina Grande
quebraria em outro município. Quando a série de um município específico não
sustenta uma variável oferecida, o valor é a string `sem dados` — nunca `null`,
porque a substituição do relatório deixaria o `[colchete]` cru no texto que o
cidadão lê.

A ordem de gravidade não é inferida. Ela vem de `panelLayer.reportConfig.severity`
(declarada no catálogo) ou dos `rank`/`isNeutral` estáticos de
`MUNICIPAL_REPORT_LAYERS`. Sem uma das duas, as variáveis de tendência
simplesmente não existem para aquele índice.

Uma análise pode trazer `presentation` — `{ sectionColor?, methodology? }` —
quando o índice publicou esses valores pelo catálogo
(`panelLayer.reportConfig`). É um campo aditivo e opcional da v1: um índice
legado não o traz e o cliente cai no registro estático de
`src/config/municipalReport.ts`, como sempre fez. As seções de texto **não**
passam por aqui; elas chegam pela rota de textos
(`/api/municipal-report/{chaveTerritorial}/docs`).

Quando o período solicitado não existe, a API ainda retorna `200` com
`status: "period_not_found"` e os períodos existentes em `timeSeries`. O status
`502` é reservado ao caso em que nenhuma camada configurada pôde ser carregada.

---

## Textos do relatório (`GET /api/municipal-report/{chaveTerritorial}/docs`)

Parâmetros: `period` (obrigatório) e `layers` (opcional). A convenção de
`layers` é a mesma da rota do relatório-base — sem ele, valem todas as camadas.

As duas chamadas da tela devem mandar **a mesma** lista, porque a lista pedida
entra na chave do cache do relatório (`municipalReportCache`): mandar aqui só as
camadas disponíveis fazia esta rota errar o cache e remontar o relatório
inteiro. Quem filtra o que vira seção é o servidor, pelo `status` das análises
do relatório já montado. Quando nenhuma análise fica disponível, a resposta é
`404`.

O teto de relatórios em memória é 100 (`MUNICIPAL_REPORT_CACHE_MAX_ENTRIES`),
com expulsão do menos recentemente usado. Um relatório municipal completo ocupa
~430 KiB.

---

## Chart API (geração de imagem)

`GET /api/municipal-report/{chaveTerritorial}/chart?period=YYYY-MM&analysis=alias` exige sessão autenticada e retorna um **PNG** do gráfico de série temporal.

### Parâmetros

| Parâmetro  | Tipo  | Obrigatório | Descrição                                                                |
| ---------- | ----- | ----------- | ------------------------------------------------------------------------ |
| `period`   | query | sim         | Período no formato `YYYY` ou `YYYY-MM`                                   |
| `analysis` | query | sim         | Um ou mais IDs/aliases separados por vírgula (ex: `seca`, `seca,aridez`) |

### Comportamento

Retorna sempre um objeto JSON contendo as informações do município, o período solicitado e um array com os gráficos gerados codificados em **base64**:

```json
{
  "municipality": { "code": "2504009", "name": "Campina Grande", "uf": "PB" },
  "requestedPeriod": "2024-01",
  "charts": [
    {
      "analysisId": "anaseca",
      "alias": "seca",
      "title": "Monitor de Secas",
      "period": "2024-01",
      "contentType": "image/png",
      "base64": "iVBORw0KGgo..."
    }
  ]
}
```

### Exemplos

```
GET /api/municipal-report/2504009/chart?period=2024-01&analysis=seca
GET /api/municipal-report/2504009/chart?period=2024&analysis=seca,aridez,degradacao

```

### Como compor uma imagem no html:

```
<img
  src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  alt="Monitor de Secas"
/>
```

---

## URLs de tiles dos mapas (`POST /api/ee/map-urls`)

A imagem espacial de cada item do relatório é capturada no navegador: um mapa
MapLibre desenha o raster do Earth Engine sobre o contorno do município e o
`canvas` vira PNG. Para desenhar, cada mapa precisa da URL de tiles daquela
camada naquele período.

Essa rota resolve todas de uma vez. Exige sessão autenticada e recebe:

```json
{
  "maps": [
    { "name": "anaseca", "year": "2024-12" },
    { "name": "deg", "year": "2021" }
  ]
}
```

Responde com uma entrada por par pedido, na mesma ordem, cada uma com `url` ou
com `status`:

```json
{
  "maps": [
    {
      "name": "anaseca",
      "year": "2024-12",
      "url": "https://earthengine.googleapis.com/..."
    },
    { "name": "deg", "year": "2021", "status": "year_not_found" }
  ]
}
```

| `status`          | Significado                                                     |
| ----------------- | --------------------------------------------------------------- |
| `layer_not_found` | Não existe `panelLayer` com esse id.                            |
| `year_not_found`  | O `imageData` da camada não tem imagem para esse período.       |
| `rate_limited`    | A janela de chamadas ao Earth Engine do usuário acabou.         |
| `error`           | A geração da URL falhou no Earth Engine.                        |
| `pending`         | Ainda em voo; peça de novo daqui a pouco (veja o prazo abaixo). |

Uma camada nunca derruba o lote: quem falha volta com `status` e o relatório
mostra "imagem indisponível" naquele item, em vez de um quadro cinza sem
explicação.

### Por que em lote

Antes cada mapa pedia a sua URL ao `/api/ee`. Um relatório de 20 camadas virava
20 requisições contra o limite de 30 por minuto por usuário, então quem tivesse
acabado de navegar pelo mapa perdia a imagem das últimas camadas — e a única
retentativa disparava dentro da mesma janela, falhava de novo e ainda gastava
mais uma vaga.

O limitador do `/api/ee` passou a cobrar **uma vaga por ida ao Earth Engine**, e
não por requisição: uma URL que já está em cache, ou cuja chamada já está em
voo, não custa cota nenhuma ao Earth Engine e por isso não custa vaga. A
proteção continua sendo de 30 chamadas ao Earth Engine por minuto por usuário.

### O prazo e o `pending`

Vinte camadas frias custam cerca de 13 s: o SDK do Earth Engine despacha uma
requisição a cada 350 ms de uma fila global do processo. Segurar tudo isso numa
requisição só a deixaria à mercê do timeout do proxy, e aí os vinte mapas se
perderiam de uma vez.

A rota espera no máximo `EE_MAP_URLS_DEADLINE_MS`
(`src/contracts/eeMapUrls.ts`) e devolve `pending` para o que não ficou pronto.
A ida ao Earth Engine continua em voo; quem pergunta de novo entra na mesma
promessa, sem gerar chamada nova nem gastar vaga. O relatório desenha cada mapa
assim que a URL dele chega, em vez de esperar as vinte.
