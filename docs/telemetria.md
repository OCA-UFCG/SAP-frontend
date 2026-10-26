# Eventos de uso (telemetria)

A plataforma registra buscas, camadas ligadas e detalhamentos abertos para o
painel de Auditoria (`/platform/logs`). Este documento existe porque **o prazo
de guarda depende de um passo manual no Firebase**, que o código sozinho não faz.

## O que é guardado, e o que não é

Cada evento leva o que aconteceu (busca, camada, data), onde aconteceu (home ou
plataforma), **se a pessoa estava logada** e um id que agrupa os eventos de uma
mesma aba aberta.

Não leva e-mail, uid nem IP. O id da aba fica no `sessionStorage` e some quando
a aba fecha, então não serve para reconhecer o mesmo navegador amanhã.

Até outubro de 2026 cada evento levava o e-mail de quem estava logado e o id
ficava no `localStorage`, sem prazo. Era um registro de "quem buscou o quê", sem
nada na plataforma que dependesse disso.

## Prazo de guarda: 90 dias

Cada evento é gravado com um campo `expireAt` (Timestamp), 90 dias depois de
chegar (`TELEMETRY_RETENTION_DAYS` em
`src/repositories/telemetry/telemetryRepository.ts`). Quem apaga é o **próprio
servidor**, na subida e uma vez por dia (`src/lib/retention-sweep.ts`): cada
ambiente apaga os eventos vencidos da própria coleção.

A TTL do Firestore faria o mesmo, mas só existe no plano pago (Blaze), e o
projeto está no gratuito: em 26/10/2026 o `gcloud firestore fields ttls update`
respondeu "billing disabled". A cota gratuita (20 mil exclusões por dia) sobra
para o volume de eventos. Se o projeto for para o plano pago, dá para ligar a
TTL em `expireAt` e tirar a limpeza do servidor.

## Eventos gravados antes da mudança

`scripts/telemetry-remove-personal-data.mjs` tira `uid` e `userEmail` dos
eventos antigos e dá a cada um o seu `expireAt` (os que já passaram dos 90 dias
recebem uma data vencida e saem na passada seguinte da limpeza).

```bash
node scripts/telemetry-remove-personal-data.mjs          # simulação
node scripts/telemetry-remove-personal-data.mjs --apply
```

Enquanto ele não roda, o painel já não mostra e-mail: a leitura descarta esses
campos.
