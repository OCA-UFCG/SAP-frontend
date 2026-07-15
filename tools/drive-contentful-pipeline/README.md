# Drive CSV -> JSON -> Contentful

Esta pasta contem os scripts da pipeline que leva os CSVs gerados no Google
Earth Engine para entries `panelLayer` e `municipalAnalysis` no Contentful.

O fluxo tem tres etapas:

1. Baixar os CSVs do Google Drive para uma pasta local.
2. Converter os CSVs locais em JSONs de `panelLayer.imageData` e particoes de
   `municipalAnalysis`.
3. Testar e publicar esses JSONs no Contentful.

Os arquivos gerados pela pipeline ficam em `data/contentful-pipeline` e nao
devem ser versionados. Eles sao saida local da pipeline.

A configuracao versionada da pipeline fica em:

```text
tools/drive-contentful-pipeline/config/pipeline-config.json
```

Esse arquivo define `schemaVersion`, a pasta padrao do Drive, paths locais,
limites de payload, regras de mapeamento dos nomes de CSV para `panelLayerId` e
os perfis usados para gerar `panelLayer.imageData`.

## Estrutura da pipeline

Os arquivos `.mjs` na raiz desta pasta sao apenas entrypoints de CLI. Eles
mantem os comandos `npm run pipeline:*` estaveis e delegam o trabalho para
modulos pequenos em `lib/`.

```text
tools/drive-contentful-pipeline/
  config/
    pipeline-config.json
  lib/
    cli/
    config/
    contentful/
    conversion/
    csv/
    drive/
    io/
    shared/
    validation/
```

Responsabilidades principais:

- `config/`: configuracao versionada de origem, limites, mapeamentos e perfis
  de camadas.
- `lib/cli/`: parsing de flags e orquestracao dos comandos publicos.
- `lib/config/`: leitura e validacao de `pipeline-config.json`, incluindo
  compilacao dos padroes de nome de arquivo.
- `lib/drive/`: listagem e download dos CSVs no Google Drive.
- `lib/csv/`: parsing de CSV, deteccao de territorio, colunas de classe,
  anos/referencias e mapeamento de arquivo para `panelLayerId`.
- `lib/conversion/`: transformacao dos CSVs em `imageData`, escrita de
  particoes, manifestos e relatorio de conversao.
- `lib/contentful/`: cliente comum do Contentful, leitura de ambiente,
  `PATCH`/create/publish de entries e sync de `panelLayer`/`municipalAnalysis`.
- `lib/validation/`: validacao dos payloads e manifestos usados nos dry-runs e
  nos testes.
- `lib/shared/` e `lib/io/`: helpers pequenos de path, JSON e objetos.

A ideia e que regra de negocio ou contrato reutilizavel fique em `lib/`, e que
os entrypoints da raiz continuem pequenos para preservar a interface publica sem
concentrar toda a pipeline em um arquivo unico.

## Comandos principais

### 0. Fechar ciclo completo com relatório

```bash
npm run pipeline:full-cycle -- --skip-download
```

Esse comando orquestra o ciclo operacional completo:

- baixa os CSVs do Drive, exceto quando `--skip-download` for usado;
- converte CSVs em JSONs e manifestos;
- sincroniza `panelLayer.imageData` em modo dry-run por padrão;
- sincroniza partições `municipalAnalysis` em modo dry-run por padrão;
- grava um relatório consumível em JSON e Markdown.

Por padrão, o comando não escreve no Contentful. Para publicar:

```bash
npm run pipeline:full-cycle -- --skip-download --publish
```

O relatório padrão é gravado em:

```text
data/contentful-pipeline/json/pipeline-full-cycle-report.json
data/contentful-pipeline/json/pipeline-full-cycle-report.md
```

Use `--report-path caminho/relatorio.json` para escolher outro destino.

Para validar a rota publicada, informe a URL do runtime e um cookie de sessão,
porque `/api/municipal-analysis/[panelLayerId]` é protegida:

```bash
npm run pipeline:full-cycle -- \
  --skip-download \
  --runtime-base-url https://seu-runtime.example \
  --session-cookie-env SEDES_RUNTIME_COOKIE \
  --require-runtime-smoke
```

O smoke test chama amostras de
`/api/municipal-analysis/<panelLayerId>?year=<yearKey>` usando o manifesto
gerado. Use `--smoke-limit 10` para alterar a quantidade de rotas testadas.

### 1. Verificar a pipeline inteira

```bash
npm run pipeline:verify
```

Esse comando e o gate operacional antes de publicar. Ele:

- converte os CSVs locais de `data/contentful-pipeline/csv`;
- regrava os manifestos e o `conversion-report.json`;
- imprime uma tabela curta de cobertura por `panelLayerId`;
- roda dry-run de todos os `panelLayer`;
- roda dry-run de todas as particoes `municipalAnalysis`;
- falha se a conversao local, os manifestos ou os dry-runs tiverem erros
  bloqueantes.

Para validar somente a conversao local, sem acessar o Contentful:

```bash
npm run pipeline:verify -- --local-only
```

### 2. Baixar do Drive e converter para JSON

```bash
npm run pipeline:drive-csv-json
```

Esse comando faz duas coisas em sequencia:

- baixa os CSVs da pasta configurada do Google Drive para
  `data/contentful-pipeline/csv`;
- converte os CSVs baixados para JSONs de `panelLayer.imageData` em
  `data/contentful-pipeline/json/panel-layers`;
- converte os CSVs municipais/estaduais para JSONs particionados em
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

### 3. Converter CSV local para JSON particionado

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

### 4. Testar a publicacao dos `panelLayer`

Para testar todos os `panelLayer.imageData` gerados sem alterar o Contentful:

```bash
npm run pipeline:contentful-panel-layer:dry-run-all
```

Para testar apenas uma camada:

```bash
npm run pipeline:contentful-panel-layer -- \
  --panel-layer-id pob_total \
  --dry-run
```

### 5. Publicar os `panelLayer`

Para publicar todos os `panelLayer.imageData` gerados:

```bash
npm run pipeline:contentful-panel-layer:publish-all
```

Para publicar apenas uma camada:

```bash
npm run pipeline:contentful-panel-layer -- \
  --panel-layer-id pob_total \
  --publish
```

Esse comando atualiza o campo `imageData` da entry `panelLayer` cujo campo `id`
bate com `--panel-layer-id`.

### 6. Testar a publicacao das particoes `municipalAnalysis`

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

### 7. Publicar as particoes `municipalAnalysis`

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
    panel-layer-imageData-manifest.json
    panel-layers/
      panel-layer.<panelLayerId>.imageData.json
    partitions/
      municipal-analysis.<panelLayerId>.<particao>.municipality.imageData.json
```

Arquivos importantes:

- `csv/`: CSVs baixados do Google Drive ou colocados localmente.
- `json/panel-layers/`: JSONs que serao enviados ao campo `imageData` de
  `panelLayer`.
- `json/partitions/`: JSONs que serao enviados a entries `municipalAnalysis`.
- `json/conversion-report.json`: relatorio detalhado da conversao.
- `json/municipal-analysis-manifest.json`: lista as particoes geradas e o
  `panelLayerId` de destino de cada uma.
- `json/panel-layer-imageData-manifest.json`: lista os JSONs gerados para
  atualizar `panelLayer.imageData`.

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
para leitura, quando ja existem no projeto. Para escrita via Management API,
use apenas `CONTENTFUL_MANAGEMENT_TOKEN`.

## Como os arquivos sao mapeados para camadas

O script identifica a camada a partir de padrões declarados em
`config/pipeline-config.json`. Para adicionar ou ajustar uma camada, altere
`layerRules` e, quando a camada tambem gerar `panelLayer.imageData`, o perfil
correspondente em `panelLayerProfiles`.

O campo `schemaVersion` versiona esse contrato de configuracao. A pipeline
rejeita versoes desconhecidas para evitar interpretar uma configuracao nova com
codigo antigo.

| Palavra no nome do arquivo     | `panelLayerId`               |
| ------------------------------ | ---------------------------- |
| `Carbono`                      | `carbonoembrapa`             |
| `CDI`                          | `CDI_Test`                   |
| `CobTerra` ou `CoberturaTerra` | `terraibge`                  |
| `GPP`                          | `prodprimariabruta`          |
| `IA`                           | `indicearidez`               |
| `IDT`                          | `deg`                        |
| `ODS`                          | `ods`                        |
| `cemaden`                      | `cemadenseca`                |
| `ANA`                          | `anaseca`                    |
| `pob_urb` ou `pobreza urbana`  | `pob_urb`                    |
| `pob_rural` ou `pobreza rural` | `pob_rural`                  |
| `S2ID` ou `secas estiagens`    | `s2id_secas_estiagens`       |
| `pob` ou `populacao`           | `pob_total`                  |
| `Prev` ou `previsao_P`         | `prev_anomalia_precipitacao` |

Arquivos municipais/estaduais que nao casam com essas regras entram como
`unmapped` no manifesto e nao sao publicados pelos comandos `dry-run-all` e
`publish-all`.

CSVs de `panelLayer` usam outro contrato: precisam ter `location_key`,
`location_name`, `ano` e `valor_classe_N`. A camada
`prev_anomalia_precipitacao` usa `Prev` como identificador no nome do arquivo e
o script `scripts/gee/anomalia-precip.js` gera o CSV de `panelLayer` com as
faixas de anomalia de precipitacao prevista. A visualizacao no SEDES usa os
limiares `[-90, -30, 0, 30, 90]` para reclassificar o raster continuo em 6
classes antes de aplicar a paleta. Para `pob_total`, a pipeline tambem
valida que `valor_classe_N` esteja no intervalo `0..100`, porque o asset do GEE
visualizado no mapa usa essa escala. Nessa camada, o valor representa o
percentual de familias inscritas no CadUnico que se encontram em situacao de
pobreza, nao o percentual de todas as familias do territorio. Se o CSV tiver
valores somados por estado, a conversao falha antes de gerar um JSON publicavel.
A legenda publicada para `pob_total` usa apenas faixas dentro dessa escala:
`0-20`, `20-40`, `40-60`, `60-80` e `80-100`.

As camadas `pob_urb` e `pob_rural` usam o mesmo contrato percentual e o
intervalo 2012-2025. A camada `s2id_secas_estiagens` usa a quantidade anual de
registros municipais entre 2004 e 2025. O Detalhamento exibe contagens anuais
absolutas; estados e Brasil usam a soma dos registros dos seus municipios. No
mapa, a propriedade `suma` representa o total municipal acumulado e usa a
escala continua de 0 a 30. Anos sem nenhum registro em todo o Brasil sao
omitidos, pois representam lacunas da fonte e nao ocorrencias anuais iguais a
zero.

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

Quando houver CSV de `panelLayer`, publique primeiro o `panelLayer.imageData` e
depois as particoes `municipalAnalysis`. Assim a validacao de anos das
particoes encontra os anos recem-publicados no `panelLayer`.

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

## Metadados das particoes

Ao publicar particoes, o script garante que o content type `municipalAnalysis`
tenha os campos:

- `partitionKey`
- `calendarYear`
- `territory`

Esses campos permitem que o frontend busque somente a particao necessaria para
o periodo selecionado. Em `--dry-run`, o script nao altera o content model; ele
apenas valida o que seria publicado.

O script tambem consulta o `panelLayer` correspondente e reporta
`missingPanelLayerYears` quando existe dado municipal para um `yearKey`, mas o
`panelLayer.imageData` ainda nao tem asset/ano compativel. Nesse caso, a entry
pode ser publicada, mas a aplicacao nao conseguira exibir aquele periodo ate o
`panelLayer` ser atualizado.

Antes de sincronizar particoes, o script valida o manifesto contra duplicidades,
particoes ambiguas para a rota (`panelLayerId + partitionKey`), campos
obrigatorios, arquivos ausentes e formato do `imageData`. Envelopes
`gzip+base64` tambem sao descomprimidos no dry-run para confirmar que carregam
um payload `territorial-compact` com `years`. Essas validacoes bloqueiam a
publicacao quando indicam que a estrutura enviada ao Contentful esta
inconsistente.

## Contrato esperado do CSV

Para municipios:

- `CD_MUN`
- `NM_MUN`
- `SIGLA_UF`
- `data_img` no formato `YYYY-MM-DD`
- `perc_classe_0`, `perc_classe_1`, ... para percentuais; ou
  `valor_classe_0`, `valor_classe_1`, ... para valores absolutos; ou
  `area_ha_classe_N` com `area_total_ha`

Para estados:

- `SIGLA_UF`
- `NM_UF` ou `NOME_UF`
- `data_img` no formato `YYYY-MM-DD`
- `perc_classe_0`, `perc_classe_1`, ... para percentuais; ou
  `valor_classe_0`, `valor_classe_1`, ... para valores absolutos; ou
  `area_ha_classe_N` com `area_total_ha`

Os arrays em `years[*].values` seguem a ordem numerica das colunas
`perc_classe_N`, `valor_classe_N` ou `area_ha_classe_N`.

## Como o frontend consome esses dados

A pipeline apenas gera e publica entries `municipalAnalysis`. O frontend nao
carrega todas essas entries quando o usuario abre `/platform`.

O fluxo atual e lazy:

1. `/platform` carrega os `panelLayer` base.
2. Quando o usuario abre a analise de uma camada ou troca o periodo, o client
   chama `/api/municipal-analysis/<panelLayerId>?year=<yearKey>`.
3. Essa rota roda no servidor Next.js, busca no Contentful a particao daquele
   periodo, descomprime o payload `gzip+base64`, faz merge com o ano
   correspondente do `panelLayer` e devolve ao client apenas aquele recorte de
   `imageData`.

A rota ainda aceita `/api/municipal-analysis/<panelLayerId>` sem `year` como
fallback de compatibilidade, mas o fluxo normal da aplicacao usa a chamada por
periodo para evitar payload grande no primeiro acesso de uma camada.

Para reduzir chamadas ao Contentful e evitar descompressao repetida, a rota usa
cache em memoria no servidor por `panelLayerId + yearKey`.

Comportamento padrao:

- TTL: `600` segundos.
- Limite: `20` recortes camada/periodo em cache por processo Node.
- Requests concorrentes para a mesma camada e periodo compartilham a mesma
  busca.
- Erros de busca/descompressao nao ficam cacheados quando nao ha valor anterior.
- Se uma recarga falhar depois do TTL e ja existir valor antigo para a chave, a
  rota pode servir esse valor expirado como fallback enquanto a proxima chamada
  tenta carregar novamente.
- Cada replica do servidor tem seu proprio cache em memoria.

Variaveis para ajuste:

```bash
MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS=600
MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES=20
```

Depois de publicar novos dados no Contentful, a aplicacao pode levar ate o TTL
do cache para refletir a atualizacao em uma instancia que ja tinha aquele
recorte em memoria. Reiniciar o servidor ou reduzir temporariamente o TTL
acelera a validacao manual.
