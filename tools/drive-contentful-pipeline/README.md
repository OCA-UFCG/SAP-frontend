# Drive CSV -> JSON -> Contentful

Esta pasta contem os scripts da pipeline que leva os CSVs gerados no Google
Earth Engine para entries `municipalAnalysis` no Contentful.

O fluxo tem tres etapas:

1. Baixar os CSVs do Google Drive para uma pasta local.
2. Converter os CSVs locais em JSONs particionados por `panelLayerId`.
3. Testar e publicar esses JSONs no Contentful.

Os arquivos gerados pela pipeline ficam em `data/contentful-pipeline` e nao
devem ser versionados. Eles sao saida local da pipeline.

## Comandos principais

### 1. Baixar do Drive e converter para JSON

```bash
npm run pipeline:drive-csv-json
```

Esse comando faz duas coisas em sequencia:

- baixa os CSVs da pasta configurada do Google Drive para
  `data/contentful-pipeline/csv`;
- converte os CSVs baixados para JSONs particionados em
  `data/contentful-pipeline/json/partitions`.

Use este comando quando quiser atualizar tudo a partir do Drive.

Por padrao, ele usa a pasta:

```text
1otPt3-bhLAIaIG15cFUp5wzFdt1ALNOr
```

Para usar outra pasta:

```bash
npm run pipeline:drive-csv-json -- \
  --folder-url "https://drive.google.com/drive/folders/..."
```

### 2. Converter CSV local para JSON particionado

```bash
npm run pipeline:drive-csv-json -- --skip-download
```

Esse comando nao acessa o Google Drive. Ele usa os CSVs que ja existem em
`data/contentful-pipeline/csv` e regrava os JSONs particionados em
`data/contentful-pipeline/json/partitions`.

Use este comando quando:

- os CSVs ja foram baixados antes;
- voce editou ou adicionou CSVs manualmente na pasta local;
- quer regenerar os JSONs sem depender do Drive.

Tambem e possivel informar pastas explicitamente:

```bash
npm run pipeline:drive-csv-json -- \
  --skip-download \
  --csv-dir caminho/para/csvs \
  --json-dir data/contentful-pipeline/json
```

### 3. Testar a publicacao no Contentful

Para testar todas as camadas sem alterar o Contentful:

```bash
npm run pipeline:contentful-municipal-analysis:dry-run-all
```

Esse comando le o manifesto gerado em
`data/contentful-pipeline/json/municipal-analysis-manifest.json` e mostra o que
seria criado ou atualizado no Contentful.

Ele nao publica nada.

Para testar apenas uma camada:

```bash
npm run pipeline:contentful-municipal-analysis -- \
  --panel-layer-id CDI_Test \
  --sync-partitions \
  --dry-run
```

### 4. Publicar no Contentful

Para publicar todas as camadas mapeadas no manifesto:

```bash
npm run pipeline:contentful-municipal-analysis:publish-all
```

Esse comando:

- le os JSONs particionados gerados na etapa anterior;
- cria ou atualiza uma entry `municipalAnalysis` por particao;
- publica cada entry;
- espera um pequeno intervalo entre escritas para reduzir erros do Contentful;
- tenta novamente automaticamente respostas temporarias como `429`, `500`,
  `502`, `503` e `504`.

Para publicar apenas uma camada:

```bash
npm run pipeline:contentful-municipal-analysis -- \
  --panel-layer-id CDI_Test \
  --sync-partitions \
  --publish
```

## Arquivos gerados

Depois da conversao, a estrutura principal fica assim:

```text
data/contentful-pipeline/
  csv/
    arquivos baixados do Drive
  json/
    conversion-report.json
    municipal-analysis-manifest.json
    partitions/
      municipal-analysis.<panelLayerId>.<particao>.municipality.imageData.json
```

Arquivos importantes:

- `csv/`: CSVs baixados do Google Drive ou colocados localmente.
- `json/partitions/`: JSONs que serao enviados ao Contentful.
- `json/conversion-report.json`: relatorio detalhado da conversao.
- `json/municipal-analysis-manifest.json`: lista as particoes geradas e o
  `panelLayerId` de destino de cada uma.

## Variaveis de ambiente

Para baixar arquivos do Drive:

```bash
GOOGLE_DRIVE_ACCESS_TOKEN
GOOGLE_DRIVE_API_KEY
GOOGLE_DRIVE_FOLDER_ID
```

Normalmente basta `GOOGLE_DRIVE_ACCESS_TOKEN`. Se token e API key nao forem
informados, o script tenta obter um token com:

```bash
gcloud auth print-access-token
```

Se o token nao tiver permissao de Drive, refaca o login:

```bash
gcloud auth login --enable-gdrive-access --force
```

Para publicar no Contentful:

```bash
CONTENTFUL_MANAGEMENT_TOKEN
CONTENTFUL_SPACE_ID
CONTENTFUL_ENVIRONMENT
CONTENTFUL_ACCESS_TOKEN
```

As variaveis `NEXT_PUBLIC_CONTENTFUL_*` tambem sao aceitas como fallback local
quando ja existem no projeto.

## Como os arquivos sao mapeados para camadas

O script identifica a camada a partir de palavras-chave no nome do CSV.

| Palavra no nome do arquivo     | `panelLayerId`      |
| ------------------------------ | ------------------- |
| `Carbono`                      | `carbonoembrapa`    |
| `CDI`                          | `CDI_Test`          |
| `CobTerra` ou `CoberturaTerra` | `terraibge`         |
| `GPP`                          | `prodprimariabruta` |
| `IA`                           | `indicearidez`      |
| `IDT`                          | `deg`               |
| `ODS`                          | `ods`               |
| `cemaden`                      | `cemadenseca`       |
| `ANA`                          | `anaseca`           |

Arquivos que nao casam com essas regras entram como `unmapped` no manifesto e
nao sao publicados pelos comandos `dry-run-all` e `publish-all`.

## Como os JSONs sao particionados

O Contentful nao aceita objetos JSON muito grandes. Por isso, a pipeline nao
gera um unico JSON gigante por camada.

Ela gera particoes menores:

- normalmente uma particao por ano;
- se o ano ainda ficar grande demais, uma particao por chave temporal, como
  `2021-01`.

Cada particao e comprimida sem perda em um envelope:

```json
{
  "type": "territorial-compact-compressed",
  "encoding": "gzip+base64"
}
```

O limite padrao por JSON gerado e `450000` bytes:

```bash
npm run pipeline:drive-csv-json -- --max-contentful-json-bytes 450000
```

Para depuracao local, e possivel gravar particoes sem compressao:

```bash
npm run pipeline:drive-csv-json -- --skip-download --write-raw-partitions
```

## Relacao com `panelLayer`

`municipalAnalysis` guarda os dados municipais ou estaduais usados no
detalhamento.

O asset do Google Earth Engine usado para visualizar a camada no mapa continua
vindo do `panelLayer`.

Por isso, se existir dado municipal para `2026-03`, mas o `panelLayer` da camada
so tiver asset ate `2026-02`, a aplicacao so exibira ate `2026-02`. A pipeline
de `municipalAnalysis` nao cria assets no `panelLayer`.

## Entries antigas no Contentful

Quando o modo particionado encontra entries antigas com o mesmo `panelLayerId`
que nao correspondem mais ao manifesto atual, elas nao sao apagadas.

O script altera o `panelLayerId` dessas entries para:

```text
<panelLayerId>_legacy_disabled
```

Isso evita que o frontend misture dados antigos com os dados particionados
atuais.

## Contrato esperado do CSV

Para municipios:

- `CD_MUN`
- `NM_MUN`
- `SIGLA_UF`
- `data_img` no formato `YYYY-MM-DD`
- `perc_classe_0`, `perc_classe_1`, ... ou `area_ha_classe_N` com
  `area_total_ha`

Para estados:

- `SIGLA_UF`
- `NM_UF` ou `NOME_UF`
- `data_img` no formato `YYYY-MM-DD`
- `perc_classe_0`, `perc_classe_1`, ... ou `area_ha_classe_N` com
  `area_total_ha`

Os arrays em `years[*].values` seguem a ordem numerica das colunas
`perc_classe_N` ou `area_ha_classe_N`.

## Como o frontend consome esses dados

A pipeline apenas gera e publica entries `municipalAnalysis`. O frontend nao
carrega todas essas entries quando o usuario abre `/platform`.

O fluxo atual e lazy:

1. `/platform` carrega os `panelLayer` base.
2. Quando o usuario abre a analise de uma camada, o client chama
   `/api/municipal-analysis/<panelLayerId>`.
3. Essa rota roda no servidor Next.js, busca no Contentful apenas os
   `municipalAnalysis` daquele `panelLayerId`, descomprime os payloads
   `gzip+base64`, faz merge com o `imageData` do `panelLayer` e devolve o
   resultado ao client.

Para reduzir chamadas ao Contentful e evitar descompressao repetida, a rota usa
cache em memoria no servidor por `panelLayerId`.

Comportamento padrao:

- TTL: `600` segundos.
- Limite: `20` camadas em cache por processo Node.
- Requests concorrentes para a mesma camada compartilham a mesma busca.
- Erros de busca/descompressao nao ficam cacheados.
- Cada replica do servidor tem seu proprio cache em memoria.

Variaveis para ajuste:

```bash
MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS=600
MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES=20
```

Depois de publicar novos dados no Contentful, a aplicacao pode levar ate o TTL
do cache para refletir a atualizacao em uma instancia que ja tinha aquela camada
em memoria. Reiniciar o servidor ou reduzir temporariamente o TTL acelera a
validacao manual.
