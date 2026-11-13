# Rodada prev-v3

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T14:13.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 2 (2)                          |
| Notas do juiz                           | 1 certo · 1 parcial · 0 errado |
| Com número esperado faltando            | 0                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 11,3 · 12,3 · 12,3 s           |
| Rodadas do modelo por turno             | 4,0                            |
| Ferramentas por turno                   | 3,0                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 96,6 mil                       |
| Tokens de saída por turno               | 2087                           |
| Custo somado (preço de API)             | US$ 0.01                       |

| Id  | Categoria              | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ---------------------- | ------- | --------- | ------- | ----------- |
| B02 | previsão e priorização | parcial | 12,3      | 4       | 3           |
| B03 | previsão               | certo   | 10,4      | 4       | 3           |

## B02 — previsão e priorização — parcial

**Juiz:** Os 27 municípios, Moraújo e Senador Sá (100% da área abaixo, pela anomalia do CPTEC) e o aviso sobre a fonte da prioridade batem com as ferramentas. Mas o assistente consultou só a anomalia trimestral e não olhou a probabilidade trimestral do CPTEC. Por ela, Banabuiú tem 57,9% da área com chance de ficar abaixo do normal. Ele afirma que "nos outros 25 a previsão é igual ou acima do normal", o que deixa Banabuiú de fora e dá uma resposta fechada demais.

**Esperado:** Priorização padrão do Ceará: 27 de prioridade muito alta. Só o CPTEC tem o trimestre dezembro–fevereiro (período 2026-12 dos índices trimestrais). Quase nenhum tem previsão abaixo do normal: pela probabilidade, só Banabuiú (57,9% da área abaixo); pela anomalia, Moraújo e Senador Sá (100% levemente abaixo). Os outros puxam para levemente acima (o estado: 66% da área com chance de 0% a 40% acima do normal). Diz que é previsão e que a prioridade vem da planilha da Priorização.

**Pergunta:** Dos municípios de prioridade muito alta no Ceará, quantos têm previsão de chuva abaixo do normal para o trimestre de dezembro a fevereiro?

12,3 s · 4 rodadas · 97,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT p.nome, p.uf, ROUND(SUM(CASE WHEN v.classe <= 3 THEN v.valor ELSE 0 END), 1) AS pct_abaixo, ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END), 1) AS pct_acima_ou_normal FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'previsao-anomalia-precipitacao-trimestral-cptec' AND v.periodo = '2026-12' WHERE p.nivel = 'Muito alta' GROUP BY p.codigo, p.`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-cptec"],"territorio":"ce"}`

> Dos 27 municípios de prioridade muito alta no Ceará, **2 têm previsão de chuva abaixo do normal** para o trimestre de dezembro de 2026 a fevereiro de 2027: **Moraújo** e **Senador Sá**. Nos outros 25, a previsão é de chuva igual ou acima do normal.
>
> - **Fonte da previsão:** CPTEC/INPE, anomalia de precipitação trimestral, dado atualizado em 14/10/2026. O INMET não tem previsão para esse trimestre no SEDES, então não entrou.
> - **Prioridade:** Priorização do SEDES, pesos iguais (aridez, Índice de Seca, área degradada e pobreza rural), comparando os municípios só dentro do Ceará, cenário pessimista. Os dados dos critérios vêm da planilha da Priorização, não do tabelão.
> - **Como contei:** Em Moraújo e Senador Sá, 100% da área está nas faixas abaixo do normal. Nos demais, 100% da área está em "levemente acima" ou acima do normal. Previsão é estimativa, não certeza.

## B03 — previsão — certo

**Juiz:** ok. Os números batem com as ferramentas: 10 a 100 mm nas duas fontes, CPTEC levemente acima, INMET levemente abaixo, e probabilidade de 92,5% e 7,5% no INMET. A resposta diz que é previsão para dezembro de 2026 e informa fontes e datas. As faixas de probabilidade do INMET aparecem escritas de trás para frente ("40% a 0%"), mas isso não muda o sentido.

**Esperado:** Não dá para dizer se vai chover num dia; o SEDES tem previsões mensais. Para dezembro de 2026, CPTEC e INMET preveem de 10 a 100 mm no mês em toda a área de Petrolina–PE. Quanto ao normal, os dois ficam perto dele e discordam no lado: o CPTEC prevê levemente acima (0 a 30 mm) e o INMET levemente abaixo (-30 a 0 mm). A probabilidade é opcional aqui (CPTEC: chance de 0% a 40% acima do normal; INMET: 92,5% da área com chance de 0% a 40% abaixo). Diz que é previsão.

**Pergunta:** Vai chover em Petrolina em dezembro?

10,4 s · 4 rodadas · 95,4 mil tokens de entrada

1. buscar_territorio: `{"nome":"Petrolina","uf":"PE"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, c.rotulo AS classe_rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.territorio='2611101' AND v.periodo='2026-12' AND v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acu`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet","previsao-precipitacao-mensal-acumulado-cptec-2","previsao-precipitacao-mensal-acumulado-inmet"],"territorio":"2611101"}`

> **Depende da fonte: as duas preveem chuva entre 10 e 100 mm em dezembro de 2026 em Petrolina–PE, mas discordam sobre ficar acima ou abaixo do normal.**
>
> - **Acumulado (quanto chove):** CPTEC e INMET dão a mesma faixa, de 10 a 100 mm/mês, para 100% da área do município.
> - **Anomalia (acima ou abaixo do normal):** o CPTEC prevê levemente acima (0 a 30 mm a mais que o normal). O INMET prevê levemente abaixo (-30 a 0 mm).
> - **Probabilidade:** o CPTEC dá de 0% a 40% de chance de ficar acima do normal. O INMET coloca 92,5% da área na faixa de 40% a 0% de chance de ficar abaixo do normal e 7,5% na faixa de 65% a 40%.
>
> São estimativas para dezembro de 2026, não certezas. Fontes: Previsão de Precipitação Mensal (CPTEC, atualizada em 15/10/2026, e INMET, em 16/10/2026) e Previsão de Anomalia de Precipitação Mensal (CPTEC, em 14/10/2026, e INMET, em 16/10/2026), no tabelão do SEDES gerado em 12/11/2026.
