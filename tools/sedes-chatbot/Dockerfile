# Página de chat do SEDES no beta (motor "api", com login do SEDES).
# Monte da raiz do repositório, que tem o ícone do site e os contornos dos municípios:
#   docker build -f tools/sedes-chatbot/Dockerfile -t sedes-chat:beta .
# O tabelão (5 GB) e as conversas ficam fora da imagem, em pastas da VM:
#   -v <pasta>/dados:/dados:ro  -v <pasta>/conversas:/conversas
# Veja deploy/publicar-no-beta.sh e o README.
FROM node:24-slim

WORKDIR /app/tools/sedes-chatbot
COPY tools/sedes-chatbot/package.json tools/sedes-chatbot/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY public/favicon.svg /app/public/
# Contornos simplificados dos municípios, para o mapa das respostas.
COPY public/data/brazil-cities-overview.json /app/public/data/
COPY tools/sedes-chatbot/prompt.md ./
COPY tools/sedes-chatbot/conhecimento ./conhecimento
COPY tools/sedes-chatbot/src ./src

ENV NODE_ENV=production \
    NODE_NO_WARNINGS=1 \
    SEDES_CHAT_MOTOR=api \
    SEDES_CHAT_HOST=0.0.0.0 \
    SEDES_CHAT_PORTA=3210 \
    SEDES_TABELAO=/dados/sedes.sqlite \
    SEDES_CHAT_CONVERSAS=/conversas

RUN mkdir /conversas && chown node:node /conversas
USER node
EXPOSE 3210
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3210/api/saude').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/chat/servidor-chat.ts"]
