#!/usr/bin/env bash
# Publica uma nova versão do container só depois de provar que ela responde.
#
# O deploy anterior era `docker rm -f` seguido de `docker run`: a versão que
# estava funcionando era destruída antes de existir qualquer evidência de que a
# nova subia. Uma imagem quebrada deixava o site fora do ar até alguém perceber
# e não havia para onde voltar.
#
# Aqui o container antigo é parado, não removido, e só é descartado depois que a
# nova versão passa no health check. Se ela não passar, o antigo volta sozinho.
#
#   IMAGE=repo/app:latest CONTAINER_NAME=sap-frontend-app HOST_PORT=3000 \
#     CONTAINER_PORT=3000 NETWORK_NAME=sap ./scripts/deploy-container.sh
set -euo pipefail

: "${IMAGE:?IMAGE é obrigatório (ex.: ocaufcg/sap-frontend:latest)}"
: "${CONTAINER_NAME:?CONTAINER_NAME é obrigatório (ex.: sap-frontend-app)}"
: "${HOST_PORT:?HOST_PORT é obrigatório (ex.: 3000)}"
: "${CONTAINER_PORT:?CONTAINER_PORT é obrigatório (ex.: 3000)}"
: "${NETWORK_NAME:?NETWORK_NAME é obrigatório (ex.: sap-network)}"

PREVIOUS_CONTAINER="${CONTAINER_NAME}-previous"
# Tile z0/0/0 do brazil-states: existe de verdade, não exige login e exercita
# rota + leitura do MBTiles, então prova bem mais que "o processo subiu".
HEALTH_PATH="${HEALTH_PATH:-/api/tiles/0/0/0?tileset=states}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
# Teto para o container antigo encerrar sozinho. Só vira espera real se o processo
# travar: com o Next como PID 1 o desligamento medido foi de 739ms.
STOP_TIMEOUT_SECONDS="${STOP_TIMEOUT_SECONDS:-20}"

# Mesma lista serve para o --preserve-env do sudo e para os -e do docker run,
# para as duas nunca saírem de sincronia.
FORWARDED_ENV_VARS=(
  GEE_PRIVATE_KEY
  FIREBASE_PROJECT_ID
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY_BASE64
  FIREBASE_TELEMETRY_COLLECTION
  LOGS_ALLOWED_EMAILS
  CONTENTFUL_MANAGEMENT_TOKEN
  DOCS_DEFAULT
  NEXT_PUBLIC_HOST_URL
)

# Os runners self-hosted exigem sudo para falar com o daemon; um ambiente onde o
# usuário está no grupo docker, não. Manter isso injetável é o que torna o script
# testável de ponta a ponta sem afrouxar nada no deploy real.
DOCKER_SUDO="${DOCKER_SUDO-sudo}"

docker_as_root() {
  if [[ -z "$DOCKER_SUDO" ]]; then
    docker "$@"
    return
  fi

  "$DOCKER_SUDO" docker "$@"
}

docker_run_forwarding_env() {
  local preserve_list="$1"
  shift

  if [[ -z "$DOCKER_SUDO" ]]; then
    docker run "$@"
    return
  fi

  "$DOCKER_SUDO" --preserve-env="$preserve_list" docker run "$@"
}

health_url() {
  echo "http://localhost:${HOST_PORT}${HEALTH_PATH}"
}

container_exists() {
  docker_as_root container inspect "$1" >/dev/null 2>&1
}

ensure_network() {
  if docker_as_root network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Rede já existe: $NETWORK_NAME"
    return
  fi

  docker_as_root network create "$NETWORK_NAME"
  echo "Rede criada: $NETWORK_NAME"
}

connect_network() {
  # Já conectado devolve erro; reconectar não é problema nenhum.
  docker_as_root network connect "$NETWORK_NAME" "$1" 2>/dev/null || true
}

start_container() {
  local env_flags=()
  local variable_name
  for variable_name in "${FORWARDED_ENV_VARS[@]}"; do
    env_flags+=(-e "$variable_name")
  done

  local preserve_list
  preserve_list=$(
    IFS=,
    echo "${FORWARDED_ENV_VARS[*]}"
  )

  docker_run_forwarding_env "$preserve_list" \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    "${env_flags[@]}" \
    -d "$IMAGE"
}

wait_until_healthy() {
  local url
  url=$(health_url)
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  while ((SECONDS < deadline)); do
    if curl -fsS -o /dev/null --max-time 10 "$url"; then
      echo "Health check OK: $url"
      return 0
    fi
    sleep 2
  done

  echo "Health check falhou depois de ${HEALTH_TIMEOUT_SECONDS}s: $url" >&2
  return 1
}

# O primeiro request paga o carregamento dos módulos e o preenchimento dos caches
# em memória. Pagar aqui evita que o primeiro usuário real pague. Só cobre rotas
# sem login: o aquecimento do Earth Engine exige sessão e continua acontecendo no
# primeiro acesso autenticado.
warm_up() {
  local paths=(
    "/api/tiles/0/0/0?tileset=states"
    "/api/tiles/5/9/17?tileset=cities"
    "/"
  )
  local path

  for path in "${paths[@]}"; do
    if curl -fsSL -o /dev/null --max-time 30 "http://localhost:${HOST_PORT}${path}"; then
      echo "Aquecido: $path"
    else
      echo "Aquecimento falhou e foi ignorado: $path"
    fi
  done
}

roll_back_to_previous() {
  echo "::error::A nova imagem não respondeu ao health check; restaurando a versão anterior."
  docker_as_root logs --tail 100 "$CONTAINER_NAME" 2>&1 || true
  docker_as_root rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

  if ! container_exists "$PREVIOUS_CONTAINER"; then
    echo "::error::Não havia versão anterior para restaurar em ${CONTAINER_NAME}."
    exit 1
  fi

  docker_as_root rename "$PREVIOUS_CONTAINER" "$CONTAINER_NAME"
  docker_as_root start "$CONTAINER_NAME"
  connect_network "$CONTAINER_NAME"

  if wait_until_healthy; then
    echo "Rollback concluído: a versão anterior voltou a atender."
  else
    echo "::error::O rollback também não respondeu. Precisa de intervenção manual."
  fi

  exit 1
}

retire_current_container() {
  # Sobra de um deploy interrompido: sem remover, o rename abaixo falha.
  if container_exists "$PREVIOUS_CONTAINER"; then
    docker_as_root rm -f "$PREVIOUS_CONTAINER"
  fi

  if ! container_exists "$CONTAINER_NAME"; then
    echo "Nenhum container em execução para substituir."
    return
  fi

  docker_as_root rename "$CONTAINER_NAME" "$PREVIOUS_CONTAINER"
  # stop, e não rm: é este container que volta se a nova imagem falhar. Encerrar
  # com sinal, em vez de matar, deixa os requests em andamento terminarem.
  docker_as_root stop --time "$STOP_TIMEOUT_SECONDS" "$PREVIOUS_CONTAINER"
}

main() {
  # Sem curl não há como verificar nada, e um deploy cego é exatamente o que este
  # script existe para evitar. Falha antes de encostar no container em execução.
  if ! command -v curl >/dev/null 2>&1; then
    echo "::error::curl não está instalado neste runner; o health check é obrigatório." >&2
    exit 1
  fi

  ensure_network
  retire_current_container
  start_container
  connect_network "$CONTAINER_NAME"

  if ! wait_until_healthy; then
    roll_back_to_previous
  fi

  warm_up

  if container_exists "$PREVIOUS_CONTAINER"; then
    docker_as_root rm -f "$PREVIOUS_CONTAINER"
  fi

  echo "Deploy concluído: ${CONTAINER_NAME} rodando ${IMAGE}."
}

main "$@"
