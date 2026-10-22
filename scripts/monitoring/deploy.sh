#!/usr/bin/env bash
# Leva as coletas, os alertas e os e-mails do SEDES para a VM de monitoramento
# (oca-monitor), que vigia a produção e o beta de fora. Roda de uma máquina
# com acesso SSH à VM; pode rodar de novo sempre que um destes arquivos mudar.
#
#   METRICS_TOKEN=... bash scripts/monitoring/deploy.sh ubuntu@34.200.5.32
#
# O METRICS_TOKEN é o mesmo do secret do GitHub que vai para os containers.
# Sem ele, fica o token que já estiver na VM. Ele segue pela entrada do SSH,
# e não pela linha de comando, para não aparecer na lista de processos.
#
# A VM é compartilhada com o DataNE e o OCA. Isto só acrescenta: um diretório
# sedes/ ao Prometheus e uma rota project="sedes" ao Alertmanager.
set -euo pipefail

TARGET="${1:?Informe o destino SSH, ex.: ubuntu@34.200.5.32}"
HERE="$(cd "$(dirname "$0")" && pwd)"

ssh "$TARGET" 'rm -rf /tmp/sedes-monitoring && mkdir -m 700 /tmp/sedes-monitoring'
scp -q "$HERE"/{prometheus-sedes.yml,sedes-alerts.yml,alertmanager-sedes.yml,merge_alertmanager.py,install-on-monitor.sh} \
  "$TARGET":/tmp/sedes-monitoring/
printf '%s' "${METRICS_TOKEN:-}" |
  ssh "$TARGET" 'sudo bash /tmp/sedes-monitoring/install-on-monitor.sh; status=$?; rm -rf /tmp/sedes-monitoring; exit $status'
