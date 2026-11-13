# Parte comum de conversar.sh e da página de chat (motor "claude"). Não rode direto: é carregado com "source".
#
# Monta a configuração do servidor MCP e as opções do claude que deixam o modelo
# só com as ferramentas do SEDES: sem Bash, sem leitura de arquivos, sem web,
# sem skills e sem o CLAUDE.md do repositório.

PACOTE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SEDES_BASE_URL="${SEDES_BASE_URL:-http://localhost:3000}"
export SEDES_MULTICRITERIO_URL="${SEDES_MULTICRITERIO_URL:-http://127.0.0.1:8000}"

if [ ! -f "$PACOTE/data/sedes.sqlite" ]; then
  echo "Falta o tabelão. Rode antes: (cd $PACOTE && npm install && npm run tabelao)" >&2
  exit 1
fi
if [ ! -x "$PACOTE/node_modules/.bin/tsx" ]; then
  echo "Faltam as dependências. Rode antes: (cd $PACOTE && npm install)" >&2
  exit 1
fi
if ! curl -s -o /dev/null --max-time 5 "$SEDES_BASE_URL/api/health"; then
  echo "Aviso: o site não respondeu em $SEDES_BASE_URL; a ferramenta de relatório vai falhar." >&2
fi
if ! curl -s -o /dev/null --max-time 5 "$SEDES_MULTICRITERIO_URL/api/v1/criterias"; then
  echo "Aviso: a Priorização (backend SAP-analise-multicriterial) não respondeu em $SEDES_MULTICRITERIO_URL; a ferramenta priorizar_municipios vai falhar e o prompt sai sem a lista de critérios. Veja o README." >&2
fi

# Diretório fora do repositório: o claude não acha CLAUDE.md, memória nem .claude/ do projeto.
# SEDES_SESSAO separa a avaliação (ou outra cópia do pacote) da página que já está aberta.
SESSAO="${SEDES_SESSAO:-${XDG_CACHE_HOME:-$HOME/.cache}/sedes-chatbot}"
mkdir -p "$SESSAO"
cat > "$SESSAO/mcp.json" <<JSON
{
  "mcpServers": {
    "sedes": {
      "command": "$PACOTE/node_modules/.bin/tsx",
      "args": ["$PACOTE/src/servidor.ts"],
      "env": {
        "SEDES_BASE_URL": "$SEDES_BASE_URL",
        "SEDES_MULTICRITERIO_URL": "$SEDES_MULTICRITERIO_URL",
        "NODE_NO_WARNINGS": "1"
      }
    }
  }
}
JSON

# prompt.md + catálogo de índices + textos + Priorização + data de hoje (src/prompt-sistema.ts, o mesmo do motor api).
if ! NODE_NO_WARNINGS=1 "$PACOTE/node_modules/.bin/tsx" "$PACOTE/src/prompt-sistema.ts" > "$SESSAO/prompt.md"; then
  echo "Não consegui montar o prompt do sistema (src/prompt-sistema.ts)." >&2
  exit 1
fi
OPCOES_CLAUDE=(
  --mcp-config "$SESSAO/mcp.json"
  --strict-mcp-config
  --tools ""
  --allowedTools "mcp__sedes"
  --setting-sources ""
  --disable-slash-commands
  --system-prompt-file "$SESSAO/prompt.md"
)
# Mesmo ajuste do motor api: low | medium | high (sem a variável, o padrão do modelo).
if [ -n "${SEDES_CHAT_ESFORCO:-}" ]; then
  OPCOES_CLAUDE+=(--effort "$SEDES_CHAT_ESFORCO")
fi

# Os apelidos do claude podem apontar para versões antigas (em 12/11/2026,
# "haiku" ia para o Haiku 4.5 e "sonnet" para o Sonnet 5), então fixamos os ids.
modelo_id() {
  case "$1" in
    haiku) echo "claude-haiku-5-5" ;;
    sonnet) echo "claude-sonnet-5-5" ;;
    *) echo "$1" ;;
  esac
}
