#!/usr/bin/env bash
# Instala (ou atualiza) a rotação dos logs dos containers na VM em que roda.
# Chamado pelo workflow docker-logs.yaml, com sudo, a partir da raiz do
# repositório.
set -euo pipefail

# O vigia antigo, em que cada VM conferia a outra, foi substituído pela VM de
# monitoramento (scripts/monitoring/). Sai daqui para não mandar e-mail
# repetido.
rm -f /etc/cron.d/sedes-watchdog
rm -rf /opt/sedes-watchdog /etc/sedes-watchdog /var/lib/sedes-watchdog

# Já gira agora o que passou do limite, em vez de esperar a rodada diária.
install -m 644 scripts/docker-logs/docker-logs.logrotate /etc/logrotate.d/docker-containers
logrotate /etc/logrotate.d/docker-containers
