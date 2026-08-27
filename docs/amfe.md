# Análise multicritério (AMFE)

A análise multicritério vive em `/{locale}/platform/amfe`. Ela nasceu como uma
aplicação separada (`SAP-amfe`, publicada em `gamma-analise-multicriterial`) e
foi trazida para dentro deste repositório: a página substitui o mapa da
plataforma pelo próprio formulário + coropleta, no mesmo padrão de
`/platform?view=logs` e `/platform?view=catalog`.

## Rotas e navegação

- `src/app/[locale]/platform/amfe/page.tsx` renderiza
  `<PlatformLayout viewMode="amfe" />`. A sessão é exigida por
  `src/app/[locale]/platform/layout.tsx`, como nas demais páginas de
  `/platform`.
- O item **Análise** do `PlatformSideRail` navega para `/platform/amfe`
  (`buildPlatformHref` em `PlatformSidebar`). Nessa view o sidebar não abre
  painel lateral, porque a própria tela traz o formulário.

## Backend

O cálculo mora fora desta aplicação, no projeto
`SAP-analise-multicriterial` (FastAPI). O browser nunca fala com ele
diretamente: as chamadas passam por rotas de proxy nesta app, que preservam
status e corpo do backend.

| Rota nesta app            | Rota no backend         | Uso                                    |
| ------------------------- | ----------------------- | -------------------------------------- |
| `GET /api/amfe/criterias` | `GET /api/v1/criterias` | Catálogo de critérios do formulário    |
| `POST /api/amfe/analyze`  | `POST /api/v1/analyze`  | Executa a análise e devolve as cidades |

As duas exigem sessão (`denyUnauthenticatedAmfeRequest`, que reusa o
`getAuthenticatedUserId` do `/api/ee`) e respondem 401 sem ela. A página já é
protegida pelo layout de `platform/`, mas as rotas precisam do gate por conta
própria: o backend costuma viver em rede privada e este proxy é o único caminho
até ele — sem o gate, ele ficaria aberto na internet.

Não existe proxy para `POST /api/v1/sync`. Ele existia, sem chamador na UI, e
repassava um `x-sync-token` vindo do cliente devolvendo o status do backend —
um oráculo para força bruta do token. Se a recarga operacional precisar de uma
rota aqui, ela tem que autenticar e não aceitar o token do requisitante.

`API_BASE_URL` aponta para a base do backend (ex.: `http://127.0.0.1:8000` em
desenvolvimento). Sem essa variável as rotas de proxy respondem 500 com a
mensagem explícita — nada mais da plataforma é afetado. Os workflows de deploy
leem as variáveis de repositório `API_BASE_URL_BETA`, `API_BASE_URL_GAMMA` e
`API_BASE_URL` (produção) e as injetam no container em runtime.

## Coropleta no mapa da plataforma

A AMFE reusa o `Map` do MapLibre em vez do Leaflet do app original. O resultado
é pintado pela camada `amfe-classification-fills`
(`src/components/Map/classificationLayers.ts`), que lê o nível de prioridade de
`feature-state` na source vetorial de municípios:

- `classificationByCode`: código IBGE → prioridade 0 (muito baixa) a 4 (muito
  alta).
- `excludedCodes`: municípios dentro da área mas sem dado suficiente para
  ranquear, pintados em cinza translúcido.
- `CLASSIFICATION_MIN_ZOOM` (5) é o `minzoom` do `brazil-cities.mbtiles` e marca
  a fronteira entre as duas fontes da coropleta (ver adiante): abaixo dele não
  existe tile de município.

`amfe-classification-outline` desenha a divisa entre os municípios pintados. Ela
existe porque a divisa de `municipalityLayers` só fica visível a partir do zoom 7
(o `line-opacity` é um `step`), e o enquadramento de uma análise estadual para em
`MAP_STATE_FOCUS_MAX_ZOOM` (5.5) — sem contorno próprio a coropleta sairia como
manchas contíguas de cor.

A câmera **não** usa esse piso: a tela abre no zoom 4 com `minZoom` 3, os mesmos
valores do mapa da plataforma, senão o mapa abriria mostrando só um pedaço do
Brasil.

### Enquadramento da área de interesse

A área de interesse é **recorte espacial**, e enquadra igual ao Monitoramento:
`useSpatialBoundaryOverlay` busca o contorno, `resolveSpatialFocusBounds` devolve
os limites e o `spatialFocusBounds` do `Map` faz o fit. Nada mais.

Em particular, `estadoSelecionado` fica sempre em `BRAZIL_TERRITORY_CODE`.
Repassar a UF da área de interesse ali acionava um segundo enquadramento — o de
estado, com `enforceMinimumMapZoom` — concorrendo com o de recorte para os mesmos
limites. E como `getAllowedStateUfs` devolve UF minúscula enquanto
`resolveCurrentBounds` compara com `SIGLA_UF` maiúsculo, esse segundo fit nem
achava o estado: caía no fallback e enquadrava o Brasil no meio da animação.

`useMunicipalityClassification` reaplica o `feature-state` no evento
`styledata`, porque o reload de estilo descarta o estado anterior. A limpeza
remove apenas as chaves da AMFE, preservando `hover` e `selected` das outras
camadas.

## As duas fontes da coropleta

Durante uma análise o município precisa ter cor em qualquer zoom, mas o
`brazil-cities.mbtiles` começa no zoom 5 — e MapLibre não faz underzoom de source
vetorial. A coropleta usa então duas fontes, que se encaixam exatamente no
zoom 5 (`minzoom` de uma == `maxzoom` da outra, então nunca desenham juntas):

| Faixa    | Source                           | Camadas                                           |
| -------- | -------------------------------- | ------------------------------------------------- |
| zoom ≥ 5 | `brazil-cities` (tiles)          | `amfe-classification-fills` / `-outline`          |
| zoom < 5 | `amfe-cities-overview` (GeoJSON) | `amfe-classification-overview-fills` / `-outline` |

`applyClassificationFeatureStates` grava o feature-state nas duas — se escrevesse
só numa, o município perderia a cor ao cruzar o zoom 5. O hook filtra pelas
sources que já existem no mapa, porque `setFeatureState` numa source ausente
lança e as duas entram em momentos diferentes.

### O GeoJSON de visão geral

`public/data/brazil-cities-overview.json` — 5.571 municípios, ~1,9 MB em disco e
**~490 KB na rede** (gzip). Baixado sob demanda por `useCitiesOverview`, e só
quando existe análise: quem abre a tela sem analisar nunca paga o download.
Enquanto ele não chega, o aviso `Map.zoomInForClassification` explica a ausência
de cor abaixo do zoom 5.

A geometria é simplificada a ~2,2 km e guarda apenas o anel externo, o que é
sub-pixel no zoom 4 (onde um pixel vale ~10 km) e seria grosseiro em zoom alto —
daí o `maxzoom`. O código IBGE vive na propriedade `c`, promovida a id da feição
via `promoteId` para que a análise consiga endereçá-la.

Para regerar (a fonte é um GeoJSON de municípios com o código numa propriedade):

```bash
node scripts/build-cities-overview.mjs <geojson-de-municipios>
# --code-property codarea   propriedade do código IBGE na fonte
# --tolerance 0.02          graus (~2,2 km)
```

### Follow-up: fonte única

O caminho mais limpo seria regerar o `brazil-cities.mbtiles` com `minimum-zoom 3`
e apagar a fonte de visão geral. Não foi feito porque a única geometria
disponível aqui (`geometria.json` do SAP-amfe) traz só o código do município:
regerar o tileset compartilhado perderia `NM_MUN`/`SIGLA_UF`/`AREA_KM2`, que o
mapa do Monitoramento usa no hover, e trocaria a safra da geometria embaixo de um
fluxo que hoje funciona. Precisa da fonte IBGE 2025 original.

## Exportação

O menu (`AmfeMapDownloadMenu`) fica no canto superior esquerdo do mapa **a todo
momento** — o direito é do controle de zoom do MapLibre —, e oferece dois formatos. Sem análise, o PNG já leva a imagem do
recorte; a planilha é que fica desabilitada, porque não há resultado para
tabular.

### XLSX

Duas abas — dados por município e especificações da análise (critérios,
limiares, cenário, nível de ranqueamento, área de interesse e versão do
modelo) — via `src/components/Amfe/exportAnalysisWorkbook.ts`. O `xlsx` entra
por import dinâmico: quem abre a tela sem exportar não baixa os ~2 MB.

### PNG

`exportAnalysisMapImage.ts` renderiza a análise numa **instância própria e oculta
do MapLibre** e captura o canvas com `captureMapCanvasPng`. É o mesmo caminho de
`CatalogPreviewMapCapture` e `ReportMapPreview`, e por dois motivos:

- `preserveDrawingBuffer` só pode ser definido na construção do mapa; ligá-lo no
  mapa interativo custaria um framebuffer extra durante toda a sessão;
- tamanho (1280×960) e `pixelRatio` (2) fixos deixam a imagem independente do
  monitor de quem exporta — MapLibre não expõe `setPixelRatio` para mudar isso
  num mapa já criado.

A instância recebe as mesmas camadas da tela (`ensureMapLayers`, as duas fontes
da coropleta, o contorno do recorte) e enquadra pelos mesmos `spatialFocusBounds`.

Quando **há** análise, o menu desabilita o PNG até o GeoJSON de visão geral
chegar: sem ele um enquadramento abaixo do zoom 5 sairia sem cor. Sem análise a
espera não existe — `classification: null` captura o mapa sem coropleta, e nesse
caso a legenda de prioridade também não é desenhada, porque uma escala sobre um
mapa sem cor diria algo falso.

Detalhes que não são óbvios:

- o container fica fora da viewport com tamanho de layout real — `display: none`
  daria 0×0 e o MapLibre não renderizaria nada;
- a captura resolve no evento `idle` (tiles carregados e desenhados), com teto de
  30 s para o botão não travar;
- `error` do mapa **não** aborta: um tile 404 não pode derrubar a exportação;
- a captura devolve `null` legitimamente (WebGL perdido, canvas contaminado por
  tile sem CORS) e a tela mostra `Map.errorPng`.

`analysisMapImage.ts` compõe legenda e atribuição do OpenStreetMap sobre a
imagem, porque o canvas WebGL não contém o DOM — e a imagem sai do projeto, então
a atribuição precisa viajar com ela. O layout é função pura e o desenho fala com
uma interface mínima de contexto 2D, já que jsdom não implementa canvas.

## Testes focados

```
npm run test:unit -- --run __tests__/AmfeAnalyzeForm.test.tsx __tests__/AmfeCriteriaModal.test.tsx
npm run test:unit -- --run __tests__/amfeBackendProxy.test.ts __tests__/amfeSpatialSelection.test.ts
npm run test:unit -- --run __tests__/classificationLayers.test.ts __tests__/exportAnalysisWorkbook.test.ts
npm run test:unit -- --run __tests__/PlatformSidebarAmfeNavigation.test.tsx
npm run test:unit -- --run __tests__/AmfeScreen.test.tsx __tests__/Map.lifecycle.test.tsx
npm run test:unit -- --run __tests__/analysisMapImage.test.ts __tests__/AmfeMapDownloadMenu.test.tsx
```
