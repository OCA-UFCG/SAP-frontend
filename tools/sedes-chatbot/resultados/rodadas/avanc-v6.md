# Rodada avanc-v6

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T14:41.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 2 (2)                          |
| Notas do juiz                           | 0 certo · 2 parcial · 0 errado |
| Com número esperado faltando            | 0                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 8,6 · 11,2 · 11,2 s            |
| Rodadas do modelo por turno             | 2,5                            |
| Ferramentas por turno                   | 1,5                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 66 mil                         |
| Tokens de saída por turno               | 1556                           |
| Custo somado (preço de API)             | US$ 0.01                       |

| Id  | Categoria           | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ------------------- | ------- | --------- | ------- | ----------- |
| K03 | sentido das classes | parcial | 6,1       | 1       | 0           |
| U04 | outra língua        | parcial | 11,2      | 4       | 3           |

## K03 — sentido das classes — parcial

**Juiz:** A explicação central está certa: 40% a 65% é a chance de ficar acima do normal, não mm nem certeza. Mas assume que é chuva (pode ser temperatura) e não diz que é previsão, não medição. Também pergunta qual Patos e o período, o que era desnecessário, já que a pergunta era só de interpretação.

**Esperado:** É uma previsão de probabilidade: a chance estimada de a chuva (ou temperatura) ficar acima do normal está entre 40% e 65%. É previsão, não medição. Não precisa consultar valores.

**Pergunta:** A previsão para Patos diz "40% a 65% (acima da Normal)". O que isso significa?

6,1 s · 1 rodadas · 32,2 mil tokens de entrada

> Essa classe indica uma **chance de chuva acima do normal** para o período previsto. A faixa de 40% a 65% é a probabilidade de a chuva ficar acima da média histórica da época. Não é a quantidade de chuva em mm, nem uma certeza.
>
> No SEDES, o valor de cada território nesses índices de previsão é a **porcentagem da área** que cai em cada classe. Assim, se Patos tiver um valor nessa classe, ele mostra a parte do município em que a chance de chuva acima do normal está entre 40% e 65%.
>
> Há mais de um Patos (Patos–PB, Patos de Minas–MG e Patos do Piauí–PI, por exemplo). Qual deles você quer consultar? Também me diga o mês ou trimestre da previsão, se quiser ver o valor.

## U04 — outra língua — parcial

**Juiz:** Os números batem com as ferramentas: CPTEC com 84,2% levemente acima, INMET com 100% levemente abaixo e 40–65% de chance de ficar abaixo do normal. A pergunta veio em espanhol e a resposta saiu em português, o que descumpre a regra de responder na língua da pergunta. Também falta a faixa de 10 a 100 mm/mês do acumulado previsto, que a resposta esperada traz.

**Esperado:** En español. Depende de la fuente: el CPTEC prevé lluvia levemente por encima de lo normal en el 84,2% del área (0 a 30 mm), el INMET levemente por debajo en el 100% (y 40% a 65% de probabilidad de quedar por debajo de lo normal). Las dos prevén de 10 a 100 mm en el mes. Dice que es una previsión.

**Pergunta:** ¿Va a llover más de lo normal en Fortaleza en diciembre?

11,2 s · 4 rodadas · 99,8 mil tokens de entrada

1. buscar_territorio: `{"nome":"Fortaleza","uf":"CE"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, c.rotulo AS rotulo_classe, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.territorio='2304400' AND v.periodo='2026-12' AND v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-precipitacao-mensal-probabilidade-cptec','previsao-precipitacao-mensal-p`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet","previsao-precipitacao-mensal-probabilidade-cptec","previsao-precipitacao-mensal-probabilidade-inmet"],"territorio":"2304400"}`

> **Depende da fonte.** Para dezembro de 2026, o CPTEC/INPE prevê chuva levemente acima do normal em Fortaleza, enquanto o INMET prevê levemente abaixo.
>
> - **CPTEC/INPE (anomalia de precipitação mensal):** 84,2% da área do município fica em "levemente acima do normal" (0 a 30 mm/mês) e 15,8% em "levemente abaixo" (-30 a 0 mm/mês).
> - **INMET (anomalia de precipitação mensal):** 100% da área fica em "levemente abaixo do normal" (-30 a 0 mm/mês).
> - **Probabilidade (CPTEC):** 84,2% da área tem chance de 0% a 40% de ficar acima do normal, e 15,8% tem chance de 0% a 40% de ficar abaixo.
> - **Probabilidade (INMET):** 100% da área tem chance de 40% a 65% de ficar abaixo do normal.
>
> Os dois modelos discordam, e nenhum dos dois aponta uma chuva forte acima ou abaixo do normal. Previsão é uma estimativa, não uma certeza.
>
> Fonte: SEDES, previsões para dezembro de 2026 em Fortaleza–CE. Os dados do CPTEC foram atualizados em 14 e 15/10/2026 e os do INMET em 16/10/2026, conforme o catálogo do SEDES.
