# Parte comum de conversar.sh e avaliar.sh. Não rode direto: é carregado com "source".
#
# Monta a configuração do servidor MCP e as opções do claude que deixam o modelo
# só com as ferramentas do SEDES: sem Bash, sem leitura de arquivos, sem web,
# sem skills e sem o CLAUDE.md do repositório.

PACOTE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export SEDES_BASE_URL="${SEDES_BASE_URL:-http://localhost:3000}"

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

# Diretório fora do repositório: o claude não acha CLAUDE.md, memória nem .claude/ do projeto.
SESSAO="${XDG_CACHE_HOME:-$HOME/.cache}/sedes-chatbot"
mkdir -p "$SESSAO"
cat > "$SESSAO/mcp.json" <<JSON
{
  "mcpServers": {
    "sedes": {
      "command": "$PACOTE/node_modules/.bin/tsx",
      "args": ["$PACOTE/src/servidor.ts"],
      "env": { "SEDES_BASE_URL": "$SEDES_BASE_URL", "NODE_NO_WARNINGS": "1" }
    }
  }
}
JSON

HOJE="$(LC_ALL=pt_BR.UTF-8 date '+%d/%m/%Y' 2>/dev/null || date '+%d/%m/%Y')"
OPCOES_CLAUDE=(
  --mcp-config "$SESSAO/mcp.json"
  --strict-mcp-config
  --tools ""
  --allowedTools "mcp__sedes"
  --setting-sources ""
  --disable-slash-commands
  --system-prompt-file "$PACOTE/prompt.md"
  --append-system-prompt "Data de hoje: $HOJE."
)

# Os apelidos do claude podem apontar para versões antigas (em 12/11/2026,
# "haiku" ia para o Haiku 4.5 e "sonnet" para o Sonnet 5), então fixamos os ids.
modelo_id() {
  case "$1" in
    haiku) echo "claude-haiku-5-5" ;;
    sonnet) echo "claude-sonnet-5-5" ;;
    *) echo "$1" ;;
  esac
}
