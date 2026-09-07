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

#### Um município é lido junto com a UF inteira

Pelo mesmo motivo, o filtro de um município não é o do código pedido, e sim o
dos municípios daquela UF (`resolveStatisticsReadScope`). Medido no ERA5-Land,
45 anos:

| Como se pede                     | Tempo    | Linhas | Municípios servidos |
| -------------------------------- | -------- | -----: | ------------------: |
| só o município `2510808` (Patos) | 2 985 ms |     45 |                   1 |
| todos os municípios da Paraíba   | 3 122 ms | 10 035 |                 223 |

137 ms a mais servem 223 municípios em vez de um, e a chave do cache passa a ser
a UF. Sem isso, cada município novo pagava a série inteira de novo — o relatório
municipal gastava de 4 a 8 s de Earth Engine por município.

O recorte é sempre pelos dois primeiros dígitos do código do IBGE, que
identificam a UF. `NM_UF` não serve para isso porque a coluna guarda ora a sigla,
ora o nome do estado, dependendo da tabela.

As linhas dos demais municípios são descartadas em `loadGeeStatisticsRows`, antes
de qualquer mapeamento: `mapGeeStatisticsRows` continua recebendo exatamente as
linhas do território pedido, então uma linha inválida de outro município não
derruba a leitura.

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

### O teto de 5000 feições por pedido

O Earth Engine recusa qualquer consulta que acumule mais de 5000 feições, com
`Collection query aborted after accumulating over 5000 elements`. O teto vale por
pedido, e a leitura municipal traz uma linha por município da UF em cada asset do
bloco — então o número de assets que podem viajar juntos depende do tamanho do
estado. Medido no índice de aridez do ERA5-Land, com blocos de 15:

| Estado            | Municípios | Blocos de 15 |
| ----------------- | ---------- | ------------ |
| Minas Gerais      | 853        | falha        |
| São Paulo         | 645        | falha        |
| Rio Grande do Sul | 499        | falha        |
| Bahia             | 417        | falha        |
| Paraná            | 399        | falha        |
| Paraíba           | 223        | 3198 ms      |
| Pernambuco        | 185        | 4311 ms      |

`getStatisticsRowsBatchSize` resolve isso reduzindo o bloco a 5 assets na leitura
municipal — o que cabe no maior estado, com 853 municípios. O teto usa sempre o
maior estado, e não o estado pedido: errar para baixo custa alguns segundos na
primeira leitura daquele estado (a Bahia sai em 5533 ms com blocos de 5, contra
3784 ms com blocos de 8), enquanto errar para cima derruba o relatório inteiro.
Os demais territórios continuam em blocos de 15, porque `br` traz 28 linhas por
asset e os agregados trazem menos.

Ler o Brasil inteiro numa entrada só de cache não é possível por esse caminho:
um único asset já tem 5573 linhas municipais. O que escapa do teto é agregar as
colunas no lado do Earth Engine (`reduceColumns`), mas aí a agregação descarta os
valores nulos e as colunas deixam de descrever a mesma linha — no asset de 1980,
3 municípios têm nulo em alguma coluna pedida, o que atribuiria os valores ao
município errado. Preencher os nulos antes de agregar corrige o alinhamento e
custa 11 933 ms por bloco de 15, contra 4207 ms sem preencher, além de 142 MB de
heap por camada. Por isso a leitura ficou no recorte estadual.

Quem passa a lista de períodos é o chamador: `attachMunicipalAnalysisYearToPanelLayer`
usa as chaves de `imageData.years`, e a prévia do catálogo usa
`validation.inferred.periods`. Sem essa lista o comportamento é o antigo, uma
leitura só do período pedido.

A publicação do catálogo limpa esse cache junto com os demais, em
`refreshPublicIndexCaches`. O teto tem duas partes, porque as entradas diferem em
duas ordens de grandeza (45 linhas para um período, de 8 mil a 38 mil para uma
UF): `GEE_STATISTICS_ROWS_CACHE_MAX_ENTRIES` limita quantas entradas cabem e
`GEE_STATISTICS_ROWS_CACHE_MAX_ROWS` limita o total de linhas guardadas. A
evicção é LRU e respeita os dois. O teto de linhas está em 120 mil porque 250 785
linhas de 16 colunas ocupam 142 MB de heap medidos (~0,58 KiB por linha), então
120 mil custam ~70 MB — a mesma faixa das 200 entradas de ~400 KiB do cache de
`municipalAnalysis`. Cabem juntos os cinco estados semiáridos com mais
municípios na camada mais pesada (83 790 linhas).

A validade é de doze horas
(`GEE_STATISTICS_ROWS_CACHE_TTL_SECONDS`), e não os dez minutos dos caches de
conteúdo. A diferença é a natureza do dado: um asset estatístico é publicado, e
muda quando alguém republica o índice, enquanto uma entrada do Contentful muda a
qualquer hora do dia. Como a publicação do catálogo limpa este cache, uma
republicação continua aparecendo na hora; o que a validade longa atrasa é apenas
a atualização feita direto no Earth Engine, fora da plataforma.

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
