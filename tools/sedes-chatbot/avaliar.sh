#!/usr/bin/env bash
# Roda as perguntas de perguntas.md no bot, sem interação, e grava respostas,
# ferramentas chamadas e tempo em resultados/<modelo>.md.
#
# Uso:
#   ./avaliar.sh                       # todas as perguntas, haiku e sonnet
#   ./avaliar.sh haiku                 # só um modelo
#   PERGUNTAS="C01 P01" ./avaliar.sh   # só algumas perguntas (bom para testar)
set -euo pipefail
source "$(dirname "$0")/comum.sh"
MODELOS=("$@")
[ ${#MODELOS[@]} -eq 0 ] && MODELOS=(haiku sonnet)
TSX="$PACOTE/node_modules/.bin/tsx"

for apelido in "${MODELOS[@]}"; do
  modelo="$(modelo_id "$apelido")"
  brutos="$PACOTE/resultados/brutos/$modelo"
  mkdir -p "$brutos"
  while IFS=$'\t' read -r id pergunta; do
    if [ -n "${PERGUNTAS:-}" ] && [[ " $PERGUNTAS " != *" $id "* ]]; then continue; fi
    echo "[$modelo] $id: $pergunta" >&2
    inicio=$(date +%s.%N)
    (cd "$SESSAO" && claude -p "$pergunta" --model "$modelo" \
      --output-format stream-json --verbose --no-session-persistence \
      "${OPCOES_CLAUDE[@]}" < /dev/null 2>/dev/null) > "$brutos/$id.jsonl" || true
    fim=$(date +%s.%N)
    echo "{\"type\":\"avaliar_tempo\",\"segundos\":$(awk "BEGIN{printf \"%.1f\", $fim - $inicio}")}" >> "$brutos/$id.jsonl"
  done < <("$TSX" "$PACOTE/src/avaliacao.ts" listar)
  "$TSX" "$PACOTE/src/avaliacao.ts" resumir "$modelo"
done
