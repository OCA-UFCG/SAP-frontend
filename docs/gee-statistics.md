# Estatísticas territoriais em assets do Earth Engine

## Objetivo e escopo atual

O runtime pode ler estatísticas de uma `FeatureCollection` do Google Earth
Engine (GEE) e convertê-las no mesmo patch `territorial-compact` já consumido
pelo painel. São duas formas de tabela: a **distribuição por classes**
(`gee-feature-collection`, descrita a seguir) e a **tabela municipal de valor
único** (`gee-municipal-value-table`, mais abaixo), em que a mesma
FeatureCollection é a estatística e o asset do mapa. Isso remove, para as camadas migradas, a obrigação de exportar CSV
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

## Segunda forma: tabela municipal de valor único

Nem toda estatística é uma distribuição por classes. Os dados socioeconômicos
chegam numa FeatureCollection **larga e só de municípios**: uma linha por
município, uma coluna por período (`2004`, `2005`, …, `2025`) e um número em
cada célula. A mesma FeatureCollection costuma ser também o asset do mapa, que a
desenha com `reduceToImage` sobre a coluna do período — é o que Ulisses Alencar
descreveu como "a estatística e o visualizador juntos".

Essa forma tem o `kind` `gee-municipal-value-table`, definido em
`src/contracts/geeMunicipalValueTable.ts`:

```json
{
  "kind": "gee-municipal-value-table",
  "asset": { "type": "fixed", "assetId": "projects/x/assets/pob_total" },
  "periodGranularity": "year",
  "valueProperty": "{year}",
  "aggregation": "mean",
  "properties": {
    "municipalityCode": "CD_MUN",
    "locationName": "NM_MUN",
    "stateCode": "SIGLA_UF"
  }
}
```

### Contrato mínimo dos assets

- uma linha por município, sem repetição, com o código IBGE de 7 dígitos;
- o nome do município e a UF — sigla (`PB`) ou nome (`Paraíba`), as duas grafias
  são aceitas por `resolveGeeStateCode`;
- uma coluna por período. `valueProperty` aceita `{year}`, `{month}` e
  `{period}`; numa FeatureCollection única ele **precisa** ter um placeholder,
  senão todos os períodos leriam a mesma coluna e a série sairia plana;
- nenhuma célula vazia nas colunas de período. Um vazio não estraga só aquele
  período: `reduceColumns` descarta a feature inteira, então o município some de
  todos os períodos e o total da UF sai menor sem nenhum erro. A validação do
  catálogo recusa a tabela por isso.

O período também pode vir do nome do asset (`pob_{year}` com uma coluna fixa
`valor`) ou dos dois lados ao mesmo tempo (`renda_{year}` com colunas
`mes_{month}`). `resolveValueTablePeriodColumns` junta as duas metades.

### Como Brasil e UFs são calculados

A tabela só tem municípios, então os demais níveis são derivados dentro do Earth
Engine com `reduceColumns`, agrupando por UF: `sum` para contagens (registros do
S2ID) e `mean` para percentuais (pobreza do CadÚnico). A escolha é do operador,
no catálogo, porque só ele sabe o que o número significa.

Conferido contra os valores que hoje estão no Contentful: `pob_total` em 2012 dá
`br` 70,26653619764559 e `pb` 79,99618240130047 pela média, e
`Municipios_S2ID_corrigido` em 2004 dá `br` 742 e `pb` 34 pela soma — os mesmos
números, com todas as casas decimais.

O recorte nacional volta em **uma** ida ao Earth Engine com o Brasil e as 27 UFs
de todos os períodos: 1,4 s medido em `pob_total` (14 anos) e 1,7 s em
`Municipios_S2ID_corrigido` (23 anos). Como a resposta é a mesma para qualquer
recorte agregado, ela fica no cache sob a chave `aggregates`, e trocar de UF ou
de período depois disso não custa ida nenhuma.

Recortes de **região, bioma, ASD e semiárido ficam sem valor** nesta forma: eles
exigiriam um cruzamento espacial que a tabela municipal não carrega. É o mesmo
comportamento que as camadas socioeconômicas legadas já têm hoje, e a validação
do catálogo devolve um aviso dizendo isso.

Um período incompatível com a granularidade da fonte é recusado quando é ele o
pedido, com a mesma mensagem do caminho classificatório. Os períodos vizinhos,
que pegam carona na leitura da série, continuam sendo descartados em silêncio —
não faz sentido derrubar o período pedido por causa de um vizinho inválido.

### O que o painel mostra

A camada tem **uma classe só** — o próprio indicador —, e `values` é um vetor de
um valor por território. As faixas coloridas pertencem à legenda do mapa
(`mapVisualization.legend` + `thresholds`), não à estatística. `valueConfig`
carrega a unidade (`registros`, `%`) e o formato do número.

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
