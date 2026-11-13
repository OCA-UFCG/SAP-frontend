# Rodada prev-v2

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T14:11.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 3 (3)                          |
| Notas do juiz                           | 1 certo · 1 parcial · 1 errado |
| Com número esperado faltando            | 0                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 10,3 · 10,2 · 11,2 s           |
| Rodadas do modelo por turno             | 3,7                            |
| Ferramentas por turno                   | 2,7                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 85,4 mil                       |
| Tokens de saída por turno               | 1759                           |
| Custo somado (preço de API)             | US$ 0.02                       |

| Id  | Categoria              | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ---------------------- | ------- | --------- | ------- | ----------- |
| B02 | previsão e priorização | parcial | 10,2      | 4       | 3           |
| B03 | previsão               | errado  | 11,2      | 4       | 3           |
| B07 | previsão               | certo   | 9,4       | 3       | 2           |

## B03 — previsão — errado

**Juiz:** O volume está errado: a resposta diz "100 a 200 mm/mês" para o acumulado, mas a classe 2 é "10 a 100 mm/mês" (100 a 200 seria a classe 3). Esse número erra a pergunta central e aparece duas vezes. Além disso, os 7,5% do INMET (classe 2) são de chance de 40% a 65% de ficar abaixo do normal, e a resposta não diz "abaixo", o que sugere acima.

**Esperado:** Não dá para dizer se vai chover num dia; o SEDES tem previsões mensais. Para dezembro de 2026, CPTEC e INMET preveem de 10 a 100 mm no mês em toda a área de Petrolina–PE. Quanto ao normal, os dois ficam perto dele e discordam no lado: o CPTEC prevê levemente acima (0 a 30 mm) e o INMET levemente abaixo (-30 a 0 mm). A probabilidade é opcional aqui (CPTEC: chance de 0% a 40% acima do normal; INMET: 92,5% da área com chance de 0% a 40% abaixo). Diz que é previsão.

**Pergunta:** Vai chover em Petrolina em dezembro?

11,2 s · 4 rodadas · 95 mil tokens de entrada

1. buscar_territorio: `{"nome":"Petrolina","uf":"PE"}`
1. consultar_sql: `{"sql":"SELECT i.id, v.periodo, v.classe, v.valor FROM valores v JOIN indices i ON i.id=v.indice WHERE v.territorio='2611101' AND v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acumulado-inmet','previsao-precipitacao-mensal-probabilidade-cptec','previsao-precipitac`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"2611101"}`

> **Depende da fonte: as previsões para dezembro de 2026 em Petrolina–PE divergem sobre se a chuva fica acima ou abaixo do normal.** Em todas, o volume esperado é de 100 a 200 mm no mês. Previsão é estimativa, não certeza.
>
> - **Anomalia (CPTEC/INPE, atualizado em 14/10/2026):** levemente acima do normal (0 a 30 mm a mais), em 100% da área do município.
> - **Anomalia (INMET, atualizado em 16/10/2026):** levemente abaixo do normal (-30 a 0 mm), em 100% da área.
> - **Probabilidade (CPTEC):** chance de 0% a 40% de ficar acima do normal.
> - **Probabilidade (INMET):** 92,5% da área na faixa de chance de 40% a 0% de ficar abaixo do normal, e 7,5% na faixa de 40% a 65%.
> - **Acumulado (CPTEC e INMET):** 100 a 200 mm/mês, em 100% da área.
>
> Os dois modelos concordam no volume, mas não no lado do normal. Para ver o mapa e o relatório, use o botão "Ver no SEDES".

## B02 — previsão e priorização — parcial

**Juiz:** Pela anomalia do CPTEC (2026-12), os números batem: Moraújo e Senador Sá, 2 de 27, com 100% da área abaixo do normal. Mas o assistente consultou só a anomalia e não a probabilidade trimestral do CPTEC. Por isso omitiu Banabuiú (57,9% da área abaixo do normal pela probabilidade) e a ressalva de que o resultado depende do índice. Também não deu o panorama do estado (66% da área com 0% a 40% de chance acima do normal).

**Esperado:** Priorização padrão do Ceará: 27 de prioridade muito alta. Só o CPTEC tem o trimestre dezembro–fevereiro (período 2026-12 dos índices trimestrais). Quase nenhum tem previsão abaixo do normal: pela probabilidade, só Banabuiú (57,9% da área abaixo); pela anomalia, Moraújo e Senador Sá (100% levemente abaixo). Os outros puxam para levemente acima (o estado: 66% da área com chance de 0% a 40% acima do normal). Diz que é previsão e que a prioridade vem da planilha da Priorização.

**Pergunta:** Dos municípios de prioridade muito alta no Ceará, quantos têm previsão de chuva abaixo do normal para o trimestre de dezembro a fevereiro?

10,2 s · 4 rodadas · 97,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"}}`
1. consultar_sql: `{"sql":"SELECT p.nome AS municipio, SUM(CASE WHEN v.classe IN (1,2,3) THEN v.valor ELSE 0 END) AS pct_abaixo, SUM(v.valor) AS total FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'previsao-anomalia-precipitacao-trimestral-cptec' AND v.periodo = '2026-12' WHERE p.nivel = 'Muito alta' GROUP BY p.codigo, p.nome ORDER BY p.nome;","priorizacao":"pn64z"}`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-cptec"],"territorio":"ce"}`

> **2 dos 27 municípios** de prioridade muito alta no Ceará têm previsão de chuva abaixo do normal para dezembro de 2026 a fevereiro de 2027: **Moraújo** e **Senador Sá**. Nesses dois, 100% da área está nas faixas abaixo do normal. Os outros 25 têm toda a área em faixas de chuva acima ou levemente acima do normal.
>
> - **Previsão:** anomalia de precipitação trimestral, CPTEC/INPE, trimestre dez/2026 a fev/2027. Atualizada no SEDES em 14/10/2026. É uma estimativa, não uma certeza.
> - **Prioridade:** Priorização do SEDES, Ceará, com os critérios padrão do site e pesos iguais (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural). Cada estado é comparado separadamente, no cenário pessimista. Os níveis são relativos aos municípios do Ceará com esses critérios. A planilha da Priorização não é a mesma do tabelão, então os níveis vêm de outra fonte.
> - O INMET não tem previsão trimestral para dez/2026, só para nov/2026, então não há comparação com ele neste trimestre.

## B07 — previsão — certo

**Juiz:** ok. Números batem com as ferramentas (59,4%, 40,2%, 58,2%, 36,7%) e o período está correto (nov/2026 a jan/2027, atualizado em 16/10/2026). Aponta chuva abaixo do normal e avisa que é previsão. A diferença 36,7% contra 36,6% da resposta esperada é arredondamento do valor 36,65.

**Esperado:** O INMET tem um trimestre: novembro de 2026 a janeiro de 2027 (período 2026-11). Prevê chuva abaixo do normal em quase todo o Semiárido: anomalia de -300 a -100 mm em 59,4% da área e de -100 a 0 mm em 40,2%; na probabilidade, 58,2% da área tem mais de 65% de chance de ficar abaixo do normal e 36,6% de 40% a 65%. Diz que é previsão e nomeia os três meses.

**Pergunta:** O que diz a previsão trimestral de chuva do INMET para o Semiárido?

9,4 s · 3 rodadas · 64,1 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT indice, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice IN ('previsao-anomalia-precipitacao-trimestral-inmet','previsao-precipitacao-trimestral-acumulado-inmet','previsao-precipitacao-trimestral-probabilidade-inmet') AND periodo='2026-11' AND territorio='5_semiarido-semiarido-total' ORDER BY indice, classe;"}`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-inmet","previsao-precipitacao-trimestral-acumulado-inmet","previsao-precipitacao-trimestral-probabilidade-inmet"],"territorio":"5_semiarido-semiarido-total"}`

> **Em resumo: a previsão do INMET aponta chuva abaixo do normal no Semiárido para o trimestre de novembro de 2026 a janeiro de 2027.** Quase toda a área (99,6%) está nas faixas abaixo do normal.
>
> Os três índices de previsão trimestral de chuva do INMET para o Semiárido, no trimestre nov/2026 a jan/2027 (previsões, atualizadas no SEDES em 16/10/2026):
>
> - **Anomalia (quanto fica acima ou abaixo do normal):** 59,4% da área ficaria "abaixo do normal" (-300 a -100 mm no trimestre) e 40,2% "levemente abaixo" (-100 a 0 mm). Só 0,4% ficaria "levemente acima" e nenhuma área ficaria acima de 100 mm.
> - **Acumulado (quanta chuva se espera):** 34,4% da área com menos de 100 mm, 28,8% entre 100 e 200 mm, 21,4% entre 200 e 400 mm e 15,4% entre 400 e 900 mm.
> - **Probabilidade (chance de ficar abaixo ou acima do normal):** em 58,2% da área a chance de ficar abaixo do normal é de mais de 65%, e em 36,7% fica entre 40% e 65%. Só 0,4% da área tem alguma chance de ficar acima do normal.
>
> Previsão é estimativa, não certeza. Os números são de % da área do Semiárido, que é a área própria desse recorte no SEDES.
