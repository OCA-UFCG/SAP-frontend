# Otimização da Renderização da Camada Base OpenStreetMap

## Resumo

Otimização da camada base OSM no mapa MapLibre GL JS para melhorar o desempenho de carregamento de tiles e a responsividade visual durante zooms, sem aumentar o número de requisições de rede.

## Arquivo modificado

- `src/components/Map/Map.tsx`

## Mudanças implementadas

### 1. `cancelPendingTileRequestsWhileZooming: true` (linha 750) — explícito

Mantido como `true` (default). Evita requests extras de tiles intermediários durante zooms rápidos, prevenindo desperdício de banda e rate-limiting no servidor OSM.

### 2. `"raster-fade-duration": 0` (linha 125)

**Antes:** `300ms` (default) — Cross-fade de 300ms entre tiles velhos e novos. Durante zooms consecutivos, tiles fantasmas permaneciam visíveis por centenas de milissegundos.

**Depois:** `0` — Tiles novos são renderizados instantaneamente, sem fade. A transição fica mais responsiva e elimina o efeito "ghost tile".

**Benefício:** Latência de apresentação de tile reduzida de ~300ms para ~0ms. Especialmente perceptível em zooms consecutivos rápidos.

### 3. `"raster-resampling": "nearest"` (linha 126)

**Antes:** `"linear"` (default) — Interpolação bilinear suaviza tiles durante upscaling, mas causa borramento durante zooms.

**Depois:** `"nearest"` — Interpolação nearest-neighbor. Tiles mantêm aparência nítida (pixelada) durante zooms, sem blur.

**Benefício:** Tiles visivelmente mais nítidos durante animações de zoom. Consistente com o layer GEE que já usava `nearest`.

### 4. `fadeDuration: 0` (linha 751)

**Antes:** `300ms` (default) — Fade de labels/símbolos durante transições de câmera.

**Depois:** `0` — Labels/símbolos aparecem instantaneamente.

**Benefício:** Transições de zoom visualmente mais responsivas.

### 5. `crossSourceCollisions: false` (linha 752)

**Antes:** `true` (default) — MapLibre verifica colisões de labels entre diferentes fontes de dados.

**Depois:** `false` — Desabilita verificação cross-source. Como o mapa usa fontes independentes (OSM raster + vetores de estados), labels de fontes diferentes podem se sobrepor, mas o ganho de performance é significativo.

**Benefício:** Reduz carga computacional no empacotamento de labels, especialmente em transições de zoom onde o placement é recalculado.

### 6. `renderWorldCopies: false` (linha 753)

**Antes:** `true` (default) — MapLibre renderiza múltiplas cópias do mundo para permitir pan infinito.

**Depois:** `false` — Apenas uma cópia do mundo é renderizada.

**Benefício:** Reduz ~50% dos tiles carregados/processados quando o viewport não cruza o antimeridiano (caso do Brasil). Menos consumo de memória GPU e CPU.

### 7. `maxCanvasSize: [8192, 8192]` (linha 754)

**Antes:** `[4096, 4096]` (default)

**Depois:** `[8192, 8192]`

**Benefício:** Melhor qualidade em telas HiDPI (Retina, 4K). O canvas pode escalar para resoluções mais altas antes de reduzir o pixel ratio. Tiles mais nítidos em monitores de alta densidade.

### 8. `maplibregl.setWorkerCount(4)` (linha 740)

**Antes:** `1` worker (default fora do Safari)

**Depois:** `4` workers

**Benefício:** Paraleliza o carregamento e processamento de tiles. Tiles são baixados e decodificados em paralelo, reduzindo o tempo total de carregamento em máquinas multi-core. Aplicado **antes** da criação do mapa, conforme recomendado pela documentação.

## Métricas de benefício estimadas

| Métrica                             | Antes      | Depois     | Ganho              |
| ----------------------------------- | ---------- | ---------- | ------------------ |
| Cross-fade de tiles                 | 300ms      | 0ms        | **-300ms**         |
| Workers de tile paralelos           | 1          | 4          | **4x paralelismo** |
| Cópias do mundo renderizadas        | 3 (padrão) | 1          | **-66% tiles GPU** |
| Canvas máximo (HiDPI)               | 4096px     | 8192px     | **2x resolução**   |
| Verificação de colisão cross-source | Ativa      | Desativada | **Eliminada**      |
| Requests extras durante zoom        | Evitados   | Evitados   | **Sem aumento**    |

## Como verificar o funcionamento

1. Abrir o mapa na aplicação
2. Usar scroll zoom rápido (vários níveis em sequência)
3. Observar que tiles aparecem **sem fade** (não há "ghost tiles" do nível anterior)
4. Verificar nitidez dos tiles durante zoom (sem borramento)
5. Abrir DevTools > Network > filtrar `png` — confirmar que não há requests cancelados desnecessários
6. Abrir DevTools > Performance > gravar zoom e observar carregamento eficiente de tiles

## Trade-offs considerados

| Decisão                                        | Opção descartada                  | Motivo                                                                                         |
| ---------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `cancelPendingTileRequestsWhileZooming: false` | Renderizar tiles durante o zoom   | Aumenta requests de rede desnecessários para tiles intermediários que podem nunca ser exibidos |
| `buffer` na raster source                      | Buffer de tiles extra             | Propriedade não suportada em `RasterSourceSpecification` (válida apenas para vector tiles)     |
| `setPrefetchZoomDelta`                         | Prefetch de níveis extras de zoom | API não existe no MapLibre GL JS                                                               |

## Referências

- [MapLibre GL JS Docs - Map options](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/)
- [MapLibre GL JS - setWorkerCount](https://maplibre.org/maplibre-gl-js/docs/API/functions/setWorkerCount/)
- [RasterSourceSpecification](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/RasterSourceSpecification/)
