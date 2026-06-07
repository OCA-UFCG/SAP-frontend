# Drive CSV to Contentful JSON

Primeira etapa da pipeline Google Drive -> Contentful.

Ela baixa CSVs de uma pasta do Google Drive para uma pasta local, converte os
dados para `imageData` e grava particoes por `panelLayerId` no formato
consumido pelos objetos territoriais do Contentful, como `municipalAnalysis`.

## Uso com Google Drive

```bash
npm run pipeline:drive-csv-json
```

Se `GOOGLE_DRIVE_ACCESS_TOKEN` e `GOOGLE_DRIVE_API_KEY` nao forem informados, o
script tenta obter um token com `gcloud auth print-access-token`.

Se o `gcloud` responder `invalid_scope` ou `ACCESS_TOKEN_SCOPE_INSUFFICIENT`,
refaca o login autorizando acesso ao Drive:

```bash
gcloud auth login --enable-gdrive-access --force
```

Por padrao, a pasta do Drive usada e:

```text
1otPt3-bhLAIaIG15cFUp5wzFdt1ALNOr
```

Tambem e possivel informar outra pasta:

```bash
npm run pipeline:drive-csv-json -- --folder-url "https://drive.google.com/drive/folders/..."
```

Para pastas publicas, `GOOGLE_DRIVE_API_KEY` tambem pode ser usado no lugar do
token OAuth.

## Uso com CSV local

```bash
npm run pipeline:drive-csv-json -- \
  --skip-download \
  --csv-dir caminho/para/csvs \
  --json-dir data/contentful-pipeline/json
```

## Saidas

- CSVs baixados: `data/contentful-pipeline/csv`
- JSONs particionados: `data/contentful-pipeline/json/partitions`
- Relatorio: `data/contentful-pipeline/json/conversion-report.json`
- Manifesto para a proxima etapa: `data/contentful-pipeline/json/municipal-analysis-manifest.json`

Esses arquivos sao gerados localmente e ficam fora do Git via `.gitignore`.
Versione apenas o codigo da pipeline e gere novamente os dados quando precisar.
Os nomes de municipios nao sao repetidos nos JSONs gerados: o frontend usa
`src/data/citiesIndex.json`, ja versionado, para resolver labels municipais, e
`statesObj` para labels estaduais.

As particoes sao gravadas comprimidas por padrao, em um envelope JSON com
`type: "territorial-compact-compressed"` e `encoding: "gzip+base64"`. A
compressao e sem perda; o frontend decodifica o conteudo antes de mesclar com
o `panelLayer`. O script tenta escrever uma particao por ano calendario, mas se
o arquivo comprimido passar do limite configurado ele divide automaticamente em
particoes menores por chave temporal, por exemplo `2021-01`.

O limite padrao por arquivo e `450000` bytes, deixando margem pratica para o
limite de 1 MB do Contentful e para falhas do Management API com objetos muito
proximos do limite:

```bash
npm run pipeline:drive-csv-json -- --max-contentful-json-bytes 450000
```

Se precisar inspecionar o JSON sem compressao durante depuracao local, use
`--write-raw-partitions`.

O fluxo padrao nao escreve JSONs agregados grandes. Se precisar gerar um
agregado para depuracao local, use `--write-aggregates`.

Arquivos baixados que nao sejam municipio ou estado sao pulados e registrados
em `skipped` no relatorio. Isso evita que um CSV regional interrompa a
conversao dos dados municipais.

## Mapeamento para panelLayer

O script tambem gera um manifesto ligando cada JSON convertido ao
`panelLayerId` que deve receber o `municipalAnalysis` no Contentful. A regra
inicial usa palavras-chave no nome do CSV:

- `CDI` -> `CDI_Test`
- `GPP` -> `prodprimariabruta`
- `CobTerra` ou `CoberturaTerra` -> `terraibge`
- `Carbono` -> `carbonoembrapa`
- `IA` -> `indicearidez`
- `IDT` -> `deg`
- `ODS` -> `ods`
- `cemaden` -> `cemadenseca`
- `ANA` -> `anaseca`

Arquivos que nao casam com essas regras entram em `unmapped` no manifesto.

## Teste/update no Contentful

Para localizar o `municipalAnalysis` existente e validar o payload gerado sem
alterar o Contentful:

```bash
npm run pipeline:contentful-municipal-analysis -- --panel-layer-id CDI_Test --dry-run
```

O modo antigo de atualizar um unico `imageData` agregado continua disponivel
apenas quando um caminho for informado manualmente ou quando a geracao for feita
com `--write-aggregates`. Defina `CONTENTFUL_MANAGEMENT_TOKEN` no ambiente e
rode sem `--dry-run`:

```bash
npm run pipeline:contentful-municipal-analysis -- --panel-layer-id CDI_Test
```

O update usa JSON Patch no campo `imageData`. Use `--publish` para publicar a
entry depois da atualizacao.

Para payloads grandes, use o modo particionado. Ele cria/atualiza uma entry por
particao do manifesto, todas com o mesmo `panelLayerId`; o frontend mescla
essas entries em tempo de leitura:

```bash
npm run pipeline:contentful-municipal-analysis -- \
  --panel-layer-id CDI_Test \
  --sync-partitions \
  --dry-run
```

Para gravar e publicar as particoes:

```bash
npm run pipeline:contentful-municipal-analysis -- \
  --panel-layer-id CDI_Test \
  --sync-partitions \
  --publish
```

Para revisar todas as camadas mapeadas no manifesto sem alterar o Contentful:

```bash
npm run pipeline:contentful-municipal-analysis:dry-run-all
```

Para publicar todas as camadas mapeadas no manifesto:

```bash
npm run pipeline:contentful-municipal-analysis:publish-all
```

Esse comando cria ou atualiza uma entry por particao e publica cada uma. Entre
os writes ele faz uma pausa curta e tambem tenta novamente respostas
temporarias do Contentful, como `429`, `500`, `502`, `503` e `504`.
Entries antigas com o mesmo `panelLayerId` que nao correspondem mais a uma
particao do manifesto nao sao apagadas; elas tem o `panelLayerId` alterado para
`<panelLayerId>_legacy_disabled`, evitando que o frontend mescle dados antigos
com os dados particionados atuais.

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
