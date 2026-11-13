#!/usr/bin/env bash
# Parte do deploy.sh que roda na VM de monitoramento, com sudo, a partir da
# cópia dos arquivos em /tmp/sedes-monitoring. Lê o METRICS_TOKEN da entrada.
#
# Os arquivos de configuração entram nos containers como bind mount de um
# arquivo só, que segue o inode: por isso eles são sobrescritos com `cat >`,
# e nunca trocados por `sed -i` ou `mv`, que criam um arquivo novo que o
# container não enxergaria.
set -euo pipefail
cd "$(dirname "$0")"

MONITOR_HOME=/home/ubuntu
PROMETHEUS_YML="$MONITOR_HOME/prometheus/prometheus.yml"
SEDES_DIR="$MONITOR_HOME/prometheus/sedes"
ALERTMANAGER_YML="$MONITOR_HOME/alertmanager/alertmanager.yml"
TOKEN_FILE="$SEDES_DIR/metrics-token"

# Os arquivos novos esperam aqui até passar pelo promtool: uma regra com erro
# copiada direto para a sedes/, que o Prometheus lê, o impediria de subir no
# próximo reinício, e a VM inteira (OCA, DataNE e SEDES) ficaria sem alertas.
staging="$(mktemp -d)"
updated_prometheus_yml="$(mktemp)"
trap 'rm -rf "$staging" "$updated_prometheus_yml"' EXIT

install -d -m 755 "$SEDES_DIR"

token="$(cat)"
if [ -n "$token" ]; then
  (umask 077 && printf '%s' "$token" > "$TOKEN_FILE")
fi
if [ ! -s "$TOKEN_FILE" ]; then
  echo "Falta o METRICS_TOKEN: rode o deploy.sh com METRICS_TOKEN=..." >&2
  exit 1
fi

# --- Prometheus -------------------------------------------------------------

cp "$PROMETHEUS_YML" "$updated_prometheus_yml"
if ! grep -q 'sedes/sedes-alerts.yml' "$updated_prometheus_yml"; then
  sed -i 's|^rule_files:$|rule_files:\n  - "sedes/sedes-alerts.yml"|' "$updated_prometheus_yml"
fi
if ! grep -q '^scrape_config_files:' "$updated_prometheus_yml"; then
  printf '\nscrape_config_files:\n  - "sedes/prometheus-sedes.yml"\n' >> "$updated_prometheus_yml"
fi

# Valida a pasta inteira como o Prometheus a verá, e não só a sedes/: o
# prometheus.yml cita arquivos de outros projetos da VM (a datane/, por
# exemplo), e o promtool falha se eles não estiverem lá. Por cima, o
# prometheus.yml e a sedes/ novos. Como root, para ler o token, que só o root
# lê. Sem o lint de regras duplicadas: o SedesForaDoAr tem uma regra por
# ambiente, com esperas diferentes, e o prometheus-alerts.yml do OCA já repete
# o InstanceDown.
install -m 644 prometheus-sedes.yml sedes-alerts.yml "$staging"/
install -m 600 "$TOKEN_FILE" "$staging"/metrics-token
docker run --rm --user root --entrypoint promtool \
  -v "$MONITOR_HOME/prometheus":/etc/prometheus:ro \
  -v "$staging":/etc/prometheus/sedes:ro \
  -v "$updated_prometheus_yml":/etc/prometheus/prometheus.yml:ro \
  prom/prometheus:latest check config --lint=none /etc/prometheus/prometheus.yml

install -m 644 "$staging"/prometheus-sedes.yml "$staging"/sedes-alerts.yml "$SEDES_DIR"/
if ! cmp -s "$updated_prometheus_yml" "$PROMETHEUS_YML"; then
  cp "$PROMETHEUS_YML" "$PROMETHEUS_YML.bak-$(date +%Y%m%d%H%M%S)"
  cat "$updated_prometheus_yml" > "$PROMETHEUS_YML"
fi

if docker inspect prometheus --format '{{range .Mounts}}{{.Destination}} {{end}}' | grep -q '/etc/prometheus/sedes'; then
  curl -fsS -X POST http://localhost:9090/-/reload
else
  # Primeira vez: o container antigo não monta o diretório sedes/. Ele é
  # recriado com os mesmos volumes e argumentos e mais esse; os dados ficam no
  # volume ubuntu_prometheus-data. O antigo só é apagado depois que o novo sobe.
  restore_old_prometheus() {
    echo "O Prometheus novo não subiu; voltando o antigo." >&2
    docker rm -f prometheus >/dev/null 2>&1 || true
    docker rename prometheus-antes-do-sedes prometheus
    docker start prometheus
    exit 1
  }
  docker stop prometheus
  docker rename prometheus prometheus-antes-do-sedes
  # Sem o `if`, o set -e encerraria o script aqui, com o antigo ainda parado.
  if ! docker run -d --name prometheus --restart unless-stopped --user root \
    --network ubuntu_monitoring --network-alias prometheus -p 9090:9090 \
    -v "$PROMETHEUS_YML":/etc/prometheus/prometheus.yml \
    -v "$MONITOR_HOME/prometheus/prometheus-alerts.yml":/etc/prometheus/prometheus-alerts.yml \
    -v "$SEDES_DIR":/etc/prometheus/sedes:ro \
    -v ubuntu_prometheus-data:/prometheus \
    prom/prometheus:latest \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus \
    --web.console.libraries=/etc/prometheus/console_libraries \
    --web.console.templates=/etc/prometheus/consoles \
    --web.enable-lifecycle; then
    restore_old_prometheus
  fi
  for _ in $(seq 60); do
    curl -fsS http://localhost:9090/-/ready >/dev/null 2>&1 && break
    sleep 2
  done
  curl -fsS http://localhost:9090/-/ready >/dev/null || restore_old_prometheus
  docker rm prometheus-antes-do-sedes

  # Para um `docker compose up` futuro não recriar o container sem o sedes/.
  if ! grep -q '/etc/prometheus/sedes' "$MONITOR_HOME/docker-compose.yml"; then
    updated_compose="$(mktemp)"
    sed 's|^\(\s*\)- ./prometheus/prometheus-alerts.yml:/etc/prometheus/prometheus-alerts.yml$|&\n\1- ./prometheus/sedes:/etc/prometheus/sedes:ro|' \
      "$MONITOR_HOME/docker-compose.yml" > "$updated_compose"
    cat "$updated_compose" > "$MONITOR_HOME/docker-compose.yml"
    rm -f "$updated_compose"
  fi
fi

# --- Alertmanager -----------------------------------------------------------

updated_alertmanager_yml="$(mktemp)"
python3 merge_alertmanager.py "$ALERTMANAGER_YML" alertmanager-sedes.yml > "$updated_alertmanager_yml"
docker run --rm --user root --entrypoint amtool -v "$updated_alertmanager_yml":/check.yml:ro \
  prom/alertmanager:latest check-config /check.yml

if ! cmp -s "$updated_alertmanager_yml" "$ALERTMANAGER_YML"; then
  cp "$ALERTMANAGER_YML" "$ALERTMANAGER_YML.bak-$(date +%Y%m%d%H%M%S)"
  cat "$updated_alertmanager_yml" > "$ALERTMANAGER_YML"
  curl -fsS -X POST http://localhost:9093/-/reload
fi
rm -f "$updated_alertmanager_yml"

# O alerta do SEDES depende dele, e ele estava sem reinício automático: depois
# de um reboot da VM, os alertas parariam sem ninguém perceber.
docker update --restart unless-stopped alertmanager >/dev/null

echo "SEDES configurado na VM de monitoramento."
