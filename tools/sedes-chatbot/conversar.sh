#!/usr/bin/env bash
# Chat interativo com o bot do SEDES, para a demonstração.
# Uso: ./conversar.sh [modelo]     (modelo: sonnet, o padrão, ou haiku)
set -euo pipefail
source "$(dirname "$0")/comum.sh"
MODELO="$(modelo_id "${1:-sonnet}")"
cd "$SESSAO"
exec claude --model "$MODELO" "${OPCOES_CLAUDE[@]}"
