# Rodada prev-v1

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T14:11.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 8 (8)                          |
| Notas do juiz                           | 5 certo · 3 parcial · 0 errado |
| Com número esperado faltando            | 2                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 11,9 · 11,0 · 21,7 s           |
| Rodadas do modelo por turno             | 4,3                            |
| Ferramentas por turno                   | 3,3                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 102,6 mil                      |
| Tokens de saída por turno               | 2327                           |
| Custo somado (preço de API)             | US$ 0.03                       |

| Id  | Categoria                | Nota         | Tempo (s) | Rodadas | Ferramentas |
| --- | ------------------------ | ------------ | --------- | ------- | ----------- |
| B01 | previsão e monitoramento | certo        | 21,7      | 6       | 5           |
| B02 | previsão e priorização   | parcial      | 11,0      | 5       | 4           |
| B03 | previsão                 | parcial      | 8,8       | 5       | 4           |
| B04 | previsão                 | certo        | 10,4      | 4       | 3           |
| B05 | previsão                 | certo        | 8,7       | 4       | 3           |
| B06 | previsão e monitoramento | certo        | 13,5      | 3       | 2           |
| B07 | previsão                 | parcial (nº) | 9,6       | 3       | 2           |
| B08 | previsão e monitoramento | certo (nº)   | 11,3      | 4       | 3           |

## B02 — previsão e priorização — parcial

**Juiz:** Os números da anomalia batem: Moraújo e Senador Sá, 100% levemente abaixo, e 27 municípios. Mas o assistente usou só a anomalia (classes 1 a 3) e disse que são "2". A resposta esperada também considera a probabilidade, em que Banabuiú tem 57,9% da área abaixo do normal, e o assistente omitiu isso. Dizer "2" e que os outros 25 estão "levemente acima" ignora o Banabuiú e deixa a resposta incompleta.

**Esperado:** Priorização padrão do Ceará: 27 de prioridade muito alta. Só o CPTEC tem o trimestre dezembro–fevereiro (período 2026-12 dos índices trimestrais). Quase nenhum tem previsão abaixo do normal: pela probabilidade, só Banabuiú (57,9% da área abaixo); pela anomalia, Moraújo e Senador Sá (100% levemente abaixo). Os outros puxam para levemente acima (o estado: 66% da área com chance de 0% a 40% acima do normal). Diz que é previsão e que a prioridade vem da planilha da Priorização.

**Pergunta:** Dos municípios de prioridade muito alta no Ceará, quantos têm previsão de chuva abaixo do normal para o trimestre de dezembro a fevereiro?

11,0 s · 5 rodadas · 132,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT p.nome, p.uf, SUM(CASE WHEN v.classe IN (1,2,3) THEN v.valor ELSE 0 END) AS abaixo, SUM(CASE WHEN v.classe IN (1,2,3) THEN v.valor ELSE 0 END) AS valor_abaixo FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'previsao-anomalia-precipitacao-trimestral-cptec' AND v.periodo = '2026-12' WHERE p.nivel = 'Muito alta' AND p.uf = 'CE' GROUP BY p.codigo ORDER `
1. consultar_sql: `{"sql":"SELECT p.nome, v.classe, v.valor FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'previsao-anomalia-precipitacao-trimestral-cptec' AND v.periodo = '2026-12' WHERE p.nivel = 'Muito alta' AND p.uf = 'CE' ORDER BY p.nome, v.classe","priorizacao":"pmrvn"}`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-cptec"],"territorio":"ce"}`

> Dos 27 municípios de prioridade muito alta no Ceará, **2 têm previsão de chuva abaixo do normal** para dezembro de 2026 a fevereiro de 2027: **Moraújo** e **Senador Sá**. Nos dois, 100% da área fica na faixa "levemente abaixo do normal" (de -100 a 0 mm no trimestre). Os outros 25 têm 100% da área em "levemente acima do normal" (0 a 100 mm).
>
> - **Previsão:** CPTEC/INPE, trimestral, período 2026-12 (atualizada em 14/10/2026). O INMET não tem previsão trimestral para esse período, então não entrou na conta.
> - **Prioridade:** Priorização do SEDES, Ceará, com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), cenário pessimista e cada estado comparado separadamente. Muda se os critérios, pesos ou a comparação mudarem.
>
> Previsão é estimativa, não certeza.
>
> https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=ce&period=2026&layers=previsao-anomalia-precipitacao-trimestral-cptec

## B03 — previsão — parcial

**Juiz:** Os números e as fontes batem com as ferramentas: CPTEC levemente acima, INMET levemente abaixo, 10 a 100 mm nas duas. Mas a resposta abre com "Depende da fonte" e não diz que o SEDES não prevê chuva por dia, só por mês. Também não traz a probabilidade (0 a 40% acima no CPTEC, 92,5% da área com 0 a 40% abaixo no INMET) e não menciona o índice de probabilidade, que nem foi consultado com sucesso. Há ainda uma interpretação duvidosa: "dezembro deve ter pouca chuva" é uma inferência do assistente, não um dado.

**Esperado:** Não dá para dizer se vai chover num dia; o SEDES tem previsões mensais. Para dezembro de 2026, CPTEC e INMET preveem de 10 a 100 mm no mês em toda a área de Petrolina–PE. Quanto ao normal, os dois ficam perto dele e discordam no lado: o CPTEC prevê levemente acima (0 a 30 mm, chance de 0% a 40% acima do normal) e o INMET levemente abaixo (-30 a 0 mm; 92,5% da área com chance de 0% a 40% abaixo do normal). Diz que é previsão.

**Pergunta:** Vai chover em Petrolina em dezembro?

8,8 s · 5 rodadas · 127,4 mil tokens de entrada

1. buscar_territorio: `{"nome":"Petrolina","uf":"PE"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, c.rotulo AS classe_rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.territorio='2611101' AND v.periodo='2026-12' AND v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acu`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet","previsao-precipitacao-mensal-acumulado-cptec-2","previsao-precipitacao-mensal-acumulado-inmet"],"territorio":"2611101"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.classe, c.rotulo AS classe_rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.territorio='2611101' AND v.periodo='2026-12' AND v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acumulado-inme`

> **Depende da fonte, mas as duas indicam chuva perto do normal para dezembro de 2026 em Petrolina–PE.** Previsão é estimativa, não certeza.
>
> - **CPTEC/INPE** (atualizado em 14/10/2026): chuva levemente acima do normal, entre 0 e 30 mm a mais, em 100% da área. O acumulado previsto fica entre 10 e 100 mm no mês.
> - **INMET** (atualizado em 16/10/2026): chuva levemente abaixo do normal, entre 0 e 30 mm a menos, em 100% da área. O acumulado previsto também fica entre 10 e 100 mm no mês.
>
> As fontes discordam só no sinal do desvio, e as duas são desvios pequenos. Pelos dois modelos, dezembro deve ter pouca chuva, na faixa de 10 a 100 mm.
>
> Os dados são de previsões mensais para dezembro de 2026.

## B07 — previsão — parcial

**Juiz:** Os números de anomalia (59,4%, 40,2%, 0,4%) e o período (nov/2026 a jan/2027) estão corretos e a resposta avisa que é previsão. Falta a probabilidade de chuva abaixo do normal (58,2% com mais de 65% de chance e 36,6% de 40% a 65%), que a resposta esperada inclui e a resposta não consultou. O assistente também respondeu com o acumulado, que os números esperados não citam, mas isso não está errado.

**Números faltando:** 58,2

**Esperado:** O INMET tem um trimestre: novembro de 2026 a janeiro de 2027 (período 2026-11). Prevê chuva abaixo do normal em quase todo o Semiárido: anomalia de -300 a -100 mm em 59,4% da área e de -100 a 0 mm em 40,2%; na probabilidade, 58,2% da área tem mais de 65% de chance de ficar abaixo do normal e 36,6% de 40% a 65%. Diz que é previsão e nomeia os três meses.

**Pergunta:** O que diz a previsão trimestral de chuva do INMET para o Semiárido?

9,6 s · 3 rodadas · 63,8 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, vc.rotulo_classe, v.valor FROM valores_com_nomes v JOIN valores_com_nomes vc ON 1=0 WHERE 1=0 UNION ALL SELECT v.indice, v.periodo, v.classe, v.rotulo_classe, v.valor FROM valores_com_nomes v WHERE v.territorio='5_semiarido-semiarido-total' AND v.indice IN ('previsao-anomalia-precipitacao-trimestral-inmet','previsao-precipitacao-trimestral-acumulado-in`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-inmet","previsao-precipitacao-trimestral-acumulado-inmet"],"territorio":"5_semiarido-semiarido-total"}`

> Para o trimestre de **novembro de 2026 a janeiro de 2027**, a previsão de chuva do INMET indica **chuva abaixo do normal** em quase todo o Semiárido. Isso é uma estimativa, não certeza.
>
> - **Anomalia (Previsão: Anomalia Precipitação Trimestral, INMET):** 99,6% da área fica abaixo do normal. Desse total, 59,4% está na faixa "abaixo do normal" (-300 a -100 mm no trimestre) e 40,2% na faixa "levemente abaixo" (-100 a 0 mm). Só 0,4% fica levemente acima do normal.
> - **Chuva acumulada prevista (Previsão: Precipitação Trimestral Acumulado, INMET):** 34,4% da área deve ter menos de 100 mm no trimestre, 28,8% entre 100 e 200 mm, 21,4% entre 200 e 400 mm e 15,4% entre 400 e 900 mm. O site rotula essas faixas como "mm/mês", embora o índice seja trimestral.
>
> Os dados são do tabelão do SEDES, gerado em 12/11/2026, e a previsão foi atualizada no site em 16/10/2026. O período é o trimestre que começa em novembro de 2026.
>
> Se quiser, posso comparar com a previsão do CPTEC para o mesmo trimestre.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=5_semiarido-semiarido-total&period=2026&layers=previsao-anomalia-precipitacao-trimestral-inmet%2Cprevisao-precipitacao-trimestral-acumulado-inmet)

## B01 — previsão e monitoramento — certo

**Juiz:** Ok: 80 municípios, INMET 79 de 80 e CPTEC 0 batem com a resposta esperada e com as ferramentas. Diz que as fontes discordam, que é previsão e que a faixa inclui "levemente abaixo". Falta só a versão por probabilidade (77 e 9). "Em um deles a área toda cai nessa faixa" não tem base: a consulta só mostra que o máximo é 100%, não quantos municípios chegam a isso. São detalhes menores.

**Esperado:** 80 municípios da Paraíba têm alguma área em seca grave ou pior no Monitor de Secas de setembro de 2026. Para dezembro de 2026 as previsões discordam: no INMET, quase todos têm previsão abaixo do normal (anomalia: 79 dos 80; probabilidade: 77), no CPTEC quase nenhum (anomalia: 0; probabilidade: 9), que puxa para levemente acima. Os desvios previstos são pequenos (classes "levemente", até 30 mm no mês). Diz que é previsão e que as fontes discordam; não responde só "sim" ou só "não".

**Pergunta:** Os municípios da Paraíba que estão em seca grave ou pior vão ter chuva abaixo do normal em dezembro?

21,7 s · 6 rodadas · 168,7 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH seca AS (\n  SELECT territorio, SUM(valor) AS grave FROM valores\n  WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio\n),\nprev AS (\n  SELECT territorio, SUM(valor) AS abaixo FROM valores\n  WHERE indice='previsao-anomalia-precipitacao-cptec-inpe' AND periodo='2026-12' AND classe<=3 GROUP BY territorio\n)\nSELECT COUNT(*) AS municipios_seca_gr`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-cptec-inpe"],"territorio":"pb"}`
1. consultar_sql: `{"sql":"SELECT v.periodo, v.classe, ROUND(SUM(v.valor),1) AS soma, COUNT(DISTINCT v.territorio) AS n_territorios\nFROM valores v JOIN territorios t ON t.codigo=v.territorio\nWHERE v.indice='previsao-anomalia-precipitacao-cptec-inpe' AND t.tipo='municipio' AND t.uf='PB'\nGROUP BY v.periodo, v.classe ORDER BY v.periodo, v.classe;"}`
1. consultar_sql: `{"sql":"WITH seca AS (\n  SELECT territorio, SUM(valor) AS grave FROM valores\n  WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio\n),\nprev AS (\n  SELECT territorio, SUM(valor) AS abaixo FROM valores\n  WHERE indice='previsao-anomalia-precipitacao-cptec-inpe' AND periodo='2026-12' AND classe<=3 GROUP BY territorio\n)\nSELECT COUNT(*) AS municipios, SUM(CA`
1. consultar_sql: `{"sql":"WITH seca AS (\n  SELECT territorio, SUM(valor) AS grave FROM valores\n  WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio\n),\nprev AS (\n  SELECT territorio, SUM(valor) AS abaixo FROM valores\n  WHERE indice='previsao-anomalia-precipitacao-mensal-inmet' AND periodo='2026-12' AND classe<=3 GROUP BY territorio\n)\nSELECT COUNT(*) AS municipios, SUM(`

> **Depende da fonte.** Para dezembro de 2026, o INMET prevê chuva abaixo do normal em quase todos os 80 municípios paraibanos em seca grave ou pior, mas o CPTEC/INPE não prevê chuva abaixo do normal em nenhum deles.
>
> - **INMET** (previsão de anomalia de precipitação mensal, atualizada em 16/10/2026): 79 dos 80 municípios têm mais da metade da área na faixa abaixo do normal (inclui "levemente abaixo"). Em um deles, a área toda cai nessa faixa.
> - **CPTEC/INPE** (previsão de anomalia de precipitação mensal, atualizada em 14/10/2026): nenhum dos 80 tem área na faixa abaixo do normal. Na média da Paraíba, quase todo o estado fica em "levemente acima do normal" (0 a 30 mm/mês).
>
> A seca é do Monitor de Secas da ANA, setembro de 2026 (dado atualizado no SEDES em 19/10/2026). Considerei seca grave, extrema ou excepcional. A previsão é uma estimativa, não uma certeza.

## B04 — previsão — certo

**Juiz:** Os números batem com as ferramentas: INMET mensal dez/2026 74% e 26%; CPTEC trimestral 92%/8%; INMET trimestral 54%/46%. Respondeu "sim", disse que é previsão e não usou a probabilidade de temperatura do INMET. Não citou a probabilidade mensal do CPTEC da resposta esperada, mas usou outras fontes válidas das ferramentas, o que é aceitável. A resposta aparece duplicada, mas isso é só formatação.

**Esperado:** Sim, nas duas fontes, mas com intensidade diferente. INMET (anomalia de temperatura mensal, dezembro de 2026): 74% da área do Nordeste de 1° a 3° acima do normal e 26% de 0° a 1° acima. CPTEC (probabilidade mensal, dezembro de 2026): 78,4% da área com mais de 40% de chance de ficar acima do normal (48,3% com 40% a 65%; 30,1% com mais de 65%). Não usa a probabilidade de temperatura do INMET sem avisar que ela repete os números da chuva. Diz que é previsão.

**Pergunta:** A previsão é de mais calor que o normal no Nordeste em dezembro?

10,4 s · 4 rodadas · 99,9 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT indice, periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice IN ('anomalia-de-temperatura-mensal-previsao-sazonal-inmet','previsao-anomalia-temperatura-trimestral-cptec','previsao-anomalia-temperatura-trimestral-inmet') AND territorio='2_regiao-nordeste' AND periodo IN ('2026-12','2026-11') ORDER BY indice, periodo, classe;"}`
1. link_no_sedes: `{"indices":["anomalia-de-temperatura-mensal-previsao-sazonal-inmet","previsao-anomalia-temperatura-trimestral-cptec"],"territorio":"2_regiao-nordeste"}`
1. link_no_sedes: `{"indices":["anomalia-de-temperatura-mensal-previsao-sazonal-inmet","previsao-anomalia-temperatura-trimestral-cptec","previsao-anomalia-temperatura-trimestral-inmet"],"territorio":"2_regiao-nordeste"}`

> Sim. As três previsões de temperatura do SEDES indicam calor acima do normal para o Nordeste em dezembro, mas sem previsão de calor muito acima do normal (mais de 3°).
>
> - **INMET, mensal, dezembro de 2026:** 74% da área do Nordeste fica "acima do normal" (1° a 3° acima da média) e 26% "levemente acima" (0° a 1°).
> - **CPTEC, trimestral, dezembro a fevereiro:** 100% da área fica acima do normal: 92% "levemente acima" (0° a 1°) e 8% "acima" (1° a 3°).
> - **INMET, trimestral, novembro a janeiro:** 54% da área fica "levemente acima" e 46% "acima do normal".
>
> Os valores são a porcentagem da área do Nordeste em cada faixa. Segundo o catálogo, as previsões foram atualizadas entre 14 e 16/10/2026. Previsão é estimativa e pode não se confirmar.
>
> Sim. As três previsões de temperatura do SEDES indicam calor acima do normal para o Nordeste em dezembro, mas nenhuma aponta calor muito acima do normal (mais de 3°).
>
> - **INMET, mensal, dezembro de 2026:** 74% da área do Nordeste fica "acima do normal" (1° a 3° acima da média) e 26% "levemente acima" (0° a 1°).
> - **CPTEC, trimestral, dezembro a fevereiro:** 100% da área fica acima do normal: 92% "levemente acima" (0° a 1°) e 8% "acima" (1° a 3°).
> - **INMET, trimestral, novembro a janeiro:** 54% da área fica "levemente acima" e 46% "acima do normal".
>
> Os valores são a porcentagem da área do Nordeste em cada faixa. Segundo o catálogo, as previsões foram atualizadas entre 14 e 16/10/2026. Previsão é estimativa e pode não se confirmar.

## B05 — previsão — certo

**Juiz:** ok. CPTEC: mais de 65% de chance de acima do normal, cobrindo todo o município (100%), com período e data de atualização. INMET: anomalia "levemente acima" (0° a 1°). A probabilidade de temperatura do INMET foi corretamente deixada de fora, com aviso sobre o problema no cadastro.

**Esperado:** CPTEC (probabilidade de temperatura mensal, dezembro de 2026): 100% da área de Mossoró–RN com mais de 65% de chance de ficar acima do normal. O INMET prevê de 0° a 1° acima do normal (anomalia). A probabilidade de temperatura do INMET não serve: no cadastro do site ela lê a tabela da chuva e repete os mesmos números (31,9% e 68,1% abaixo do normal); se citá-la, avisa isso.

**Pergunta:** Qual a chance de fazer mais calor que o normal em Mossoró em dezembro?

8,7 s · 4 rodadas · 95,7 mil tokens de entrada

1. buscar_territorio: `{"nome":"Mossoró"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, vn.rotulo_classe, v.valor FROM valores v JOIN valores_com_nomes vn ON vn.indice=v.indice AND vn.periodo=v.periodo AND vn.territorio=v.territorio AND vn.classe=v.classe WHERE v.territorio='2408003' AND v.periodo='2026-12' AND v.indice IN ('anomalia-de-temperatura-mensal-previsao-sazonal-inmet','previsao-temperatura-mensal-probabilidade-cptec','previsao-`
1. link_no_sedes: `{"indices":["previsao-temperatura-mensal-probabilidade-cptec","anomalia-de-temperatura-mensal-previsao-sazonal-inmet"],"territorio":"2408003"}`

> Pelas previsões do SEDES, a chance de dezembro de 2026 ser mais quente que o normal em Mossoró–RN é **alta**. A previsão do CPTEC/INPE dá **mais de 65%** de chance de temperatura acima do normal (Previsão de Temperatura Mensal Probabilidade, CPTEC, dezembro de 2026; atualizado em 15/10/2026). Essa é a faixa mais alta da escala, e ela cobre todo o município.
>
> O INMET também aponta calor acima do normal, mas num grau menor: "levemente acima", de 0° a 1° (Previsão de Anomalia de Temperatura Mensal, INMET, dezembro de 2026; atualizado em 16/10/2026). As duas fontes apontam na mesma direção.
>
> Deixei de fora a probabilidade de temperatura do INMET, porque no cadastro do site ela lê a tabela de chuva, e os números podem não ser de temperatura.
>
> Previsão não é certeza; é uma estimativa para o mês.

## B06 — previsão e monitoramento — certo

**Juiz:** ok: 415 municípios, 15 em concordância, INMET 410 e CPTEC 16 batem com a resposta esperada. Informa índice (anomalia), período (set/2026 e dez/2026), critério (mais da metade da área) e datas. Não traz a versão por probabilidade (34) nem a divisão por estado, mas isso é um detalhe a mais.

**Esperado:** 415 municípios do Semiárido têm alguma área em seca grave ou pior no Monitor de Secas de setembro de 2026. As fontes quase nunca concordam em chuva abaixo do normal para dezembro: pela anomalia, 15 (INMET 410, CPTEC 16; 9 em Alagoas, 5 em Sergipe e 1 na Bahia); pela probabilidade, 34 (INMET 396, CPTEC 34). Diz qual índice usou e o critério (mais da metade da área abaixo).

**Pergunta:** No Semiárido, em quantos municípios com seca grave ou pior as previsões do CPTEC e do INMET concordam que dezembro vai ter chuva abaixo do normal?

13,5 s · 3 rodadas · 64,9 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH per AS (SELECT MAX(periodo) AS p FROM valores WHERE indice='monitor-de-seca-ana'),\nsec AS (\n  SELECT v.territorio, SUM(v.valor) AS s FROM valores v, per\n  WHERE v.indice='monitor-de-seca-ana' AND v.periodo=per.p AND v.classe>=4\n  GROUP BY v.territorio HAVING SUM(v.valor)>0\n),\ncp AS (SELECT territorio, SUM(valor) AS s FROM valores WHERE indice='previsao-anomalia-precipitacao-cpte`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"5_semiarido-semiarido-total"}`

> **15 dos 415 municípios** do Semiárido com seca grave ou pior concordam, nas duas previsões, que dezembro de 2026 terá chuva abaixo do normal.
>
> As fontes discordam bastante. Pela previsão do CPTEC, só 16 desses municípios têm mais da metade da área abaixo do normal. Pela do INMET, são 410.
>
> - **Seca:** Monitor de Secas da ANA, setembro de 2026 (atualizado no SEDES em 19/10/2026). Considerei seca grave ou pior qualquer município com alguma área nas classes seca grave, extrema ou excepcional.
> - **Previsão:** anomalia de precipitação para dezembro de 2026, CPTEC/INPE (atualizado em 14/10/2026) e INMET (atualizado em 16/10/2026). Considerei "abaixo do normal" as três classes abaixo da média (levemente abaixo, abaixo e muito abaixo), com mais da metade da área do município.
> - **Recorte:** os 415 municípios têm previsão das duas fontes.
>
> Se quiser, posso refazer o cálculo com outro corte, por exemplo qualquer área abaixo do normal em vez de mais da metade.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=5_semiarido-semiarido-total&period=2026&layers=monitor-de-seca-ana%2Cprevisao-anomalia-precipitacao-cptec-inpe%2Cprevisao-anomalia-precipitacao-mensal-inmet)

## B08 — previsão e monitoramento — certo

**Juiz:** ok. Diz que não dá para afirmar melhora, e os números batem com as ferramentas: 37,9% grave, 42,9% moderada, INMET 76% em dezembro, CPTEC levemente acima em quase toda a área. Aponta que as fontes discordam e que previsão é estimativa. Não traz o total 80,8% de seca moderada ou pior, mas dá os dois componentes (42,9% e 37,9%), então a informação está lá.

**Números faltando:** 80,8

**Esperado:** Não dá para afirmar. Hoje (Monitor de Secas de setembro de 2026) a Paraíba tem 80,8% da área em seca moderada ou pior (37,9% grave). As previsões de chuva discordam: o INMET prevê dezembro levemente abaixo do normal em 76,4% da área (anomalia), o CPTEC prevê levemente acima em quase toda a área (99,9%). Diz que é previsão e que as fontes discordam; não promete melhora nem piora.

**Pergunta:** A seca na Paraíba vai melhorar nos próximos meses?

11,3 s · 4 rodadas · 67,3 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT 'seca' AS tipo, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='pb' AND periodo >= '2026-05' ORDER BY periodo, classe"}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice IN ('previsao-anomalia-precipitacao-mensal-inmet','previsao-anomalia-precipitacao-cptec-2','previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-trimestral-cptec','previsao-anomalia-precipitacao-trimestral-inmet') AND territorio='pb' ORDER BY indice, periodo, classe"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"pb"}`

> **Não dá para dizer que a seca na Paraíba vai melhorar.** Em setembro de 2026 ela se agravou, e as previsões de chuva são fracas e divergem entre as fontes.
>
> - **Situação atual:** no Monitor de Secas da ANA, a seca grave ou pior cobria 37,9% da área do estado em setembro de 2026. Em agosto, era 0%. A seca moderada cobria 42,9% e a fraca, 11,0%. Esse é o dado mais recente disponível no SEDES. Dado atualizado em 19/10/2026.
> - **Previsão do CPTEC/INPE (novembro de 2026 a fevereiro de 2027):** para novembro, dezembro e janeiro, quase toda a área deve ficar "levemente acima do normal" de chuva (0 a 30 mm por mês). Em fevereiro, metade da área fica levemente abaixo e metade levemente acima. Atualizado em 14/10/2026.
> - **Previsão do INMET (novembro de 2026 a janeiro de 2027):** a chuva deve ficar levemente abaixo do normal em grande parte do estado. Em dezembro, 76% da área está nessa faixa. Em novembro, 38%, e em janeiro, 43%. No trimestre de novembro, 93% da área fica levemente abaixo. Atualizado em 16/10/2026.
>
> As duas fontes discordam. Além disso, as anomalias previstas são pequenas, e previsão é estimativa, não certeza.
