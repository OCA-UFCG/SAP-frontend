# Catálogo de índices

O catálogo administrativo está disponível em `/platform?view=catalog` e usa a
mesma allowlist `LOGS_ALLOWED_EMAILS` da Auditoria. Página e rotas exigem uma
sessão Firebase válida; mutações também exigem origem same-origin.

## Fronteiras de segurança

- `CONTENTFUL_MANAGEMENT_TOKEN`, `GOOGLE_DRIVE_CLIENT_EMAIL` e
  `GOOGLE_DRIVE_PRIVATE_KEY_BASE64` são variáveis exclusivamente server-side.
- A conta do Drive deve ter leitura somente na pasta da pipeline.
- A tag só descobre arquivos por substring normalizada. Prévia e publicação
  sempre baixam os IDs fixados e conferem `modifiedTime`.
- Prévia e publicação exigem `Idempotency-Key`.

## Ciclo de vida

1. O formulário cria um `panelLayer` não publicado com `catalogConfig`.
2. A validação baixa os CSVs para um diretório temporário, verifica o Drive e
   os assets do Earth Engine e executa a conversão `territorial-compact`.
3. `panelLayer` e partições `municipalAnalysis` permanecem em rascunho. A
   prévia administrativa lê esses rascunhos pela Management API.
4. Na publicação, as partições são revalidadas e publicadas primeiro. O
   `panelLayer` é publicado por último e ativa o índice no Monitoramento.
5. Falhas deixam o `panelLayer` como rascunho pronto para nova tentativa.

Todos os `panelLayer`, inclusive os legados, oferecem controles de ciclo de vida:

- **Mover para draft** despublica apenas o `panelLayer`. As partições continuam
  preservadas, mas o índice deixa de aparecer no Monitoramento.
- **Publicar** ativa a versão atual do `panelLayer`. Para índices criados pelo
  catálogo, uma prévia válida continua obrigatória e as partições são publicadas
  antes.
- **Remover** exige uma consulta de impacto e a digitação do ID técnico. A
  operação despublica o `panelLayer` primeiro e apaga, em cascata, as entradas
  `municipalAnalysis` e `municipalReportSeries` cujo `panelLayerId` é exatamente
  igual. Assets referenciados não são apagados, pois podem ser compartilhados.

Se uma remoção falhar parcialmente, o `panelLayer` permanece despublicado e o
índice não fica visível com dados incompletos. Uma nova tentativa pode concluir
a limpeza. Índices criados pelo catálogo continuam fora do Relatório Automático,
cujo índice de disponibilidade permanece estático.

## Content model e operação

`panelLayer.catalogConfig` é um campo Object opcional e `previewMap` passa a ser
opcional. A primeira criação de rascunho aplica essa migração de forma
idempotente. Ela também pode ser executada previamente:

```bash
npm run contentful:ensure-index-catalog
```

O runtime precisa das variáveis documentadas em `env.sample.txt`. Depois da
publicação, os caches de camadas municipais, tiles do Earth Engine e a rota da
plataforma são invalidados.

## Exemplo de validação em beta

O índice publicado `pob_total` pode servir de referência para um teste completo
sem depender de novos arquivos:

| Campo | Valor |
| --- | --- |
| Nome | `Teste catálogo — Percentual de pobreza CadÚnico` |
| Descrição | `Percentual de famílias inscritas no CadÚnico que se encontram em situação de pobreza agregado por município.` |
| Categoria | `Dados Socioeconômicos` |
| Tag do Drive | `pob_total` |
| Arquivos | `pob_total_panel_layer_2012_2025.csv` e `pob_total_municipal_2012_2025.csv` |
| Tipo de valor | `Percentual` |
| Coluna | `valor_classe_1` |
| Nome da medida | `Famílias inscritas no CadÚnico em situação de pobreza` |
| Cor-base | `#BD0026` |
| Código | `1` |
| Estratégia | `Asset único` |
| Tipo do asset | `FeatureCollection` |
| ID do asset | `projects/ee-ulissesalencar17/assets/pob_total` |
| Propriedade | `{year}` |
| Valores contínuos | `Sim` |
| Limites | `20, 40, 60, 80` |

A busca deve detectar o primeiro arquivo como `panel`, o segundo como
`municipal`, os períodos anuais de 2012 a 2025 e nenhuma advertência de formato.
Os IDs e `modifiedTime` do Drive são fixados automaticamente ao selecionar os
resultados; não são digitados no formulário.
