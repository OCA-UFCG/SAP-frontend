#!/usr/bin/env bash
# Comprime o tabelão (5,1 GB → ~570 MB, 10 s) e anexa à release tiles-2025,
# de onde o deploy do beta baixa. Rode depois de `npm run tabelao` e
# `npm run conferir`, e depois rode o workflow do chat para o beta pegar.
#
# Nunca crie uma release ou tag nova para isto: toda tag nova publica a main
# em produção (cd-deploy-production.yaml).
set -euo pipefail
cd "$(dirname "$0")/.."
saida=data/sedes-chatbot-tabelao.sqlite.gz
pigz -1 -c data/sedes.sqlite > "$saida"
ls -lh "$saida"
gh release upload tiles-2025 "$saida" --clobber
rm "$saida"
