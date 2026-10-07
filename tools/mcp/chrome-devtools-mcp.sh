#!/usr/bin/env bash
# Sobe o chrome-devtools-mcp apontando para um Chrome que exista nesta máquina.
# O servidor oficial só procura o Chrome instalado no sistema; em WSL/Linux de dev
# normalmente não há nenhum, e o que existe é o Chromium que o Playwright já baixa
# para o projeto (`npx playwright install --with-deps`). Por isso resolvemos o
# executável aqui em vez de fixar um caminho no .mcp.json.
set -euo pipefail

find_playwright_chrome() {
  local cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
  find "$cache" -maxdepth 3 -type f \
    \( -path '*/chrome-linux64/chrome' -o -path '*/chrome-linux/chrome' \) 2>/dev/null |
    sort -V | tail -n 1
}

resolve_chrome() {
  if [[ -n "${CHROME_PATH:-}" ]]; then
    echo "$CHROME_PATH"
    return
  fi
  local system
  for system in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$system" >/dev/null 2>&1; then
      command -v "$system"
      return
    fi
  done
  find_playwright_chrome
}

CHROME="$(resolve_chrome)"
if [[ -z "$CHROME" || ! -x "$CHROME" ]]; then
  echo "Nenhum Chrome encontrado para o chrome-devtools-mcp (esperado: CHROME_PATH apontando para um executável, um google-chrome/chromium no PATH, ou o Chromium do Playwright em ${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}). Rode 'npx playwright install --with-deps' ou defina CHROME_PATH." >&2
  exit 1
fi

# Sem UI por padrão: o dev roda em WSL/servidor, onde não há display.
HEADLESS_FLAG="--headless"
[[ "${SAP_MCP_CHROME_HEADED:-0}" == "1" ]] && HEADLESS_FLAG="--no-headless"

# Perfil persistente (o padrão do servidor): mantém o login da plataforma entre
# sessões, para não refazer o fluxo do Firebase a cada verificação. Use
# SAP_MCP_CHROME_ISOLATED=1 para um perfil descartável.
ISOLATED_FLAG=()
[[ "${SAP_MCP_CHROME_ISOLATED:-0}" == "1" ]] && ISOLATED_FLAG=(--isolated)

exec npx -y chrome-devtools-mcp@latest \
  --executablePath "$CHROME" \
  "$HEADLESS_FLAG" \
  "${ISOLATED_FLAG[@]}" \
  --viewport "${SAP_MCP_CHROME_VIEWPORT:-1440x900}" \
  --usageStatistics=false \
  --no-performance-crux \
  "$@"
