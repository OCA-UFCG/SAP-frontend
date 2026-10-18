#!/usr/bin/env bash
# Instala (ou atualiza) o vigia na VM em que roda. Chamado pelo workflow
# watchdog.yaml, com sudo, a partir da raiz do repositório.
#
# Lê do ambiente: WATCHDOG_TARGET_NAME, WATCHDOG_URL, WATCHDOG_WATCHER,
# WATCHDOG_FAILURES_BEFORE_ALERT, WATCHDOG_REMINDER_MINUTES, ALERT_EMAIL_TO,
# SMTP_USER, SMTP_PASSWORD e SMTP_FROM.
set -euo pipefail

for name in WATCHDOG_TARGET_NAME WATCHDOG_URL WATCHDOG_WATCHER ALERT_EMAIL_TO SMTP_USER SMTP_PASSWORD; do
  if [ -z "${!name:-}" ]; then
    echo "Falta a variável $name" >&2
    exit 1
  fi
done

install -d -m 755 /opt/sedes-watchdog
install -m 755 scripts/watchdog/sedes_watchdog.py /opt/sedes-watchdog/sedes_watchdog.py
install -d -m 700 /etc/sedes-watchdog /var/lib/sedes-watchdog

# A senha do SMTP fica num arquivo que só o root lê.
umask 077
cat > /etc/sedes-watchdog/env <<EOF
WATCHDOG_TARGET_NAME=$WATCHDOG_TARGET_NAME
WATCHDOG_URL=$WATCHDOG_URL
WATCHDOG_WATCHER=$WATCHDOG_WATCHER
WATCHDOG_FAILURES_BEFORE_ALERT=${WATCHDOG_FAILURES_BEFORE_ALERT:-2}
WATCHDOG_REMINDER_MINUTES=${WATCHDOG_REMINDER_MINUTES:-0}
WATCHDOG_STATE_FILE=/var/lib/sedes-watchdog/state.json
ALERT_EMAIL_TO=$ALERT_EMAIL_TO
SMTP_USER=$SMTP_USER
SMTP_PASSWORD=$SMTP_PASSWORD
SMTP_FROM=${SMTP_FROM:-}
EOF

# O flock impede duas execuções juntas se uma verificação demorar mais que um
# minuto. A saída vai para o syslog: journalctl -t sedes-watchdog
umask 022
cat > /etc/cron.d/sedes-watchdog <<'EOF'
* * * * * root flock -n /run/sedes-watchdog.lock /usr/bin/python3 /opt/sedes-watchdog/sedes_watchdog.py --env /etc/sedes-watchdog/env 2>&1 | logger -t sedes-watchdog
EOF

/usr/bin/python3 /opt/sedes-watchdog/sedes_watchdog.py --env /etc/sedes-watchdog/env --test-email
