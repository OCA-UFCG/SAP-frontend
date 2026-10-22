#!/usr/bin/env python3
"""Junta o trecho do SEDES ao alertmanager.yml compartilhado da VM.

Substitui o que uma execução anterior tiver posto (a rota com
project="sedes", os receptores sedes-* e as inibições que partem de alertas
Sedes*) e deixa o resto do arquivo como estava. Pode rodar quantas vezes for.

    python3 merge_alertmanager.py alertmanager.yml alertmanager-sedes.yml > novo.yml
"""

import sys

import yaml

SEDES_MATCHER = 'project="sedes"'


def is_sedes_route(route: dict) -> bool:
    return SEDES_MATCHER in route.get("matchers", [])


def is_sedes_inhibition(rule: dict) -> bool:
    return any('alertname="Sedes' in m for m in rule.get("source_matchers", []))


def merge(config: dict, sedes: dict) -> dict:
    root = config.setdefault("route", {})
    routes = [r for r in root.get("routes", []) if not is_sedes_route(r)]
    root["routes"] = [sedes["route"], *routes]

    inhibitions = [r for r in config.get("inhibit_rules", []) if not is_sedes_inhibition(r)]
    config["inhibit_rules"] = inhibitions + sedes["inhibit_rules"]

    receivers = [r for r in config.get("receivers", []) if not r["name"].startswith("sedes-")]
    config["receivers"] = receivers + sedes["receivers"]
    return config


def main() -> None:
    with open(sys.argv[1], encoding="utf-8") as current, open(sys.argv[2], encoding="utf-8") as snippet:
        merged = merge(yaml.safe_load(current), yaml.safe_load(snippet))
    yaml.safe_dump(merged, sys.stdout, allow_unicode=True, sort_keys=False, width=1000)


if __name__ == "__main__":
    main()
