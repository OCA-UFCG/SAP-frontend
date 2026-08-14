# Estatísticas territoriais em assets do Earth Engine

## Objetivo e escopo atual

O runtime pode ler estatísticas de uma `FeatureCollection` do Google Earth
Engine (GEE) e convertê-las no mesmo patch `territorial-compact` já consumido
pelo painel. Isso remove, para as camadas migradas, a obrigação de exportar CSV
para o Google Drive e publicar entradas `municipalAnalysis` no Contentful.

A primeira fonte registrada é a camada `carbonoembrapa`:

```text
projects/obscaatinga/assets/Estatistica_Otimizada_Carbono_2020
```

Esta é uma migração incremental. O `panelLayer` do Contentful continua sendo a
fonte dos metadados da camada: classes, cores, templates, períodos, `imageId` e
configuração visual. As entradas estatísticas `municipalAnalysis` permanecem
como fallback temporário. Os shards `municipalReportSeries` e o índice de
disponibilidade dos relatórios ainda não foram migrados para GEE.

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
```

Definir `GEE_STATISTICS_ENABLED=false` desliga todas as fontes estatísticas GEE
e força o caminho legado. O ID do asset de carbono pode ser substituído por
ambiente sem alterar código.

## Fluxo sob demanda

O comportamento é sob demanda, semelhante ao raster, mas a resposta e o
processamento são diferentes:

```text
seleção de camada/período/território
  -> GET /api/municipal-analysis/{layer}?year={period}&locationKey={key}
  -> cache do servidor (layer + period + location)
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

`src/config/geeStatisticsLayers.ts` lista as camadas que o frontend deve tratar
como fontes GEE. `src/config/geeStatistics.ts` registra o asset e os nomes das
propriedades da tabela. Para adicionar uma fonte, é necessário declarar:

- o `panelLayerId` e o asset;
- propriedades de nível territorial, nome, código IBGE, UF, ano e data;
- propriedades percentuais na mesma ordem das classes do `panelLayer`;
- propriedades métricas opcionais a serem preservadas no repositório.

O adaptador valida números, quantidade de classes e duplicidade territorial.
Linhas cujas classes são todas zero são reconhecidas como ausência de
estatística e não viram distribuição no patch.

## Fallback e cache

Quando a camada está registrada e o GEE responde, o resultado é autoritativo,
inclusive quando não há valores para o recorte. Uma falha operacional de
autenticação, permissão, rede, avaliação ou contrato é registrada no servidor e
aciona a leitura equivalente no Contentful.

O cache em memória usa a chave `panelLayerId::year::locationKey`. O TTL padrão
é 10 minutos e o limite padrão é 200 entradas. Eles podem ser ajustados com
`MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS` e
`MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES`. Em uma implantação com múltiplas
instâncias, cada processo mantém seu próprio cache.

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
