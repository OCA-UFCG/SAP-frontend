#!/usr/bin/env bash
# Sobe o servidor MCP oficial do Contentful com as credenciais que o projeto já usa.
# O servidor espera CONTENTFUL_MANAGEMENT_ACCESS_TOKEN/SPACE_ID/ENVIRONMENT_ID, que
# não são os nomes daqui; este script faz a tradução e lê o .env local, para que o
# token de gestão não precise ser duplicado nem escrito no .mcp.json versionado.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Lê uma variável do .env sem dar `source` no arquivo: ele tem valores multilinha
# (a chave da service account do GEE) que quebram o shell, e não precisamos deles.
# Aceita o prefixo `export` e aspas simples ou duplas em volta do valor.
read_env_var() {
  local name="$1" file value
  for file in "$ROOT/.env" "$ROOT/.env.local"; do
    [[ -f "$file" ]] || continue
    value="$(sed -n "s/^[[:space:]]*\(export[[:space:]]\+\)\?${name}=//p" "$file" | tail -n 1)"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    [[ -n "$value" ]] && echo "$value"
  done | tail -n 1
  return 0
}

# O ambiente tem precedência sobre o arquivo, para permitir apontar o MCP para outro
# space sem editar o .env.
resolve() {
  local current="$1"; shift
  [[ -n "$current" ]] && { echo "$current"; return 0; }
  local name value
  for name in "$@"; do
    value="$(read_env_var "$name")"
    [[ -n "$value" ]] && { echo "$value"; return 0; }
  done
  # Nenhum nome encontrado não é erro: quem chama decide o padrão. Sem este return,
  # `set -e` derrubaria o script no primeiro nome ausente.
  return 0
}

export CONTENTFUL_MANAGEMENT_ACCESS_TOKEN
CONTENTFUL_MANAGEMENT_ACCESS_TOKEN="$(resolve "${CONTENTFUL_MANAGEMENT_ACCESS_TOKEN:-}" CONTENTFUL_MANAGEMENT_ACCESS_TOKEN CONTENTFUL_MANAGEMENT_TOKEN)"
# Os dois nomes de space id convivem no projeto (src/infrastructure/contentful/client.ts
# aceita ambos), então aceitamos os dois aqui também.
export SPACE_ID
SPACE_ID="$(resolve "${SPACE_ID:-}" CONTENTFUL_SPACE_ID NEXT_PUBLIC_CONTENTFUL_SPACE_ID)"
export ENVIRONMENT_ID
ENVIRONMENT_ID="$(resolve "${ENVIRONMENT_ID:-}" CONTENTFUL_ENVIRONMENT NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT)"
ENVIRONMENT_ID="${ENVIRONMENT_ID:-master}"
# Teto de itens por operação em lote: limita o estrago de um publish ou delete em
# massa disparado por engano. O padrão do servidor é 10.
export MAX_BULK_SIZE="${SAP_MCP_CONTENTFUL_MAX_BULK:-5}"

if [[ -z "$CONTENTFUL_MANAGEMENT_ACCESS_TOKEN" || -z "$SPACE_ID" ]]; then
  echo "Credenciais do Contentful ausentes para o MCP (esperado: CONTENTFUL_MANAGEMENT_TOKEN e CONTENTFUL_SPACE_ID ou NEXT_PUBLIC_CONTENTFUL_SPACE_ID, no ambiente ou em $ROOT/.env). Veja env.sample.txt." >&2
  exit 1
fi

exec npx -y @contentful/mcp-server "$@"
