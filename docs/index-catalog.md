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
- mapa: Image, ImageCollection ou FeatureCollection, em asset único ou por
  período.

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
   Brasil, UF, município, região, bioma, ASD e semiárido.
4. Publicar repete a validação e exige o mesmo fingerprint da prévia. Somente o
   `panelLayer` é publicado.

Novos períodos não entram automaticamente no índice público. O operador usa
**Revalidar assets**, confere a prévia e publica uma nova revisão. Um índice já
publicado pode receber alterações em draft sem retirar a versão pública atual.

## Compatibilidade e falhas

`catalogConfig` v1 e panel layers externos aparecem apenas para leitura. O
catálogo só publica, despublica ou remove entradas v2. A remoção exclui somente
o `panelLayer`; nunca chama uma operação de escrita ou exclusão no GEE.

Carbono e ANA ainda possuem registro estático para compatibilidade. Eles podem
usar o fallback histórico no Contentful. Fontes dinâmicas publicadas em
`panelLayer.statisticsSource` não procuram Contentful: quando o GEE falha, a
rota entrega o último resultado em cache, se existir; sem cache, informa
indisponibilidade.

Publicação, despublicação e remoção invalidam caches de tiles, estatísticas e
painel. O cache de schema inclui `sourceRevision`, portanto uma revisão nova não
reaproveita silenciosamente o schema anterior.

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
