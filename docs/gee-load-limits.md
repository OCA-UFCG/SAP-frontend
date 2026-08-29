# Teto de carga do Earth Engine (SED-094)

Registro da medição feita para responder "uma quantidade grande de requisições
pode quebrar o GEE?". A resposta curta é **não pelo lado do Earth Engine** — o
limite que existe hoje é nosso, e ele aparece muito antes de qualquer cota do
Google.

## A conta da conta

O token de produção, beta e gamma é o mesmo (um único `secrets.GEE_PRIVATE_KEY`
nos três workflows de deploy). Ele pertence ao projeto **`ee-ocaufcg`**, e a API
do Earth Engine responde `registrationState: REGISTERED_NOT_COMMERCIALLY` —
plano não-comercial.

Isso importa por dois motivos:

- Desde 27/04/2026 todo projeto não-comercial tem uma **cota mensal de EECU**
  (unidades de computação), que zera no dia 1º de cada mês. Estourar a cota não
  derruba o serviço: ele passa a operar em _restricted mode_, com desempenho e
  vazão reduzidos. É degradação, não queda.
- Beta e produção compartilham a mesma service account, o mesmo espaço do
  Contentful e o mesmo projeto Firebase. **Teste de carga no beta consome a cota
  da produção.**

As APIs Cloud Monitoring, Service Usage e Cloud Quotas estão desabilitadas nesse
projeto, então hoje não temos como ler o consumo de EECU já gasto no mês. Isso é
uma lacuna de observabilidade, não uma limitação do Earth Engine.

## Os limites documentados do Earth Engine

| Limite                                         | Valor padrão |
| ---------------------------------------------- | ------------ |
| Requisições simultâneas (endpoint padrão)      | 40           |
| Requisições simultâneas (endpoint high-volume) | 40           |
| Taxa de requisições por projeto                | 100 req/s    |
| Taxa de requisições por conta                  | 100 req/s    |
| Tamanho do resultado de agregação              | 100 MiB      |
| Tamanho do payload de requisição               | 10 MB        |

Exceder concorrência ou taxa devolve `HTTP 429`.

## O que a medição mostrou

Rampa de concorrência com o SDK do Earth Engine dentro de um processo Node, com
a service account real, contra a FeatureCollection do MonitorANA — a mesma
consulta filtrada por município que `/api/municipal-analysis` faz. 173
requisições no total.

| Simultâneas | Tempo total |      Vazão |      p50 |       p95 | Erros |
| ----------: | ----------: | ---------: | -------: | --------: | ----: |
|           1 |    1 895 ms | 0,53 req/s | 1 895 ms |  1 895 ms |     0 |
|           4 |    2 162 ms | 1,85 req/s | 2 051 ms |  2 155 ms |     0 |
|           8 |    4 007 ms | 2,00 req/s | 2 720 ms |  3 999 ms |     0 |
|          16 |    7 380 ms | 2,17 req/s | 4 205 ms |  7 372 ms |     0 |
|          24 |    9 890 ms | 2,43 req/s | 5 770 ms |  9 782 ms |     0 |
|          32 |   12 705 ms | 2,52 req/s | 6 904 ms | 12 169 ms |     0 |
|          40 |   15 571 ms | 2,57 req/s | 8 131 ms | 12 689 ms |     0 |
|          48 |   18 386 ms | 2,61 req/s | 9 759 ms | 17 168 ms |     0 |

**Zero erros e zero 429 em toda a rampa.** Nem no nível 48, que está acima do
limite documentado de 40 requisições simultâneas — porque as 48 nunca chegaram
simultâneas ao Google.

Cada requisição a mais custou exatamente 350 ms de tempo total
(`(18 386 − 1 895) / 47 = 350,9`). Esse número não é coincidência: é o
`REQUEST_THROTTLE_INTERVAL_MS_ = 350` do próprio SDK
(`@google/earthengine`), que mantém **uma fila global por processo Node** e
despacha uma requisição a cada 350 ms.

## A conclusão que importa

O teto real de um processo do SAP é **~2,6 requisições ao Earth Engine por
segundo**, imposto pelo SDK dentro do nosso container — cerca de 38× abaixo dos
100 req/s que o Earth Engine aceita.

Não conseguimos quebrar o Earth Engine por volume: ele nem chega a ver a carga.
O que quebra primeiro é a experiência dentro do SAP, porque a fila é **única e
compartilhada por todos os usuários daquele processo**. Enquanto 45 consultas de
um painel esperam vaga, o mapa de todo mundo espera atrás delas.

Dois agravantes conhecidos, ambos no código:

- **Não existe timeout nas chamadas ao GEE.** O SDK usa `deadlineMs_ = 0`
  ("sem limite") e nunca chamamos `ee.data.setDeadline`. Um `429` também não vira
  erro: o SDK reenfileira até 10 vezes, com backoff de até 120 s — cerca de
  606 s presos antes de desistir.
- **`/api/municipal-analysis` não tem rate limit.** O limite de 30 req/min por
  usuário existe só em `/api/ee`, que é o caminho dos tiles. Abrir o painel de
  uma camada v2 dispara uma requisição por período (45 no
  `indice-de-aridez-era5-land`), sem limite de concorrência no cliente e sem
  teto no servidor.

Ou seja: o risco não é "estourar a cota do Google". É a fila de 350 ms encher e a
plataforma ficar lenta sem que nada a interrompa.

## Como reproduzir

```bash
export GEE_PRIVATE_KEY='{"client_email":"...","private_key":"...","project_id":"..."}'
npm run gee:load-test                                    # rampa padrão, 173 requisições
npm run gee:load-test -- --levels 1,8,32 --json          # níveis próprios, saída JSON
npm run gee:load-test -- --asset projects/.../OutraTabela
```

O teste é somente leitura: filtra uma FeatureCollection por código de município,
sem escrever, exportar ou criar task no Earth Engine. Ainda assim ele consome
EECU do plano não-comercial — a rampa padrão é pequena de propósito.

Ele mede o SDK dentro de um processo Node, não a aplicação inteira. Medir pela
rota HTTP misturaria a fila do SDK, os caches em memória e o timeout do proxy
reverso numa leitura só; para isolar o teto do Earth Engine, é o SDK que
interessa.
