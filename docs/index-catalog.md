# Catálogo de índices baseado em assets GEE

O catálogo administrativo fica em `/platform?view=catalog`. Ele exige sessão
Firebase, a allowlist `LOGS_ALLOWED_EMAILS`, same-origin nas mutações e
`Idempotency-Key` em prévia, publicação e ciclo de vida.

## O que é publicado

Um índice v2 publica somente um `panelLayer` no Contentful:

- metadados (nome, descrição, categoria e posição);
- `imageData` leve, com classes, períodos, templates, mapa e `values: {}`;
- `statisticsSource`, contrato versionado da FeatureCollection estatística;
- `catalogConfig` v2, usado pelo formulário e pela auditoria;
- `reportConfig`, opcional, com o texto do Relatório Automático daquele índice
  (`src/contracts/panelLayerReport.ts`).

Os valores territoriais continuam no GEE e são consultados sob demanda. O
catálogo não busca Google Drive, não lê ou grava CSV, não executa o conversor e
não cria `municipalAnalysis` nem `municipalReportSeries`. As pipelines globais
continuam no repositório apenas para índices legados fora deste catálogo.

O Relatório Automático **consome** um índice do catálogo: as camadas são
descobertas a partir do próprio `panelLayer`, os valores territoriais vêm do GEE
pelo `locationKey` e a disponibilidade de período é decidida pelos períodos
publicados, e não pelo `municipalAvailabilityIndex.json` gerado no build — que
só conhece os índices legados. O texto pode vir do `reportConfig` (ver
"Texto do relatório" abaixo) em vez do Google Docs.

Continuam fora do catálogo: as séries `municipalReportSeries`, o índice de
disponibilidade gerado no build e a geração de PDF.

## Índice criado a partir de uma planilha do Google

Nem toda base territorial chega ao Earth Engine. Para as que vivem numa planilha
— PIB, IDHM e afins —, o formulário oferece a forma **"Planilha do Google"**: o
operador cola o link, diz qual dado da planilha usar e como os territórios
maiores somam. Não há asset, banda nem propriedade a informar.

### A convenção da planilha

Uma aba só (a primeira), uma linha por município, e duas famílias de colunas:

- **territoriais, de nome fixo**: `CD_MUN`, `NM_MUN`, `SIGLA_UF`, `NM_UF`,
  `NM_REGIAO`, `BIOMA_PRED`, `SEMIÁRIDO` (`Sim`/`Não`), `ASD_ENTORN`
  (`ASD`/`Entorno`/`Não`). Só as três primeiras são obrigatórias; as demais
  habilitam os recortes agregados. A comparação ignora acento e caixa.
- **de dado, terminadas em `_{ano}`**: `pib_2010`, `pib_2020`, `pib_2023`. O
  prefixo escolhido no formulário separa os indicadores de uma planilha que
  traga mais de um, e cada coluna vira um período do índice.

Uma linha sem código IBGE de 7 dígitos é descartada (é o rodapé com a fonte do
dado), e uma célula vazia vira "sem dado" — diferente de zero, e contada num
aviso da validação.

Uma coluna de dado pode chegar formatada como texto — acontece sempre que a base
veio de um CSV importado —, e aí o separador decimal precisa ser descoberto. A
decisão é da **coluna inteira**, nunca da célula: `1.046.342,5` prova que o ponto
é milhar, `1,046,342.5` prova o contrário, e `0.763` sozinho é decimal. Quando
nada na coluna decide (todas as células no formato `2.500`), o ponto é lido como
decimal e a validação devolve o aviso `spreadsheet_ambiguous_decimal` dizendo
qual coluna e qual célula — em vez de escolher em silêncio e entregar todo
município multiplicado ou dividido por mil.

### As faixas de cor detectadas da planilha

As faixas da legenda não vêm da planilha como coluna: elas descrevem a
distribuição dos valores. O botão **"Detectar faixas da planilha"**, na seção
"Faixas de cor do mapa", pede `POST /api/index-catalog/spreadsheet-legend` com a
fonte que está no formulário e devolve limites, rótulos e cores prontos.

- O corte é por **quantis** sobre os municípios do período mais recente: cada
  cor fica com mais ou menos o mesmo número de municípios. Dividir o intervalo
  em partes iguais não serve para dado municipal brasileiro — o maior PIB é
  milhares de vezes o mediano, e o país inteiro cairia na primeira cor.
  `detectValueLegend` só cai no corte por intervalos iguais quando os valores se
  repetem tanto que os quantis coincidem, e a tela diz qual dos dois usou.
- Só os municípios entram na conta. O instantâneo também guarda Brasil, UFs,
  regiões, biomas, ASD e semiárido, e uma soma estadual é ordens de grandeza
  maior que a de qualquer município dela.
- Cada limite é arredondado pela sua própria ordem de grandeza (três dígitos
  significativos), para a legenda dizer "1.130.000.000" e não "1.127.483.219,4".
- As cores saem de `buildSequentialColorRamp`: tons da cor do indicador, do mais
  claro ao mais escuro, para a legenda não exigir cinco escolhas de cor.

A rota **não escreve nada** e não exige rascunho salvo: a fonte vai no corpo,
porque a detecção acontece enquanto o operador preenche o formulário. O
resultado substitui os campos e continua editável — quem publica é quem decide
onde cada faixa começa. Ela reaproveita o instantâneo em memória, então detectar
faixas depois de validar não relê o Google Drive.

### O que a validação faz

`buildSpreadsheetIndexDraft` baixa a planilha, descobre os períodos e agrega
município, UF, Brasil, região, bioma, ASD e semiárido (soma ou média simples,
conforme o formulário). O resultado é o **instantâneo**, contrato
`municipal-spreadsheet-snapshot`.

**A validação não escreve no Contentful.** O instantâneo fica na memória do
processo (`draftSpreadsheetSnapshot`, 30 min, com dedupe de leituras em voo) e é
de lá que a prévia — painel, coropleta e relatório — lê os valores. Isso não é
detalhe de desempenho: a publicação revalida para comparar a impressão digital e
pode recusar com "Revalide antes de publicar", e uma validação que gravasse já
teria trocado o arquivo que a produção está lendo.

Quem grava é `publishSpreadsheetSnapshot`, chamado por
`publishIndexCatalogDraft` **depois** da conferência da impressão digital. Ele
sobe um **asset JSON novo** — nunca uma regravação do anterior, que continua
sendo o que a produção serve até a entry terminar de publicar. O `panelLayer`
publicado guarda só o ponteiro em `statisticsSource.snapshot`.

Os valores não entram em `imageData` de propósito: são ~5.600 territórios por
período (~400 KB numa planilha de três anos), e `imageData` é lido e revalidado
a cada requisição do Monitoramento, de toda camada.

### Em produção

- O painel lê o instantâneo por `municipalSpreadsheetRepository`, com cache de
  1 h por processo e dedupe de leituras em voo. O Google Drive **não** é
  acessado em produção: a planilha pode ser movida, renomeada ou fechada.
- O mapa é a coropleta municipal descrita em `docs/image-data-contract.md`. Os
  valores de todos os municípios do período vêm de
  `/api/municipal-analysis/[panelLayerId]/choropleth?year=`, autenticada como as
  demais.
- Atualizar os dados é revalidar **e republicar** o índice no catálogo: a
  revalidação só mostra o dado novo na prévia, e a publicação é que grava o
  instantâneo e aponta o índice para ele.

### Limites conhecidos

Cada publicação deixa o instantâneo anterior no espaço do Contentful, sem nada
apontando para ele. É o preço de nunca regravar um arquivo que a produção pode
estar lendo; são algumas centenas de KB por publicação, e a limpeza é manual.

A média é simples — cada município pesa igual, porque a planilha não traz coluna
de peso. Para um índice como o IDHM isso **não** reproduz o número oficial do
Brasil, que é calculado sobre agregados nacionais e não como média dos
municípios. A tela diz isso ao operador no campo de agregação.

## Texto do relatório

A seção "Relatório Automático" do formulário grava `panelLayer.reportConfig`:
seções (título + texto), nota de metodologia e cor do cabeçalho. A forma de
`sections` é a mesma que o Google Docs entrega, então o texto do catálogo
substitui o bloco `[layer: <id>]` do documento sem que a montagem do relatório
precise saber de onde ele veio — inclusive a substituição de variáveis entre
colchetes e a regra de que uma seção "Situação atual" vence a frase gerada
automaticamente. Sem `reportConfig`, o índice continua lendo o documento.

### O índice entra no relatório?

A mesma seção do formulário grava `reportConfig.includeInReport`. Só o "não" é
gravado: a ausência do campo significa incluído, e é isso que mantém no
relatório todo índice publicado antes de a pergunta existir. Desmarcado, o
índice continua no mapa e no painel de análise, mas some da lista do Relatório
Automático em todos os recortes — `getSelectableReportLayerIds` o retira do
formulário e `resolveReportLayers` não monta seção para ele.

### Um texto para todos os recortes

O relatório é gerado para município, estado, Brasil, região, bioma, semiárido e
ASD, e o texto escrito aqui é o mesmo em todos eles. Por isso as variáveis de
território substituíram a citação direta ao município: `[no_territorio]` abre a
frase já com a contração certa ("No município de Campina Grande — PB", "Na
região Nordeste", "No bioma Caatinga"), `[do_territorio]` serve ao meio da frase
("quanto da área [do_territorio]"), `[territorio]` é só o nome e `[recorte]` é o
substantivo do recorte. A contração depende do gênero do recorte e do artigo do
nome, e quem escreve a frase não sabe em que recorte ela será lida — por isso
ela vem pronta do servidor, em `src/utils/reportTerritory.ts`.

`[municipio]` e `[uf]` continuam existindo para os textos antigos: fora do
município, `[municipio]` descreve o território do relatório e `[uf]` fica vazia.

### Ordem de gravidade das classes

Uma pergunta no mesmo formulário grava `reportConfig.severity`: a lista de ids
das classes da melhor para a pior, mais a classe que representa a condição
normal. O padrão é "não têm ordem de gravidade", e é uma resposta legítima —
cobertura da terra não tem gravidade nenhuma.

Ela existe porque nada mais no `panelLayer` sabe qual classe é pior que qual:
`imageData.classes` guarda id, rótulo e cor, e a ordem em que elas aparecem é a
ordem da legenda, não uma afirmação sobre gravidade. Deduzir a gravidade dessa
ordem daria uma frase errada com cara de certa num índice sem ordem, então o
catálogo pergunta em vez de inferir. Sem a resposta, o índice fica sem as
variáveis de tendência do relatório (`[status_tendencia]`,
`[classe_maior_severidade]` e as demais listadas em
`docs/municipal-report-api.md`), e a prévia diz isso.

A ordem é gravada como lista explícita de ids, e não como "crescente" ou
"decrescente", porque reordenar as classes depois inverteria o sentido de um
flag em silêncio. Quando as classes mudam, a lista deixa de descrevê-las e o
formulário pede a resposta de novo (`describeSeverityChoice` devolve `stale`)
em vez de reinterpretá-la.

### Variáveis oferecidas na prévia

A prévia do relatório devolve, além das seções já resolvidas, a lista das
variáveis que **aquele** índice aceita, cada uma com o valor que teria em
Campina Grande. A disponibilidade vem do perfil temporal do índice — períodos,
granularidade, forma do valor, ordem de gravidade —, nunca dos dados do
município da prévia: fosse do município, um texto escrito ali poderia quebrar
em outro. O exemplo passa pela mesma substituição do relatório de produção, de
modo que uma variável que não resolve aparece na tela com os colchetes, como
apareceria para o cidadão.

O "Salvar rascunho" e o "Validar assets e gerar prévia" gravam o texto junto com
o formulário, chamando a rota de texto depois do `PUT`. Sem isso o texto ficava
apenas no navegador e a prévia do relatório mostrava a frase automática — quem
clica no botão de salvar principal espera que o que está na tela seja gravado. A
escrita é evitada quando o texto em edição já é o gravado (`isStoredReportText`),
para não gastar uma requisição ao Contentful e um evento de auditoria a cada
salvamento.

A escrita tem rota própria,
`POST /api/index-catalog/drafts/[entryId]/report-text`, e **não** o `PUT` do
rascunho: `updateIndexCatalogDraft` zera `status`, `validation` e
`validatedStatisticsSource`, o que obrigaria uma revalidação inteira no Earth
Engine para corrigir uma frase. `report` mora em `IndexCatalogAuditData` junto
com `previewMap`, fora de `IndexCatalogDraftInput`, justamente para ficar fora do
`sourceFingerprint` conferido na publicação.

Como o relatório lê o `panelLayer` publicado, editar o texto de um índice já
publicado exige republicar — a rota devolve `requiresRepublish` para a tela
avisar. **Republicar** aparece no cartão e no editor sempre que o índice está
publicado e tem alteração pendente, e é a única forma de levar ao ar uma
correção de texto ou uma imagem nova sem despublicar o índice antes.

### Texto padrão e variáveis

Um índice novo abre com o texto de `src/config/indexCatalogReportText.ts` já
preenchido: quatro seções ("Situação atual", "O que este índice mede", "Como
interpretar os resultados", "Limitações de uso") e a nota de metodologia. Vem
preenchido, e não em branco, porque um índice do catálogo **não tem seção no
Google Docs**: em branco ele publicaria sem nenhuma narrativa. Por isso o texto
padrão é genérico mas publicável sem edição — nenhuma frase dele é instrução
para o operador. As instruções ficam nos `placeholder` dos campos, nas dicas
abaixo deles e no modal "Guia e exemplos" da própria seção.

As variáveis oferecidas na tela são as de `CATALOG_REPORT_VARIABLES`, e a lista
é fechada de propósito: `populateTemplate` devolve o próprio `[texto]` quando não
encontra a chave, então prometer uma variável inexistente publica o colchete no
relatório. `[indice]` (o título do índice), `[classe]`, `[percentual]`,
`[valor]`, `[valor_com_unidade]`, `[unidade]`, `[periodo]` e
`[periodo_extenso]` se referem à **camada da própria seção**: `getLayerScopedTemplateKey` em `buildDocContent.ts` compõe
`<chave>_<id da camada normalizado>`, que é exatamente o alias com que
`municipalReportService` grava `templateVariables`. Sem isso, quem escreve o
texto precisaria conhecer o id gerado para o índice. O alias explícito das
camadas legadas (`aliasesByTheme`) continua vencendo o genérico.

### Prévia do relatório

`GET /api/index-catalog/drafts/[entryId]/report-preview` monta como o índice em
rascunho apareceria no Relatório Automático de **Campina Grande - PB**, no
período mais recente que a validação encontrou. É rota própria, e não parte da
resposta de `preview`, porque custa uma leitura no Earth Engine e a validação já
é a etapa lenta do catálogo.

O município é fixo porque a prévia serve para conferir aparência, não para
consultar município: Campina Grande está em todos os recortes do semiárido,
então um índice válido sempre tem linha para ela — um município de borda
transformaria "sem dados" em dúvida sobre a prévia. A leitura cobre a série
inteira — todos os períodos validados vão como `periodKeys` —, porque a prévia
desenha o gráfico do relatório; o cache de linhas do repositório faz disso uma
ida ao Earth Engine, e não uma por período.

A tela mostra a seção completa: cabeçalho, situação atual, tabela de classes, a
imagem espacial do município ao lado do gráfico da série, o texto de análise e
as notas metodológicas. A imagem espacial vem da rota de tiles do rascunho
(`/api/index-catalog/drafts/[entryId]/ee`), porque `/api/ee` só conhece camadas
publicadas. Gráfico e notas são os mesmos componentes do relatório de produção
(`MunicipalReportDynamicChart`, `MunicipalReportNotes`), para que a prévia não
possa divergir dele.

`buildIndexCatalogReportPreview` injeta `layers` e `loadImageData` em
`buildMunicipalReport`: o caminho normal resolve a fonte estatística pelo
`panelLayer` **publicado**, que ainda não existe para um rascunho. O
`availabilityIndex` vai vazio para que o período seja o que a validação inferiu.
A interpolação usa `populateDocContent`, a mesma do relatório de produção, para
que um colchete que não resolve apareça errado na prévia também.

## Fonte estatística e fonte de mapa

São configurações independentes:

- estatísticas: sempre uma FeatureCollection fixa ou um template com `{year}`,
  `{month}` e/ou `{period}`, em uma de **duas formas de tabela** (o campo
  "Forma da tabela" no formulário):
  - **Distribuição por classes** (`gee-feature-collection`): uma linha por
    território e período, com `perc_classe_XX` e `area_ha_classe_XX`;
  - **Valor único por município** (`gee-municipal-value-table`): uma linha por
    município, uma coluna por período e um número em cada célula — a forma dos
    dados socioeconômicos, descrita adiante;
  - o formulário oferece **Uma tabela por ano (detectar os anos)**: o operador
    cola o endereço de um ano concreto (`..._MonitorANA_2026`) e a tela grava o
    template equivalente (`..._MonitorANA_{year}`). Não é um terceiro contrato,
    é atalho de digitação. Combinado com granularidade mensal, atende o caso em
    que cada tabela anual guarda os meses daquele ano — é a forma do `anaseca`;
- mapa: Image, ImageCollection ou FeatureCollection, em asset único ou por
  período.

ImageCollections podem usar mosaico comum ou o tratamento de previsão por
emissão e horizonte. Nesse tratamento, o catálogo encontra a emissão mais
recente durante a validação, associa os leads aos períodos pela data-alvo da
imagem e grava a emissão resolvida na revisão. O mapa público não muda
silenciosamente quando uma emissão nova chega: é necessário revalidar com a
FeatureCollection estatística correspondente e publicar uma nova revisão.

O formulário solicita os nomes das propriedades de emissão, horizonte e
data-alvo, a lista de leads, a banda bruta e os limites crescentes que separam
as classes. A validação exige uma imagem por lead, períodos mensais iguais aos
da estatística e exatamente um limite a menos que a quantidade de classes.

A FeatureCollection deve possuir pares `perc_classe_XX` e
`area_ha_classe_XX`. Os índices podem iniciar em qualquer número — 0, 1 ou outro
qualquer, como assets que começam em `perc_classe_2` — e podem ter lacunas: a
cobertura do solo do IBGE usa as classes 1 a 6 e 9 a 14, porque 7 e 8 não
existem na legenda dela. O catálogo infere a quantidade e os índices; a pessoa
configura apenas rótulos, cores e o mapa. O valor é percentual e a unidade é `%`.

Quando as classes têm lacunas, o mapa remapeia os valores de pixel para posições
densas antes de visualizar. Sem isso o Earth Engine espalharia as cores da paleta
pelo intervalo inteiro e cada classe receberia a cor da vizinha; como efeito
colateral desejável, um pixel cujo valor não é classe nenhuma da camada passa a
ser mascarado em vez de pintado com a cor de outra classe.

Também são obrigatórias as propriedades territoriais, `ano`, `data_img` e
`area_total_ha`. A validação rejeita schema incompleto, classes divergentes,
períodos duplicados, linhas incompletas e percentuais fora de 0–100 ou que não
somem `100 ± 0,2` (todos zero representam ausência).

Quando as colunas não batem, o erro traz **todos** os problemas de uma vez, as
colunas que o asset realmente tem e — quando elas sugerem a outra forma de
tabela — qual escolher em "Forma da tabela"
(`src/contracts/geeStatisticsColumns.ts`). É o que evita descobrir um problema
por validação: um asset de valor único escolhido como distribuição por classes
falha ao mesmo tempo nas colunas de classe e no mapeamento territorial, e são as
duas juntas que mostram que o errado foi a forma. As colunas de período são
resumidas (`23 colunas de período (2004 a 2026)`) para não empurrarem as colunas
territoriais para fora da mensagem.

### Valor único por município

É a forma em que a mesma FeatureCollection é a tabela de estatísticas **e** o
asset que desenha o mapa: `projects/ee-ulissesalencar17/assets/pob_total` tem
5.573 linhas municipais, as colunas `2012`…`2025` com o percentual de pobreza e
as colunas territoriais do recorte do IBGE. O mapa a desenha com
`reduceToImage` sobre a coluna do período.

O formulário pede, além do endereço do asset:

- **Coluna do valor** — `{year}` quando as colunas são os anos. Numa
  FeatureCollection única ela precisa ter `{year}`, `{month}` ou `{period}`; é
  ela que separa os períodos. Quando cada asset é um período (`pob_{year}`), a
  coluna pode ser fixa.
- **Como somar os municípios** — `soma` para contagens (registros de seca do
  S2ID) e `média` para percentuais (pobreza do CadÚnico). A tabela só tem
  municípios, e é daí que saem o valor de cada UF e o do Brasil.
- **Indicador** — nome, unidade (`registros`, `%`), formato do número
  (percentual ou contagem) e cor. O nome e a unidade montam as frases do painel
  ("Registros de secas e estiagens em Paraíba: 34 registros.") e o título do
  ranking de estados; a unidade também vira o `measurementUnit` do `panelLayer`,
  que nesta forma deixa de ser fixo em `%`.
- **Faixas de cor do mapa** — escritas à mão, porque a tabela não tem uma coluna
  por faixa que o catálogo pudesse inferir. São a legenda do mapa, e exigem
  exatamente um limite a menos que a quantidade de faixas.

A camada publicada tem **uma classe só** (o indicador) e um valor por
território; as faixas ficam em `mapVisualization.legend` com os `thresholds`.
O mapa desta forma é sempre uma FeatureCollection — é a própria tabela que é
pintada —, então a validação recusa Image e ImageCollection em vez de
sobrescrever o tipo em silêncio.

A validação recusa: tabela sem coluna que case com a coluna do valor, município
repetido, linha sem código IBGE ou sem nome, coluna de UF que não é uma UF,
tabela com mais de 6.000 linhas (sinal de que não é municipal) e qualquer célula
vazia numa coluna de período — um vazio faz `reduceColumns` descartar o
município de **todos** os períodos e o total da UF sair menor em silêncio.

A prévia sempre traz um aviso: recortes de região, bioma, ASD e semiárido ficam
sem valor nesta forma, porque não saem de uma tabela municipal.

## Descoberta, prévia e publicação

1. Salvar cria ou atualiza um `panelLayer` em draft.
2. **Revalidar assets e gerar prévia**:
   - inspeciona o asset fixo ou lista o diretório-pai do template;
   - descobre períodos por `ano`/`data_img`;
   - valida todos os schemas, dados classificatórios e mapas correspondentes;
   - calcula `sourceRevision` com IDs, metadata, schemas e períodos;
   - grava somente a configuração e o `imageData` leve no draft.
3. A prévia administrativa consulta o GEE diretamente e permite exercitar
   Brasil, UF, município, região, bioma, ASD e semiárido. Junto dela o
   navegador captura a imagem de prévia do mapa (ver abaixo).
4. Publicar repete a validação e exige o mesmo fingerprint da prévia. Somente o
   `panelLayer` é publicado.

Novos períodos não entram automaticamente no índice público. O operador usa
**Revalidar assets**, confere a prévia e publica uma nova revisão. Um índice já
publicado pode receber alterações em draft sem retirar a versão pública atual, e
**Republicar** as leva ao ar reconferindo o mesmo fingerprint.

Publicar exige uma prévia válida gravada, e não um `status` específico:
`hasPublishableValidation` recusa `draft` e `error` — nos dois a validação foi
apagada ou marcada inválida — e deixa `ready` e `published` seguirem para a
reconferência do fingerprint. A mesma função decide se a tela oferece
**Republicar**, para o botão não aparecer num estado que a rota recusaria: uma
edição da configuração derruba o status para `draft`, e ali o caminho é
revalidar antes de publicar.

Uma publicação que falha não rebaixa o status do índice: ele volta a ser o de
antes da tentativa, porque numa republicação a versão publicada continua no
Monitoramento.

Publicar confere `sys.publishedAt` na resposta do Contentful antes de responder
sucesso, e a tela reconsulta a lista para confirmar que o índice está publicado.
Uma publicação que não se registra vira erro, não mensagem de sucesso: sem essa
checagem o índice ficava fora do Monitoramento sem nenhum sinal no catálogo.

### Imagem de prévia do mapa

O cartão do índice no Monitoramento é o campo `previewMap` do `panelLayer` —
nos índices legados ele é uma captura de tela feita à mão. Na validação, o
navegador monta o mapa do período padrão enquadrado no Brasil (mesmo
`BASE_STYLE` e `ensureMapLayers` da plataforma), exporta o canvas em PNG com
`captureMapCanvasPng` e envia para
`POST /api/index-catalog/drafts/{entryId}/preview-map`.

A captura acontece no navegador porque é lá que existe WebGL: o servidor não
renderiza tiles. A rota valida o PNG (`decodePreviewMapDataUrl`: assinatura e
tamanho máximo), sobe o arquivo pela API de uploads, processa, publica o asset
e liga o asset ao campo `previewMap` da entry. O id do asset fica em
`catalogConfig.previewMap.assetId` para que cada nova captura substitua o
arquivo do mesmo asset, em vez de deixar imagens órfãs no espaço.

O asset é publicado na hora — sem isso não existe URL — mas o índice segue
invisível no Monitoramento até a entry ser publicada. Num índice já publicado,
a imagem nova só aparece na próxima publicação, e a tela diz isso.

### Posição na categoria

A ordem da lista do Monitoramento vem de `panelLayer.panelPosition`, do menor
para o maior, dentro da categoria. Os dois formulários do catálogo — o completo
e o do índice legado adotado — editam esse número no campo "Posição na
categoria" (`PanelPositionField`), e deixá-lo vazio significa "onde já está":
um índice novo entra depois do último da própria categoria (`Math.max(...) + 1`).

O número escrito no formulário é um **pedido**, gravado no `catalogConfig`. Ele
só chega ao campo `panelPosition` da entry na publicação, e é
`resolvePanelPositionPlan` que decide o que acontece quando outro índice da
mesma categoria já está nele: os dois **trocam de lugar**. Quem pediu recebe a
posição pedida, e o antigo ocupante recebe a posição que o outro deixou vazia —
tanto no campo quanto no `catalogConfig` dele, para o formulário do índice
movido não reabrir pedindo a posição antiga e desfazer a troca no salvamento
seguinte. A troca é aplicada por `preparePanelPositionForPublish` depois de a
entry que pediu ir ao ar, e o ocupante é republicado junto, porque sem isso a
lista publicada continuaria com os dois no mesmo número.

Um ocupante que tem outras alterações em rascunho **não** é republicado:
publicá-lo levaria ao ar uma edição que ninguém revisou só por causa de uma
troca de posição. Nesse caso a troca fica gravada no rascunho dele e a resposta
da publicação traz um aviso (`positionNote`) pedindo a republicação — é o mesmo
texto que a tela do catálogo mostra.

Escrever o campo só na publicação é o que torna a troca possível: é a posição
que a entry ainda tem publicada que diz qual número vai sobrar para o ocupante.
Por isso a prévia não mexe mais na ordem.

O empate era antes desfeito jogando o índice novo para o fim da categoria, o
que ignorava em silêncio o que o operador pediu — foi o que aconteceu com
`teste-temperatura`, publicado na posição 0, a mesma do `anaseca`: a lista caiu
na ordem em que o Contentful devolvia as entries e o índice novo apareceu como
primeiro. O desempate por nome em `comparePanelLayers` continua como rede de
segurança, para a lista não mudar de ordem a cada publicação.

### ID técnico do panelLayer

O formulário não pede o ID técnico: ele é o slug do nome (`Previsão: Anomalia
Temperatura | CPTEC INPE` → `previsao-anomalia-temperatura-cptec-inpe`), com
sufixo numérico quando já existe outro igual. Enquanto a entry nunca foi
publicada o ID acompanha o nome a cada salvamento. Depois da primeira
publicação ele congela, porque telemetria, relatórios, caches e a URL do
Monitoramento usam esse ID como chave — por isso um índice criado como "Teste
temperatura" e renomeado depois continua sendo `teste-temperatura`.

### Estado de publicação

O Contentful é a autoridade: `sys.publishedAt` diz se o índice está no
Monitoramento; `catalogConfig.status` é só a memória do catálogo. Os dois
divergem quando a entry é despublicada por fora — no app do Contentful, ou num
"Excluir" que despublicou e falhou ao remover. A leitura reconcilia os dois
(`reconcileCatalogPublicationStatus`): um índice `published` numa entry em
rascunho volta a `ready` quando a prévia validada ainda vale, e pode ser
publicado de novo em um clique. Sem isso, `assertPublishable` só aceitava
`ready` e o operador recebia "Revalide os assets e gere a prévia antes de
publicar" com a prévia já validada.

## Índices legados: escopo de apresentação

O catálogo gerencia duas coisas diferentes, e a separação entre elas é o que
permite editar um índice legado:

- **apresentação** — nome, descrição, categoria, posição, unidade, imagem do
  cartão e texto do Relatório Automático. Tudo isso mora na própria entry do
  `panelLayer` e nunca dependeu do Earth Engine;
- **origem dos números** — a FeatureCollection estatística, os assets de mapa, a
  validação e a descoberta de períodos.

Um índice legado tem a primeira parte completa e não tem nada da segunda: os
valores dele vêm das partições `municipalAnalysis` escritas pela pipeline de CSV
ou do registro estático de `src/config/geeStatisticsLayers.ts`. Até a primeira
versão deste escopo, exigir a segunda parte trancava a primeira, e o cartão do
índice dizia apenas "visível, mas não editável por este formulário".

`catalogConfig.managedScope` distingue os dois casos: `full` (ou ausente, nas
entries publicadas antes do campo existir) é o índice que o catálogo criou;
`presentation` é um legado adotado.

### A adoção foi encerrada

Os treze legados que valia a pena destravar já foram adotados, e a listagem do
catálogo deixou de mostrar `panelLayer` fora dele: o que sobrava eram entries de
teste, sem nada que o operador pudesse fazer ali. Com isso saíram do repositório
o botão "Adotar no catálogo", a rota `POST /api/index-catalog/entries/[entryId]/adopt`,
o serviço `legacyAdoption.ts` e o lote `catalog:adopt-legacy:*`.

O que ficou é o resultado da adoção: `catalogConfig.managedScope: "presentation"`
nas entries adotadas, e todo o editor de legado que as mantém editáveis. Adotar
um legado novo hoje exige gravar esse `catalogConfig` à mão no Contentful.

### Publicar todos os legados adotados de uma vez

A adoção grava só na versão de rascunho, de propósito, para não mexer no que
está no ar. O efeito colateral é que todo legado adotado passa a exibir
"alterações não publicadas" no catálogo, e esse aviso passa a esconder uma
pendência de verdade quando ela aparecer.
`npm run catalog:publish-legacy:dry-run -- --actor-email=<e-mail>` lista o que
seria publicado; `catalog:publish-legacy:apply` publica. O `catalogConfig`
publicado é montado por `buildPublishedPresentationConfig`, o mesmo do botão
"Republicar" do editor.

A guarda que justifica a ferramenta é a comparação com a própria versão
publicada, campo a campo, **ignorando a ordem das chaves do JSON**: o Contentful
devolve `reportSeriesConfig` com as chaves em ordens diferentes no rascunho e no
publicado, e uma comparação ingênua acusa alteração em onze dos catorze legados
quando os dois lados são idênticos. Uma entry cujo rascunho difere em qualquer
campo além de `catalogConfig` é recusada, porque publicá-la levaria ao ar uma
alteração de conteúdo que ninguém revisou — `--allow-field=previewMap` aceita
uma dessas diferenças conscientemente, um campo por vez.

Uma entry que nunca foi publicada também é recusada: publicá-la a colocaria no
Monitoramento pela primeira vez, e isso é decisão de quem opera, não de um lote.

### O que o escopo de apresentação escreve

`PUT /api/index-catalog/entries/[entryId]/presentation` grava `name`,
`description`, `category`, `measurementUnit` e a posição pedida (dentro do
`catalogConfig`, ver "Posição na categoria"), e mais nada.
Nunca `imageData` inteiro, nunca `statisticsSource`:

- reescrever o `imageData` de um legado apagaria os valores territoriais que
  estão gravados ali — nos legados eles ocupam a maior parte do campo (196 KB
  dos 238 KB de `CDI_Test`, 93 KB dos 100 KB de `anaseca`);
- gravar `statisticsSource` desligaria o fallback do Contentful sem volta —
  `municipalAnalysisRepository` relança o erro do GEE em vez de ler as
  partições quando a camada declara uma fonte dinâmica.

O asset do mapa, os rótulos e as cores moram dentro do `imageData` e têm
escritas próprias, descritas abaixo, justamente porque elas precisam de uma
guarda que esta não precisa.

A unidade é editável e não é normalizada para `%` como no escopo completo,
porque os legados usam `classes`, `%` e `registros`. Toda escrita do catálogo
mandava `measurementUnit: "%"` fixo, o que trocaria a unidade de
`s2id_secas_estiagens` em silêncio.

Salvar não derruba `status` nem apaga validação alguma: não existe validação de
assets neste escopo, e "Gerar prévia" apenas lê a entry.

### Asset do mapa

`GET` e `PUT /api/index-catalog/entries/[entryId]/map-assets` trocam o
`imageData.years[período].imageId` — a imagem que o Earth Engine desenha no
mapa.

O mapa é a única parte de um legado que já vem do Earth Engine, e por isso é
editável enquanto a fonte estatística não é. As duas situações não são
simétricas:

- gravar `statisticsSource` num legado **desliga** a origem dos números dele,
  porque `municipalAnalysisRepository` deixa de cair para as partições do
  Contentful quando a camada declara fonte dinâmica;
- trocar o `imageId` não desliga nada: o tile passa a ser gerado a partir de
  outra imagem (`/api/ee`, que lê `yearConfig.imageId`), e os números do painel
  continuam vindo de onde vinham.

**Os períodos são fixos.** A escrita exige exatamente o mesmo conjunto de
períodos que a entry já tem. Criar um período daria um mapa com o painel de
análise vazio, porque as estatísticas daquele período viriam de uma partição
`municipalAnalysis` que esta tela não escreve; remover apagaria os valores
gravados junto do período, que não têm outra cópia no Contentful.

**Guardas.** `assertOnlyMapAssetsChanged` compara o `imageData` antes e depois
ignorando os `imageId` e recusa a gravação se qualquer outra coisa tiver mudado
— é a mesma proteção da aparência, pela mesma razão: o campo também guarda os
valores territoriais. Além dela, uma troca que mudaria o tempo de previsão lido
do fim do nome do asset (`..._01`, em `getLegacyForecastLeadTime`) é recusada,
porque moveria o período para outro horizonte em silêncio.

A validação do id é frouxa de propósito: convivem assets do projeto
(`projects/ee-ocaufcg/assets/IA_1961_1990`) e coleções públicas
(`MODIS/061/MOD17A3HGF/2001_01_01`). O que ela pega são os erros que o Earth
Engine só reportaria como um mapa em branco — campo vazio, espaço no meio,
barra sobrando, URL colada do navegador.

Na tela, um índice cujos períodos usam todos o mesmo asset (os três de pobreza,
`s2id_secas_estiagens`, `ods`) mostra um campo só; os demais mostram uma linha
por período. Depois de salvar, "Gerar prévia" desenha o mapa com o asset novo, e
a troca só entra no ar na publicação.

### Legenda, cores e limites

`GET` e `PUT /api/index-catalog/entries/[entryId]/appearance` editam o que a
pessoa vê no mapa. É a única escrita do escopo de apresentação que toca o
`imageData`, e a mais cuidadosa do catálogo.

**Onde a legenda mora.** A plataforma resolve a legenda como
`mapVisualization.legend ?? classes` (`buildCompactImageParams`, em
`src/utils/imageData.ts`), e a edição grava no mesmo lugar de onde o mapa lê —
nunca nos dois. Isso divide os legados em duas famílias:

- **classificatórios** (`terraibge`, `deg`, `carbonoembrapa`, `anaseca`, …) — as
  classes são a legenda, e cada linha é uma classe do raster;
- **valor único** (`pob_total`, `pob_rural`, `pob_urb`, `s2id_secas_estiagens`) —
  `classes` tem uma linha só, o nome da série medida que aparece no painel e no
  gráfico, e as faixas coloridas do mapa estão em `mapVisualization.legend`. O
  formulário mostra as duas coisas separadas, com esses nomes.

**O que a rota garante.** `applyLegacyAppearance` (em
`src/utils/legacyAppearance.ts`) aplica a alteração por cópia do objeto gravado
e:

- recusa criar, remover ou reordenar linhas. `values[locationKey][i]` é a classe
  `i`, então mexer na lista desalinharia todos os números já publicados de todos
  os períodos. Isso vale para os 14 legados adotáveis: em todos eles o tamanho
  das listas de valores é igual ao número de classes;
- sincroniza `mapVisualization.palette` com as cores da legenda, **casando cada
  casa da paleta pela cor que ela já tem**, e não pela posição. A paleta é
  indexada pelo valor de pixel do raster: `cemadenseca` lista as classes com
  `pixelLimit` de 6 a 1 e a paleta de 1 a 6, na ordem inversa da legenda (e sem
  `#`, que o Earth Engine também aceita). Sincronizar por posição inverteria as
  cores do mapa inteiro — e a conferência de aparência não pegaria isso, porque
  a paleta é um campo que esta edição pode escrever. A convenção de escrita da
  entry é preservada. Quando alguma casa não corresponde a exatamente uma linha,
  ou quando os tamanhos não coincidem, a edição de **cores** é recusada com o
  motivo; editar só rótulos continua permitido, porque aí a paleta não entra em
  jogo;
- não reescreve a caixa das letras de uma cor que não mudou. A tela normaliza
  tudo para `#RRGGBB` em maiúsculas e a maioria dos legados está gravada em
  minúsculas; sem isso, abrir um índice e salvar sem editar nada criaria uma
  versão nova e o marcaria como "alterações não publicadas" à toa;
- descarta o `tone` de uma classe cuja cor mudou. `tone` são as cores do chip no
  painel de análise; sem ele o painel recalcula o tom a partir de `color`, e com
  ele o painel continuaria na cor antiga;
- mantém `pixelLimit`, `value` e qualquer campo que o contrato não conhece,
  porque nenhuma linha é reconstruída do zero;
- aceita novos `thresholds` só quando o índice já classifica o mapa por limites,
  na mesma quantidade e em ordem crescente. Eles estão na unidade do asset
  (`7000, 13000, …` em `prodprimariabruta`), não na do rótulo;
- confere, antes de gravar, que nada além de rótulos, cores, paleta e limites
  mudou (`assertOnlyAppearanceChanged`). O objeto novo é construído por cópia do
  antigo, então essa conferência só falha se alguém mudar essa construção — e é
  para esse dia que ela existe.

**O corpo da requisição carrega só as linhas.** O servidor relê o `imageData`
gravado e aplica a alteração em cima dele, para que os valores territoriais não
trafeguem pelo navegador nem possam voltar corrompidos.

**Uma edição que não muda nada não grava.** Cada `patch` cria uma versão nova no
Contentful e marcaria um índice publicado como "alterações não publicadas" sem
que exista alteração alguma.

Como o `imageData` do `panelLayer` é a autoridade da aparência —
`mergeCompactDataset` preserva `classes` e `mapVisualization` da base e ignora
os das partições —, um rótulo editado aqui vale para o mapa, a legenda, o painel
de análise e o relatório, em todos os períodos de uma vez.

### Limites das classes

O campo "Limites das classes" ficava visível somente no bloco de coleção de
previsão, embora o formulário sempre o enviasse. Ele aparece em qualquer
estratégia de asset, porque um raster contínuo precisa dele independentemente de
como as imagens são escolhidas.

### Prévia e texto do relatório

`GET /api/index-catalog/entries/[entryId]/presentation` devolve a camada como
ela está, com o período padrão do próprio `imageData`. É o que permite capturar
a imagem do cartão de um legado: a rota de tiles do catálogo passou a resolver a
camada pelos campos da entry (`resolveCatalogPreviewTileLayer`) em vez de exigir
uma prévia validada, porque um legado tem `imageId` por período sem ter
validação. `municipalAnalysisApiPath` fica de fora da resposta de propósito —
sem ele o painel de análise usa a rota de produção do índice, que é a única que
sabe ler as partições.

A prévia do Relatório Automático de um legado roda pelo caminho de produção:
sem `loadImageData` e sem `availabilityIndex` próprios, e reaproveitando a
configuração estática de `MUNICIPAL_REPORT_LAYERS` quando ela existe. É de lá
que vêm o alias, a ordem e a narrativa de severidade que o relatório real usa.

O formulário de um legado abre com o texto do relatório **vazio**, e não com o
texto padrão do catálogo: a narrativa de um legado mora num bloco do Google
Docs, e abrir com o padrão faria o primeiro salvamento substituir o texto real
por um genérico. "Trazer o texto do Google Docs"
(`GET /api/index-catalog/entries/[entryId]/docs-text`) traz as seções do
documento com os colchetes intactos, para o operador editar o que já está
publicado. Um texto vazio devolve o índice ao documento.

### O que o catálogo não faz num legado

- não valida assets, não calcula `sourceRevision` e não confere fingerprint;
- não remove a entry de um legado que já foi publicado. O `panelLayer` é a única
  cópia da configuração de um índice cujos valores moram nas partições, então
  apagá-lo tiraria o índice da plataforma sem nada para reconstruí-lo.
  "Despublicar" continua disponível;
- não muda a origem dos dados. Migrar um legado para o escopo completo continua
  exigindo a FeatureCollection estatística no GEE; o catálogo só adianta o
  preenchimento do formulário;
- não cria nem remove classes nem períodos, e não mexe em `pixelLimit` nem nos
  valores. O `imageId` de um período existente é editável (veja "Asset do
  mapa"); o resto do `imageData` só muda em aparência.

## Compatibilidade e falhas

`catalogConfig` v1 e panel layers sem configuração **não aparecem na listagem**:
sem a adoção não há ação possível sobre eles, e os cartões só afastavam os
índices em que se trabalha de fato. Eles continuam existindo no Contentful e a
plataforma continua exibindo os que estão publicados — quem precisar removê-los
faz isso pelo Contentful. A remoção pela tela, que exclui somente o
`panelLayer` e nunca chama escrita ou exclusão no GEE, vale para os índices
gerenciados pelo catálogo.

Carbono e ANA ainda possuem registro estático para compatibilidade. Eles podem
usar o fallback histórico no Contentful. Fontes dinâmicas publicadas em
`panelLayer.statisticsSource` não procuram Contentful: quando o GEE falha, a
rota entrega o último resultado em cache, se existir; sem cache, informa
indisponibilidade.

A imagem de prévia não entra no `sourceFingerprint`: ela ilustra o índice, não
descreve os dados, então recapturá-la não invalida a prévia validada.

Publicação, despublicação e remoção invalidam caches de tiles, estatísticas e
painel por `refreshPublicIndexCaches`. O cache de schema inclui
`sourceRevision`, portanto uma revisão nova não reaproveita silenciosamente o
schema anterior. As queries de `panelLayer` carregam a tag `panel-layers` no
Data Cache do Next e a invalidação passa por ela: limpar só a memoização do
processo deixava `/api/ee` servindo a lista antiga por até uma hora, e o índice
recém-publicado não aparecia no mapa.

## Content model e ambiente

O content type `panelLayer` precisa dos campos Object opcionais
`catalogConfig` e `statisticsSource`; `previewMap` também é opcional. A criação
do primeiro draft aplica a alteração de modo idempotente, ou ela pode ser
executada antes:

```bash
npm run contentful:ensure-index-catalog
```

O runtime do catálogo exige `CONTENTFUL_MANAGEMENT_TOKEN` e
`GEE_PRIVATE_KEY` (com `GEE_PROJECT_ID` opcional quando não estiver na chave).
Não há variável `GOOGLE_DRIVE_*` exigida pelo catálogo.
