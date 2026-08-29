# Estatísticas territoriais em assets do Earth Engine

## Objetivo e escopo atual

O runtime pode ler estatísticas de uma `FeatureCollection` do Google Earth
Engine (GEE) e convertê-las no mesmo patch `territorial-compact` já consumido
pelo painel. Isso remove, para as camadas migradas, a obrigação de exportar CSV
para o Google Drive e publicar entradas `municipalAnalysis` no Contentful.

As fontes legadas registradas estaticamente são:

```text
carbonoembrapa -> asset fixo anual
anaseca       -> um asset por ano, resolvido pelo período solicitado
```

Novos índices não precisam ser registrados em código: publicam o contrato em
`panelLayer.statisticsSource`. O `panelLayer` continua sendo a fonte das
classes, cores, templates, períodos, `imageId` e configuração visual, mas não
armazena valores territoriais. Os shards `municipalReportSeries` e o índice de
disponibilidade dos relatórios não foram migrados para GEE.

## Autenticação

A leitura acontece somente no servidor. `GEE_PRIVATE_KEY` deve conter o JSON
completo de uma service account, incluindo `client_email`, `private_key` e,
normalmente, `project_id`. O cliente usa `project_id` como projeto consumidor;
`GEE_PROJECT_ID` pode substituí-lo explicitamente.

A service account precisa ter permissão de leitura no asset. A chave nunca é
enviada ao navegador: o frontend chama uma rota autenticada da própria
aplicação.

```env
GEE_PRIVATE_KEY='{"client_email":"...","private_key":"...","project_id":"..."}'
GEE_PROJECT_ID=''
GEE_STATISTICS_ENABLED='true'
GEE_STATISTICS_CARBON_ASSET_ID='projects/obscaatinga/assets/Estatistica_Otimizada_Carbono_2020'
GEE_STATISTICS_ANA_ASSET_TEMPLATE='projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_{year}'
```

Definir `GEE_STATISTICS_ENABLED=false` desliga todas as fontes estatísticas GEE
e força o caminho legado. IDs e templates podem ser substituídos por ambiente
sem alterar código.

## Fluxo sob demanda

O comportamento é sob demanda, semelhante ao raster, mas a resposta e o
processamento são diferentes:

```text
seleção de camada/período/território
  -> GET /api/municipal-analysis/{layer}?year={period}&locationKey={key}
  -> cache do servidor (layer + period + location)
  -> cache de linhas da série (assets + location) -- uma leitura por território
  -> consulta filtrada à FeatureCollection GEE
  -> conversão para patch territorial-compact
  -> merge com os metadados do panelLayer
  -> JSON para o painel
```

O raster usa `/api/ee` para obter metadados de mapa e URLs de tiles. As
estatísticas usam `/api/municipal-analysis` e avaliam somente propriedades de
uma tabela filtrada; nenhuma geometria é transferida. Assim, uma troca de
município, UF, recorte agregado ou período gera uma consulta estatística própria
quando não houver valor no cache.

Exemplos de `locationKey` aceitos:

- `br`: retorna Brasil e as 27 UFs, necessário para o ranking nacional;
- `pb`: retorna apenas a Paraíba;
- `2507507`: retorna apenas o município desse código IBGE;
- `2_regiao-nordeste`, `3_bioma-caatinga`, `4_asd-asd-entorno` e
  `5_semiarido-semiarido-total`: retornam o agregado canônico solicitado.

## Registro e mapeamento

`src/config/geeStatisticsLayers.ts` e `src/config/geeStatistics.ts` mantêm
somente Carbono e ANA durante a transição. Para índices novos, o frontend
detecta `panelLayer.statisticsSource`. O contrato e a inferência do schema
ficam isolados em `src/contracts/geeStatistics.ts`.

O adaptador aceita um asset fixo ou um template com `{year}`, `{month}` e
`{period}`. O perfil de `anaseca`, por exemplo, resolve `2025-03` para o asset
terminado em `MonitorANA_2025`. No catálogo v2, a ação de revalidação lista o
diretório-pai do template, descobre os períodos e só os torna públicos depois
de uma nova prévia e publicação. O runtime não faz varredura de diretório.

### Contrato mínimo dos assets

O schema é descoberto no primeiro acesso a cada asset e fica em cache no
processo. Não é necessário listar manualmente o número das classes. O contrato
exato é:

- `perc_classe_XX` e `area_ha_classe_XX`, com a grafia `classe`;
- os dois grupos devem conter exatamente os mesmos índices;
- índices inteiros únicos, sem exigência de valor inicial nem de sequência
  contígua — a cobertura do solo do IBGE usa 1 a 6 e 9 a 14, porque 7 e 8 não
  existem na legenda dela;
- `NIVEL_AGRUPAMENTO`, `NOME_LOCAL`, `ano`, `data_img` e `area_total_ha`;
- `CD_MUN` para linhas municipais e `NM_UF` para linhas estaduais/municipais;
- uma única linha por período e localidade;
- percentuais numéricos entre 0 e 100, totalizando `100 ± 0,2` (ou todos zero
  para representar ausência), na ordem semântica das classes do `panelLayer`.

As quantidades e os nomes das classes visuais permanecem no `panelLayer`; o
asset fornece os valores. Por isso, o adaptador valida que a quantidade inferida
é igual à quantidade de classes da camada. Ele não tenta inferir o significado
de cada índice.

Para adicionar outra fonte normalmente basta declarar:

- o `panelLayerId` e o asset;
- granularidade `year` ou `month`;
- estratégia fixa ou template de partição;
- nomes territoriais diferentes do padrão, se houver;
- métricas escalares opcionais, como média e mediana do carbono.

O adaptador valida schema, números, quantidade de classes e duplicidade
territorial. Linhas cujas classes são todas zero são reconhecidas como ausência
de estatística e não viram distribuição no patch.

## Fallback e cache

Quando o GEE responde, o resultado é autoritativo, inclusive quando não há
valores para o recorte. Carbono e ANA conservam fallback Contentful temporário.
Uma fonte dinâmica de `panelLayer.statisticsSource` nunca usa esse fallback:
se houver resposta antiga no cache ela pode ser servida como stale; sem cache,
a rota responde indisponibilidade.

O cache em memória usa a chave `panelLayerId::year::locationKey`. O TTL padrão
é 10 minutos e o limite padrão é 200 entradas. Eles podem ser ajustados com
`MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS` e
`MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES`. Em uma implantação com múltiplas
instâncias, cada processo mantém seu próprio cache.

### A leitura no GEE é por território, não por período

Abaixo daquele cache existe um segundo, em `geeStatisticsRowsCache.ts`, cuja
chave é **a série inteira de assets** mais o território e as propriedades
pedidas. Ele guarda todas as linhas daquele território, e o período é
selecionado depois, em JavaScript, por `matchesStatisticsPeriod`.

O motivo é que o preço de uma consulta ao Earth Engine é do round trip, e não do
volume. Medido no índice de aridez do ERA5-Land, que tem 45 tabelas anuais:

| Como se pede                   | Requisições | `2507507` | `br` (1 260 linhas) |
| ------------------------------ | ----------: | --------: | ------------------: |
| um `evaluate` por período      |          45 | 17 103 ms |           17 098 ms |
| um `evaluate` com os 45 assets |           1 |  3 709 ms |            3 623 ms |
| três `evaluate` de 15 assets   |           3 |         — |            2 968 ms |

O território continua filtrado no GEE porque é ele que limita o tamanho da
resposta — sem ele viriam as 5.573 linhas municipais. O período não limita nada,
então filtrá-lo lá custava uma ida ao Earth Engine por período visível.

As duas formas de fonte convergem para a mesma leitura:

- **`fixed`** — um asset guarda todos os períodos, então a série é ele mesmo.
- **`period-template`** — cada período resolve um `assetId`, e
  `ee.FeatureCollection([...]).flatten()` junta os recortes antes de avaliar.
  A lista costuma ser menor que a de períodos: o template do Monitor de Secas da
  ANA é anual e a granularidade é mensal, então 30 períodos moram em 3 assets.

O schema segue a mesma chave: o catálogo valida que todas as tabelas de um
índice têm o mesmo conjunto de colunas, então uma leitura de `propertyNames()`
responde pela série toda. Antes, abrir o índice de aridez do ERA5-Land custava
45 leituras de schema **mais** 45 de linhas.

Os assets entram em blocos de 15 (`STATISTICS_ROWS_BATCH_SIZE`) porque um asset
inexistente derruba o pedido inteiro — com o nome dele no erro. O bloco limita
quanto trabalho uma falha invalida e, medido, ainda é mais rápido que um pedido
único.

Quem passa a lista de períodos é o chamador: `attachMunicipalAnalysisYearToPanelLayer`
usa as chaves de `imageData.years`, e a prévia do catálogo usa
`validation.inferred.periods`. Sem essa lista o comportamento é o antigo, uma
leitura só do período pedido.

A publicação do catálogo limpa esse cache junto com os demais, em
`refreshPublicIndexCaches`. O limite de entradas pode ser ajustado com
`GEE_STATISTICS_ROWS_CACHE_MAX_ENTRIES`.

## Retirada do pipeline legado

Para uma camada migrada, a remoção segura das estatísticas do Contentful deve
acontecer somente depois de:

1. publicar e compartilhar o asset com a service account de cada ambiente;
2. registrar e validar todas as propriedades e períodos da camada;
3. observar erros e latência do caminho GEE durante o rollout;
4. verificar painel, ranking e recortes territoriais;
5. remover as entradas `municipalAnalysis` e a etapa Drive/CSV apenas daquela
   camada.

O desligamento deve ser por camada. Manter o pipeline das fontes ainda não
migradas evita uma troca global arriscada.
