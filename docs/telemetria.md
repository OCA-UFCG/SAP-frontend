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
`src/repositories/telemetry/telemetryRepository.ts`). Quem apaga é a **política
de TTL do Firestore**, que precisa estar ligada em cada coleção:

```bash
# as coleções existentes em outubro de 2026; confira em Firestore → Data
for c in telemetry-events-prod telemetry-events-beta telemetry-events-local; do
  gcloud firestore fields ttls update expireAt \
    --collection-group="$c" --enable-ttl --project=<id-do-projeto> --async
done
```

Ou pelo painel: Firestore → TTL → Create policy → coleção + campo `expireAt`.

Sem a política, o campo existe e nada é apagado. A TTL costuma apagar em até
24 h depois da data, e não é instantânea.

## Eventos gravados antes da mudança

`scripts/telemetry-remove-personal-data.mjs` tira `uid` e `userEmail` dos
eventos antigos e dá a cada um o seu `expireAt` (os que já passaram dos 90 dias
recebem uma data vencida e a TTL os apaga na passada seguinte).

```bash
node scripts/telemetry-remove-personal-data.mjs          # simulação
node scripts/telemetry-remove-personal-data.mjs --apply
```

Enquanto ele não roda, o painel já não mostra e-mail: a leitura descarta esses
campos.
