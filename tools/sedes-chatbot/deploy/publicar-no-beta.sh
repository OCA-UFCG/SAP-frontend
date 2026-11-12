#!/usr/bin/env bash
# Sobe a página de chat na VM do beta. Roda no runner da própria VM, chamado
# pelo workflow cd-chatbot-beta.yaml:
#   1. baixa o tabelão da release tiles-2025, só quando o anexo mudou;
#   2. monta a imagem a partir do checkout;
#   3. troca o container, e volta ao anterior se o novo não responder.
#
# O container não publica porta: o nginx do beta chega nele pela rede do
# Docker, pelo nome (veja nginx-chat.conf).
set -euo pipefail

: "${ANTHROPIC_API_KEY:?falta o secret SEDES_CHAT_ANTHROPIC_API_KEY}"
: "${SEDES_CHAT_EMAILS:?falta a variável SEDES_CHAT_EMAILS (quem pode usar)}"
: "${FIREBASE_PROJECT_ID:?falta FIREBASE_PROJECT_ID}"
: "${GH_TOKEN:?}" "${REPOSITORIO:?}" "${REDE:?}"

NOME="${CONTAINER:-sedes-chat-beta}"
PASTA="${PASTA:-/home/ubuntu/sedes-chatbot}"
IMAGEM="sedes-chat:beta"
RELEASE="tiles-2025"
ANEXO="sedes-chatbot-tabelao.sqlite.gz"
ENV_DO_CONTAINER=(
  ANTHROPIC_API_KEY SEDES_CHAT_EMAILS FIREBASE_PROJECT_ID SEDES_CHAT_ORIGEM
  SEDES_BASE_URL SEDES_CHAT_MODELOS SEDES_CHAT_PERGUNTAS_POR_DIA
  SEDES_CHAT_TETO_DIARIO_USD
)

sudo mkdir -p "$PASTA/dados" "$PASTA/conversas"
# O processo do container roda como o usuário node (uid 1000).
sudo chown 1000:1000 "$PASTA/conversas"

# --- 1. tabelão --------------------------------------------------------------
api() { curl -fsSL -H "Authorization: Bearer $GH_TOKEN" "$@"; }
versao=$(api "https://api.github.com/repos/$REPOSITORIO/releases/tags/$RELEASE" |
  jq -r --arg n "$ANEXO" '.assets[] | select(.name == $n) | "\(.id) \(.updated_at)"')
if [ -z "$versao" ]; then
  echo "Falta o anexo $ANEXO na release $RELEASE. Rode deploy/publicar-tabelao.sh." >&2
  exit 1
fi
if [ "$(sudo cat "$PASTA/dados/versao" 2>/dev/null)" != "$versao" ]; then
  echo "Baixando o tabelão ($versao)..."
  api -H "Accept: application/octet-stream" \
    "https://api.github.com/repos/$REPOSITORIO/releases/assets/${versao%% *}" |
    pigz -dc | sudo tee "$PASTA/dados/sedes.sqlite.novo" > /dev/null
  # Troca de uma vez: o container antigo continua lendo o arquivo que já abriu.
  sudo mv "$PASTA/dados/sedes.sqlite.novo" "$PASTA/dados/sedes.sqlite"
  echo "$versao" | sudo tee "$PASTA/dados/versao" > /dev/null
else
  echo "Tabelão já está na versão do anexo ($versao)."
fi

# --- 2. imagem ---------------------------------------------------------------
sudo docker build -f tools/sedes-chatbot/Dockerfile -t "$IMAGEM-novo" .

# --- 3. container ------------------------------------------------------------
responde() {
  sudo docker exec "$1" node -e \
    "fetch('http://127.0.0.1:3210/api/saude').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
    2> /dev/null
}

if sudo docker inspect "$NOME" > /dev/null 2>&1; then
  sudo docker rm -f "$NOME-anterior" > /dev/null 2>&1 || true
  sudo docker stop -t 20 "$NOME" > /dev/null
  sudo docker rename "$NOME" "$NOME-anterior"
fi

env_args=()
for v in "${ENV_DO_CONTAINER[@]}"; do env_args+=(-e "$v"); done
preservar=$(IFS=,; echo "${ENV_DO_CONTAINER[*]}")
sudo --preserve-env="$preservar" docker run -d --name "$NOME" \
  --restart unless-stopped --network "$REDE" --memory 768m \
  -v "$PASTA/dados:/dados:ro" -v "$PASTA/conversas:/conversas" \
  "${env_args[@]}" "$IMAGEM-novo" > /dev/null

for _ in $(seq 60); do
  if responde "$NOME"; then
    echo "Chat no ar."
    sudo docker rm -f "$NOME-anterior" > /dev/null 2>&1 || true
    sudo docker tag "$IMAGEM-novo" "$IMAGEM"
    sudo docker image prune -f > /dev/null
    exit 0
  fi
  sleep 2
done

echo "A versão nova não respondeu em 2 minutos. Log dela:" >&2
sudo docker logs --tail 50 "$NOME" >&2 || true
sudo docker rm -f "$NOME" > /dev/null
if sudo docker inspect "$NOME-anterior" > /dev/null 2>&1; then
  sudo docker rename "$NOME-anterior" "$NOME"
  sudo docker start "$NOME" > /dev/null
  echo "Voltou a versão anterior." >&2
fi
exit 1
