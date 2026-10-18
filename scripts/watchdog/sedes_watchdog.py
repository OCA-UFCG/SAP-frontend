#!/usr/bin/env python3
"""Vigia um ambiente do SEDES e avisa a equipe por e-mail quando ele cai.

Roda pelo cron a cada minuto (veja install.sh). Cada execução chama o
`/api/health` do ambiente vigiado uma vez, compara com o que viu nas execuções
anteriores (guardado num arquivo de estado) e manda e-mail em três momentos:
quando o ambiente cai, quando o que falha muda e quando ele volta.

Cada VM vigia o ambiente da OUTRA: a do beta vigia a produção e a da produção
vigia o beta. Assim a queda da VM inteira também chega à equipe, o que um vigia
rodando na própria VM nunca conseguiria avisar.

Só usa a biblioteca padrão do Python, que as duas VMs já têm.

    python3 sedes_watchdog.py --env /etc/sedes-watchdog/env
    python3 sedes_watchdog.py --env /etc/sedes-watchdog/env --test-email
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from zoneinfo import ZoneInfo

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
REQUEST_TIMEOUT_SECONDS = 25
BRASILIA = ZoneInfo("America/Sao_Paulo")

DEPENDENCY_LABELS = {
    "gee": "Earth Engine",
    "contentful": "Contentful",
    "firebase": "Firebase",
    "multicriteria": "backend multicritério",
    "smtp": "envio de e-mail (SMTP)",
}

FAILURE_LABELS = {
    "timeout": "não respondeu a tempo",
    "not configured": "está sem credencial configurada",
    "failed": "deu erro",
}


def load_env(path: str) -> dict[str, str]:
    """Lê um arquivo KEY=VALUE, sem aspas nem expansão."""
    values: dict[str, str] = {}
    with open(path, encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def describe_health_failure(status: int, body: bytes) -> tuple[str, str]:
    """A falha em palavras e uma chave curta para perceber quando ela muda.

    Um 503 do `/api/health` lista os serviços que falharam; qualquer outra
    resposta quer dizer que o próprio site não está de pé.
    """
    if status == 503:
        try:
            dependencies = json.loads(body)["dependencies"]
            failing = sorted(
                name for name, result in dependencies.items() if not result["ok"]
            )
        except (ValueError, KeyError, TypeError, AttributeError):
            failing = []

        if failing:
            parts = []
            for name in failing:
                label = DEPENDENCY_LABELS.get(name, name)
                error = dependencies[name].get("error", "failed")
                parts.append(f"{label} {FAILURE_LABELS.get(error, f'respondeu {error}')}")
            return "O site está no ar, mas: " + "; ".join(parts) + ".", "deps:" + ",".join(failing)

    return f"O site respondeu HTTP {status}.", "down"


def check(url: str) -> tuple[bool, str, str]:
    """(está de pé, a falha em palavras, a chave da falha)."""
    request = urllib.request.Request(url, headers={"User-Agent": "sedes-watchdog"})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
            return True, "", ""
    except urllib.error.HTTPError as error:
        problem, key = describe_health_failure(error.code, error.read(65536))
        return False, problem, key
    except Exception as error:  # noqa: BLE001 — qualquer falha de rede é "fora do ar"
        reason = getattr(error, "reason", error)
        return False, f"O site não respondeu ({reason}).", "down"


def decide(
    state: dict,
    ok: bool,
    problem: str,
    key: str,
    now: float,
    failures_before_alert: int,
    reminder_minutes: int,
) -> tuple[dict, str | None]:
    """O estado novo e qual e-mail mandar agora, se algum.

    Os e-mails são "down", "changed", "reminder" e "recovered". Um alerta só
    sai depois de `failures_before_alert` falhas seguidas, para a troca de
    container de um deploy, que derruba o site por alguns segundos, não virar
    e-mail.
    """
    if ok:
        return {}, ("recovered" if state.get("alerted_at") else None)

    new_state = {
        **state,
        "failures": state.get("failures", 0) + 1,
        "first_failure_at": state.get("first_failure_at") or now,
        "problem": problem,
    }

    if not state.get("alerted_at"):
        if new_state["failures"] < failures_before_alert:
            return new_state, None
        return {**new_state, "alerted_at": now, "notified_at": now, "key": key}, "down"

    if key != state.get("key"):
        return {**new_state, "notified_at": now, "key": key}, "changed"

    if reminder_minutes > 0 and now - state["notified_at"] >= reminder_minutes * 60:
        return {**new_state, "notified_at": now}, "reminder"

    return new_state, None


def format_time(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, BRASILIA).strftime("%d/%m às %H:%M")


def format_duration(seconds: float) -> str:
    minutes = max(1, round(seconds / 60))
    if minutes < 60:
        return f"{minutes} min"
    hours, minutes = divmod(minutes, 60)
    return f"{hours} h {minutes:02d} min"


def compose(kind: str, state: dict, config: dict[str, str], now: float) -> tuple[str, str]:
    name = config["WATCHDOG_TARGET_NAME"]
    since = format_time(state["first_failure_at"])
    footer = (
        f"\n\nEndereço verificado: {config['WATCHDOG_URL']}\n"
        f"Quem verificou: {config['WATCHDOG_WATCHER']}, a cada minuto.\n"
        "O erro completo fica no log do container (docker logs), nas linhas com [health]."
    )

    if kind == "recovered":
        subject = f"[{name}] voltou ao ar"
        body = (
            f"O {name} voltou a responder normalmente.\n\n"
            f"Ficou com problema por {format_duration(now - state['first_failure_at'])}, "
            f"desde {since} (horário de Brasília)."
        )
        return subject, body + footer

    subjects = {
        "down": f"[{name}] fora do ar",
        "changed": f"[{name}] o problema mudou",
        "reminder": f"[{name}] continua fora do ar",
    }
    body = (
        f"O {name} está com problema desde {since} (horário de Brasília).\n\n"
        f"{state['problem']}\n\n"
        "Outro e-mail chega quando ele voltar."
    )
    return subjects[kind], body + footer


def send(config: dict[str, str], subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = config.get("SMTP_FROM") or config["SMTP_USER"]
    message["To"] = config["ALERT_EMAIL_TO"]
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="sedes-watchdog")
    message.set_content(body)

    with smtplib.SMTP_SSL(
        SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(), timeout=30
    ) as smtp:
        smtp.login(config["SMTP_USER"], config["SMTP_PASSWORD"])
        smtp.send_message(message)


def read_state(path: str) -> dict:
    try:
        with open(path, encoding="utf-8") as state_file:
            return json.load(state_file)
    except (FileNotFoundError, ValueError):
        return {}


def write_state(path: str, state: dict) -> None:
    temporary = f"{path}.tmp"
    with open(temporary, "w", encoding="utf-8") as state_file:
        json.dump(state, state_file)
    os.replace(temporary, path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", required=True)
    parser.add_argument(
        "--test-email",
        action="store_true",
        help="manda um e-mail avisando que o vigia foi ligado e sai",
    )
    args = parser.parse_args()
    config = load_env(args.env)

    if args.test_email:
        name = config["WATCHDOG_TARGET_NAME"]
        send(
            config,
            f"[{name}] alerta por e-mail ligado",
            f"A partir de agora, {config['WATCHDOG_WATCHER']} confere o {name} a cada "
            f"minuto em {config['WATCHDOG_URL']} e avisa este endereço quando ele cair "
            "e quando voltar.\n\nEste e-mail é só a confirmação de que o envio funciona.",
        )
        print(f"e-mail de teste enviado para {config['ALERT_EMAIL_TO']}")
        return 0

    state_path = config["WATCHDOG_STATE_FILE"]
    state = read_state(state_path)
    now = time.time()
    ok, problem, key = check(config["WATCHDOG_URL"])
    new_state, kind = decide(
        state,
        ok,
        problem,
        key,
        now,
        int(config.get("WATCHDOG_FAILURES_BEFORE_ALERT", "2")),
        int(config.get("WATCHDOG_REMINDER_MINUTES", "0")),
    )

    if not ok:
        print(f"falha {new_state['failures']}: {problem}")

    if kind:
        subject, body = compose(kind, new_state if not ok else state, config, now)
        try:
            send(config, subject, body)
            print(f"e-mail enviado: {subject}")
        except Exception as error:  # noqa: BLE001
            # O estado antigo fica, para a próxima execução tentar o mesmo
            # e-mail de novo; só a contagem de falhas anda.
            print(f"não consegui mandar o e-mail '{subject}': {error}", file=sys.stderr)
            new_state = state if ok else {
                **state,
                "failures": new_state["failures"],
                "first_failure_at": new_state["first_failure_at"],
                "problem": problem,
            }

    write_state(state_path, new_state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
