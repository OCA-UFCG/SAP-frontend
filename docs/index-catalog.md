# Catálogo de índices baseado em assets GEE

O catálogo administrativo fica em `/platform?view=catalog`. Ele exige sessão
Firebase, a allowlist `LOGS_ALLOWED_EMAILS`, same-origin nas mutações e
`Idempotency-Key` em prévia, publicação e ciclo de vida.

## O que é publicado

Um índice v2 publica somente um `panelLayer` no Contentful:

- metadados (nome, descrição, categoria e posição);
- `imageData` leve, com classes, períodos, templates, mapa e `values: {}`;
- `statisticsSource`, contrato versionado da FeatureCollection estatística;
- `catalogConfig` v2, usado pelo formulário e pela auditoria.

Os valores territoriais continuam no GEE e são consultados sob demanda. O
catálogo não busca Google Drive, não lê ou grava CSV, não executa o conversor e
não cria `municipalAnalysis` nem `municipalReportSeries`. As pipelines globais
continuam no repositório apenas para índices legados fora deste catálogo.

O Relatório Automático, suas séries, narrativas, documentos, PDFs e índice de
disponibilidade não fazem parte desta implementação.

## Fonte estatística e fonte de mapa

São configurações independentes:

- estatísticas: sempre uma FeatureCollection fixa ou um template com `{year}`,
  `{month}` e/ou `{period}`;
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
`area_ha_classe_XX`. Os índices precisam ser contíguos e iniciar em 0 ou 1. O
catálogo infere a quantidade e os índices; a pessoa configura apenas rótulos,
cores e o mapa. O valor é percentual e a unidade é `%`.

Também são obrigatórias as propriedades territoriais, `ano`, `data_img` e
`area_total_ha`. A validação rejeita schema incompleto, classes divergentes,
períodos duplicados, linhas incompletas e percentuais fora de 0–100 ou que não
somem `100 ± 0,2` (todos zero representam ausência).

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
publicado pode receber alterações em draft sem retirar a versão pública atual.

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

A ordem da lista do Monitoramento vem de `panelLayer.panelPosition`, e a
validação resolve a posição do índice com `resolvePanelPositionInCategory`: um
índice novo entra depois do último da própria categoria (`Math.max(...) + 1`).

Uma posição já ocupada por outra camada da mesma categoria é recalculada em vez
de mantida. Sem isso o índice ficava empatado — foi o que aconteceu com
`teste-temperatura` publicado na posição 0, a mesma do `anaseca` — e a lista
caía na ordem em que o Contentful devolvia as entries, colocando o índice novo
como primeiro. O empate também virou desempate por nome em
`comparePanelLayers`, para a lista não mudar de ordem a cada publicação.

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

## Compatibilidade e falhas

`catalogConfig` v1 e panel layers externos aparecem apenas para leitura. O
catálogo só publica, despublica ou remove entradas v2. A remoção exclui somente
o `panelLayer`; nunca chama uma operação de escrita ou exclusão no GEE.

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
