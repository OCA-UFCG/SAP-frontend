# Rodada prev-v0

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T14:09.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 8 (8)                          |
| Notas do juiz                           | 4 certo · 3 parcial · 1 errado |
| Com número esperado faltando            | 3                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 13,1 · 11,2 · 24,7 s           |
| Rodadas do modelo por turno             | 4,0                            |
| Ferramentas por turno                   | 3,0                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 79 mil                         |
| Tokens de saída por turno               | 2365                           |
| Custo somado (preço de API)             | US$ 0.03                       |

| Id  | Categoria                | Nota         | Tempo (s) | Rodadas | Ferramentas |
| --- | ------------------------ | ------------ | --------- | ------- | ----------- |
| B01 | previsão e monitoramento | errado       | 24,7      | 5       | 4           |
| B02 | previsão e priorização   | parcial      | 20,4      | 5       | 4           |
| B03 | previsão                 | parcial      | 9,2       | 4       | 3           |
| B04 | previsão                 | certo (nº)   | 8,4       | 3       | 2           |
| B05 | previsão                 | certo        | 7,2       | 4       | 3           |
| B06 | previsão e monitoramento | certo        | 16,1      | 3       | 2           |
| B07 | previsão                 | parcial (nº) | 7,6       | 4       | 3           |
| B08 | previsão e monitoramento | certo (nº)   | 11,2      | 4       | 3           |

## B01 — previsão e monitoramento — errado

**Juiz:** A frase em negrito ("Não, nenhum... deve ter chuva abaixo do normal") contradiz o dado do INMET, que dá "levemente abaixo do normal" para quase todos. A resposta esperada diz para não responder só "não". Além disso, "35 deles têm 100%" está errado: a tabela da ferramenta mostra 50 municípios com 100%. A divisão "79 e 1" do INMET também não aparece em nenhuma saída, que só trouxe a média de 98,9%.

**Esperado:** 80 municípios da Paraíba têm alguma área em seca grave ou pior no Monitor de Secas de setembro de 2026. Para dezembro de 2026 as previsões discordam: no INMET, quase todos têm previsão abaixo do normal (anomalia: 79 dos 80; probabilidade: 77), no CPTEC quase nenhum (anomalia: 0; probabilidade: 9), que puxa para levemente acima. Os desvios previstos são pequenos (classes "levemente", até 30 mm no mês). Diz que é previsão e que as fontes discordam; não responde só "sim" ou só "não".

**Pergunta:** Os municípios da Paraíba que estão em seca grave ou pior vão ter chuva abaixo do normal em dezembro?

24,7 s · 5 rodadas · 100,7 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH seca AS (SELECT territorio, SUM(valor) AS seca_grave_mais FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio HAVING SUM(valor)>0), prev AS (SELECT territorio, SUM(CASE WHEN classe<=2 THEN valor ELSE 0 END) AS muito_abaixo_ou_abaixo, SUM(CASE WHEN classe<=3 THEN valor ELSE 0 END) AS qualquer_abaixo FROM valores WHERE indice='previsao`
1. consultar_sql: `{"sql":"WITH seca AS (SELECT territorio, SUM(valor) AS s FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio HAVING SUM(valor)>0), prev AS (SELECT territorio, SUM(CASE WHEN classe<=2 THEN valor ELSE 0 END) AS a2, SUM(CASE WHEN classe<=3 THEN valor ELSE 0 END) AS a3 FROM valores WHERE indice='previsao-anomalia-precipitacao-cptec-inpe' AND periodo=`
1. consultar_sql: `{"sql":"WITH seca AS (SELECT territorio FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio HAVING SUM(valor)>0) SELECT 'CPTEC' AS fonte, rotulo_classe, ROUND(AVG(valor),1) AS media_pct_area, COUNT(*) AS municipios FROM valores_com_nomes v JOIN seca s ON s.territorio=v.territorio WHERE v.indice='previsao-anomalia-precipitacao-cptec-inpe' AND v.pe`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-cptec-inpe"],"territorio":"pb"}`

> **Não, nenhum dos 80 municípios paraibanos em seca grave ou pior deve ter chuva abaixo do normal em dezembro de 2026, segundo as duas previsões do SEDES.**
>
> - **CPTEC/INPE** (atualizado em 14/10/2026): todos os 80 ficam na faixa "levemente acima do normal" (0 a 30 mm/mês).
> - **INMET** (atualizado em 16/10/2026): 79 deles ficam em "levemente abaixo do normal" (-30 a 0 mm/mês) e 1 em "levemente acima". Nenhum fica nas faixas de abaixo do normal de -30 mm ou menos.
>
> As duas fontes divergem: uma aponta chuva um pouco acima e a outra um pouco abaixo. Em nenhuma delas a chuva fica abaixo do normal de forma forte. Previsão não é medição e pode não se confirmar.
>
> A seca grave ou pior é do Monitor de Secas da ANA, setembro de 2026 (atualizado em 19/10/2026), em % da área de cada município. Os 80 municípios estão em seca grave ou pior em pelo menos uma parte da área, e 35 deles têm 100% da área nessa condição.
>
> Você pode ver os dados no SEDES com o botão abaixo.

## B02 — previsão e priorização — parcial

**Juiz:** A resposta abre com "Nenhum", mas Moraújo e Senador Sá têm 100% da área em "levemente abaixo", que é abaixo do normal, então o texto se contradiz (o esperado é "quase nenhum"). Também não consultou a probabilidade trimestral do CPTEC, e por isso omitiu Banabuiú (57,9% da área abaixo). Os 27 municípios, o período 2026-12 e a ressalva de previsão estão corretos.

**Esperado:** Priorização padrão do Ceará: 27 de prioridade muito alta. Só o CPTEC tem o trimestre dezembro–fevereiro (período 2026-12 dos índices trimestrais). Quase nenhum tem previsão abaixo do normal: pela probabilidade, só Banabuiú (57,9% da área abaixo); pela anomalia, Moraújo e Senador Sá (100% levemente abaixo). Os outros puxam para levemente acima (o estado: 66% da área com chance de 0% a 40% acima do normal). Diz que é previsão e que a prioridade vem da planilha da Priorização.

**Pergunta:** Dos municípios de prioridade muito alta no Ceará, quantos têm previsão de chuva abaixo do normal para o trimestre de dezembro a fevereiro?

20,4 s · 5 rodadas · 96,4 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo FROM periodos WHERE indice IN ('previsao-anomalia-precipitacao-trimestral-cptec','previsao-anomalia-precipitacao-cptec-inpe') AND periodo >= '2026-11' ORDER BY indice, periodo;"}`
1. consultar_sql: `{"sql":"SELECT p.nome, p.uf, SUM(CASE WHEN v.classe IN (1,2) THEN v.valor ELSE 0 END) AS abaixo_ou_muito_abaixo, SUM(CASE WHEN v.classe = 3 THEN v.valor ELSE 0 END) AS levemente_abaixo, COUNT(v.classe) AS linhas FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'previsao-anomalia-precipitacao-trimestral-cptec' AND v.periodo = '2026-12' WHERE p.nivel = 'Muito alta' GR`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-cptec"],"territorio":"ce"}`

> **Nenhum.** Dos 27 municípios de prioridade muito alta no Ceará, nenhum tem área prevista com chuva abaixo do normal para dezembro de 2026 a fevereiro de 2027.
>
> - **Moraújo e Senador Sá** são os únicos com previsão de chuva "levemente abaixo do normal" (-100 a 0 mm por trimestre), com 100% da área nessa classe.
> - Os outros 25 têm toda a área em classes de chuva igual ou acima do normal.
>
> Assumi que a linha "2026-12" da previsão trimestral do CPTEC/INPE é o trimestre dezembro a fevereiro, porque o catálogo não traz esse rótulo. Previsão não é medição, e o resultado pode mudar quando o índice for atualizado.
>
> Fontes:
>
> - **Priorização do SEDES**, Ceará, com critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), cenário pessimista, cada estado comparado separadamente. Os níveis vêm da planilha da Priorização.
> - **Previsão de anomalia de precipitação trimestral, CPTEC/INPE**, trimestre 2026-12, dado atualizado em 14/10/2026 no SEDES. Os valores estão em % da área de cada município.

## B03 — previsão — parcial

**Juiz:** Os números de anomalia e probabilidade batem com as ferramentas, e a divergência CPTEC (levemente acima) × INMET (levemente abaixo) está certa, com o aviso de que é previsão. Mas faltam o total de chuva do mês (10 a 100 mm, que responde "vai chover?"), pois não consultou os índices de precipitação acumulada, e a probabilidade do CPTEC (0% a 40% acima do normal), que está nos dados mas não aparece na resposta.

**Esperado:** Não dá para dizer se vai chover num dia; o SEDES tem previsões mensais. Para dezembro de 2026, CPTEC e INMET preveem de 10 a 100 mm no mês em toda a área de Petrolina–PE. Quanto ao normal, os dois ficam perto dele e discordam no lado: o CPTEC prevê levemente acima (0 a 30 mm, chance de 0% a 40% acima do normal) e o INMET levemente abaixo (-30 a 0 mm; 92,5% da área com chance de 0% a 40% abaixo do normal). Diz que é previsão.

**Pergunta:** Vai chover em Petrolina em dezembro?

9,2 s · 4 rodadas · 92 mil tokens de entrada

1. buscar_territorio: `{"nome":"Petrolina","uf":"PE"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, c.rotulo AS rotulo_classe, v.valor FROM valores v LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet','previsao-anomalia-precipitacao-trimestral-cptec','previsao-anomalia-precipitacao-trimestral-inmet','previsao-precipitacao-mensal`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"2611101"}`

> Os dois modelos de previsão para dezembro de 2026 em Petrolina–PE não concordam na direção da chuva. Esta é uma previsão, não uma medição.
>
> - **CPTEC/INPE** (anomalia de precipitação, atualizado em 14/10/2026): chuva levemente acima do normal para a época, de 0 a 30 mm/mês, em 100% da área do município.
> - **INMET** (anomalia mensal, atualizado em 16/10/2026): chuva levemente abaixo do normal, de -30 a 0 mm/mês, em 100% da área.
> - **INMET, probabilidade** (atualizado em 16/10/2026): 92,5% da área com chance de chuva abaixo do normal (de -40% a 0%) e 7,5% numa faixa um pouco mais seca (de -65% a -40%).
>
> Na prática, a previsão indica chuva perto do normal, com inclinação para abaixo do normal segundo o INMET e para acima segundo o CPTEC. Para decisões, vale acompanhar as próximas atualizações.

## B07 — previsão — parcial

**Juiz:** Os números da anomalia batem com a ferramenta (59,4%, 40,2%, 0,4%) e a resposta diz que é previsão. Faltam a probabilidade (58,2% e 36,6%) e o trimestre completo: ela diz só "novembro de 2026" e não cita nov/2026 a jan/2027. A resposta esperada exige esses itens, e o assistente não consultou a probabilidade.

**Números faltando:** 58,2

**Esperado:** O INMET tem um trimestre: novembro de 2026 a janeiro de 2027 (período 2026-11). Prevê chuva abaixo do normal em quase todo o Semiárido: anomalia de -300 a -100 mm em 59,4% da área e de -100 a 0 mm em 40,2%; na probabilidade, 58,2% da área tem mais de 65% de chance de ficar abaixo do normal e 36,6% de 40% a 65%. Diz que é previsão e nomeia os três meses.

**Pergunta:** O que diz a previsão trimestral de chuva do INMET para o Semiárido?

7,6 s · 4 rodadas · 61,4 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT rotulo_classe, valor FROM valores_com_nomes WHERE indice='previsao-anomalia-precipitacao-trimestral-inmet' AND periodo='2026-11' AND territorio='5_semiarido-semiarido-total' ORDER BY classe;"}`
1. consultar_sql: `{"sql":"SELECT periodo, rotulo FROM periodos WHERE indice='previsao-anomalia-precipitacao-trimestral-inmet';"}`
1. link_no_sedes: `{"indices":["previsao-anomalia-precipitacao-trimestral-inmet"],"territorio":"5_semiarido-semiarido-total"}`

> Para o Semiárido, a previsão trimestral de chuva do INMET (período marcado como novembro de 2026) aponta chuva **abaixo do normal** na maior parte da área:
>
> - **59,4%** da área: abaixo do normal (-300 a -100 mm/trimestre)
> - **40,2%**: levemente abaixo (-100 a 0 mm/trimestre)
> - **0,4%**: levemente acima (0 a 100 mm/trimestre)
> - As demais faixas somam 0%.
>
> Ou seja, quase todo o Semiárido deve ficar com chuva abaixo da média para a época. Isso é uma previsão, não uma medição, e pode não se confirmar.
>
> Fonte: Previsão Anomalia Precipitação Trimestral, INMET, período 2026-11, Semiárido. Dado atualizado no SEDES em 16/10/2026.
>
> [Ver no SEDES]

## B04 — previsão — certo

**Juiz:** Ok. Os números do INMET (74,0% de 1° a 3° acima e 26,0% de 0° a 1° acima) batem com a resposta esperada e com a ferramenta. O assistente usou a anomalia trimestral do CPTEC (92,0% e 8,0%) em vez da probabilidade mensal, mas esses valores vêm da ferramenta e as datas de atualização (15/10 e 16/10) estão corretas. Também avisa que é previsão, e não usou a probabilidade de temperatura do INMET.

**Números faltando:** 74

**Esperado:** Sim, nas duas fontes, mas com intensidade diferente. INMET (anomalia de temperatura mensal, dezembro de 2026): 74% da área do Nordeste de 1° a 3° acima do normal e 26% de 0° a 1° acima. CPTEC (probabilidade mensal, dezembro de 2026): 78,4% da área com mais de 40% de chance de ficar acima do normal (48,3% com 40% a 65%; 30,1% com mais de 65%). Não usa a probabilidade de temperatura do INMET sem avisar que ela repete os números da chuva. Diz que é previsão.

**Pergunta:** A previsão é de mais calor que o normal no Nordeste em dezembro?

8,4 s · 3 rodadas · 62,1 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice IN ('previsao-anomalia-temperatura-trimestral-cptec','anomalia-de-temperatura-mensal-previsao-sazonal-inmet','previsao-anomalia-temperatura-trimestral-inmet') AND periodo IN ('2026-12','2027-01') AND territorio='2_regiao-nordeste' ORDER BY indice, periodo, classe;"}`
1. link_no_sedes: `{"indices":["previsao-anomalia-temperatura-trimestral-cptec","anomalia-de-temperatura-mensal-previsao-sazonal-inmet"],"territorio":"2_regiao-nordeste"}`

> Sim. Nas duas previsões de temperatura do SEDES, o Nordeste aparece com calor acima do normal em dezembro de 2026, mas sem anomalias extremas.
>
> - **CPTEC/INPE (previsão trimestral, dezembro de 2026):** 92,0% da área do Nordeste fica entre 0 e 1 °C acima do normal, e 8,0% entre 1 e 3 °C acima. Nenhuma área fica abaixo do normal.
> - **INMET (previsão mensal, dezembro de 2026):** 74,0% da área fica entre 1 e 3 °C acima do normal, e 26,0% entre 0 e 1 °C acima. Nenhuma área fica abaixo do normal nem acima de 3 °C.
>
> Atualizações: CPTEC em 15/10/2026 e INMET em 16/10/2026. Previsão não é medição: são estimativas que podem não se confirmar.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=2_regiao-nordeste&period=2026&layers=previsao-anomalia-temperatura-trimestral-cptec%2Canomalia-de-temperatura-mensal-previsao-sazonal-inmet)

## B05 — previsão — certo

**Juiz:** ok: o assistente usou o índice CPTEC correto (100% da área de Mossoró na classe >65% acima do normal, dez/2026) e citou fonte, período e data (15/10/2026). Não citou o INMET, que a resposta esperada trata como extra, e evitou o índice problemático.

**Esperado:** CPTEC (probabilidade de temperatura mensal, dezembro de 2026): 100% da área de Mossoró–RN com mais de 65% de chance de ficar acima do normal. O INMET prevê de 0° a 1° acima do normal (anomalia). A probabilidade de temperatura do INMET não serve: no cadastro do site ela lê a tabela da chuva e repete os mesmos números (31,9% e 68,1% abaixo do normal); se citá-la, avisa isso.

**Pergunta:** Qual a chance de fazer mais calor que o normal em Mossoró em dezembro?

7,2 s · 4 rodadas · 92,2 mil tokens de entrada

1. buscar_territorio: `{"nome":"Mossoró"}`
1. consultar_sql: `{"sql":"SELECT v.indice, v.periodo, v.classe, c.rotulo AS rotulo_classe, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='previsao-temperatura-mensal-probabilidade-cptec' AND v.periodo='2026-12' AND v.territorio='2408003' ORDER BY v.classe;"}`
1. link_no_sedes: `{"indices":["previsao-temperatura-mensal-probabilidade-cptec"],"territorio":"2408003"}`

> Em Mossoró, a previsão do CPTEC/INPE indica **mais de 65% de chance** de dezembro de 2026 ficar **acima do normal** em temperatura. É a faixa mais alta do índice, e ela cobre 100% da área do município.
>
> - **Fonte:** Previsão de Temperatura Mensal Probabilidade, CPTEC/INPE, dezembro de 2026, atualizada no SEDES em 15/10/2026.
> - **O que o número significa:** a chance de a temperatura média ficar acima da normal para a época, não a temperatura prevista em graus.
> - **Ressalva:** é uma previsão, não uma medição, e pode não se confirmar.
>
> Se quiser, posso mostrar também a previsão trimestral para dezembro.

## B06 — previsão e monitoramento — certo

**Juiz:** ok. A resposta traz 415 municípios com seca grave ou pior (setembro de 2026), 15 com mais da metade da área abaixo do normal nas duas previsões, INMET 410 e CPTEC 16, como esperado. Diz o índice (anomalia), o critério de corte e as datas. Não traz a distribuição por UF nem a versão por probabilidade (34), mas o essencial bate.

**Esperado:** 415 municípios do Semiárido têm alguma área em seca grave ou pior no Monitor de Secas de setembro de 2026. As fontes quase nunca concordam em chuva abaixo do normal para dezembro: pela anomalia, 15 (INMET 410, CPTEC 16; 9 em Alagoas, 5 em Sergipe e 1 na Bahia); pela probabilidade, 34 (INMET 396, CPTEC 34). Diz qual índice usou e o critério (mais da metade da área abaixo).

**Pergunta:** No Semiárido, em quantos municípios com seca grave ou pior as previsões do CPTEC e do INMET concordam que dezembro vai ter chuva abaixo do normal?

16,1 s · 3 rodadas · 63,5 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH sem AS (\n  SELECT v.territorio AS cod FROM valores v JOIN territorios t ON t.codigo = v.territorio\n  WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' AND v.classe >= 4\n    AND t.tipo = 'municipio' AND t.semiarido = 1\n  GROUP BY v.territorio HAVING SUM(v.valor) > 0\n),\nc AS (SELECT territorio AS cod, SUM(valor) AS p FROM valores\n  WHERE indice = 'previsao-anomalia`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-cptec-inpe","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"5_semiarido-semiarido-total"}`

> No Semiárido, **15 municípios** com seca grave ou pior estão nas duas previsões com mais da metade da área prevista abaixo do normal para dezembro de 2026. Se contar qualquer parcela da área prevista abaixo do normal, são **25**.
>
> - **Seca:** Monitor de Secas da ANA, setembro de 2026 (último mês no tabelão; atualizado no SEDES em 19/10/2026). São 415 municípios com seca grave, extrema ou excepcional.
> - **Previsões:** CPTEC/INPE (atualizado em 14/10/2026) e INMET (atualizado em 16/10/2026), anomalia de chuva para dezembro de 2026. "Abaixo do normal" são as classes "muito abaixo", "abaixo" e "levemente abaixo". São estimativas, não medições.
>
> A concordância é baixa porque as duas previsões divergem bastante. Com mais da metade da área abaixo do normal, o INMET marca 410 dos 415 municípios e o CPTEC marca só 16. Não investiguei a causa dessa diferença.
>
> Os números são de "% da área", então "mais da metade" é um corte que escolhi. Se preferir outro corte, posso refazer a conta.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=5_semiarido-semiarido-total&period=2026&layers=monitor-de-seca-ana%2Cprevisao-anomalia-precipitacao-cptec-inpe%2Cprevisao-anomalia-precipitacao-mensal-inmet)

## B08 — previsão e monitoramento — certo

**Juiz:** Ok. Não promete melhora, e os números batem com as ferramentas: 37,9% grave, 42,9% moderada, INMET em dezembro com 76,4% levemente abaixo e CPTEC com quase toda a área levemente acima. Também diz que é previsão e traz as datas. Falta só o total de 80,8% em seca moderada ou pior, mas ele é a soma de 37,9% e 42,9%, que aparecem na resposta.

**Números faltando:** 80,8

**Esperado:** Não dá para afirmar. Hoje (Monitor de Secas de setembro de 2026) a Paraíba tem 80,8% da área em seca moderada ou pior (37,9% grave). As previsões de chuva discordam: o INMET prevê dezembro levemente abaixo do normal em 76,4% da área (anomalia), o CPTEC prevê levemente acima em quase toda a área (99,9%). Diz que é previsão e que as fontes discordam; não promete melhora nem piora.

**Pergunta:** A seca na Paraíba vai melhorar nos próximos meses?

11,2 s · 4 rodadas · 63,9 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='pb' AND periodo BETWEEN '2026-01' AND '2026-09' AND classe IN (1,2,3,4,5,6) ORDER BY periodo, classe;"}`
1. consultar_sql: `{"sql":"SELECT i.id, v.periodo, v.classe, v.valor FROM valores v JOIN indices i ON i.id=v.indice WHERE v.indice IN ('previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet') AND v.territorio='pb' ORDER BY i.id, v.periodo, v.classe;"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","previsao-anomalia-precipitacao-mensal-inmet"],"territorio":"pb"}`

> **Não dá para afirmar que vai melhorar.** O último dado de seca mostra piora em setembro, e as previsões de chuva são mistas.
>
> **Último dado (Monitor de Secas, ANA, setembro de 2026; atualizado em 19/10/2026):**
>
> - Seca grave ou pior ocupava 37,9% da área da Paraíba em setembro. Em agosto, esse percentual era zero.
> - Seca moderada ocupava 42,9% da área.
> - A área sem seca caiu de 13,9% em agosto para 8,2% em setembro.
>
> O tabelão não tem outubro, então não sei como está a seca neste mês.
>
> **Previsão de chuva (anomalia, não é medição):** indica se a chuva deve ficar acima ou abaixo do normal para a época.
>
> - **CPTEC/INPE** (atualizado em 14/10/2026): para novembro, dezembro e janeiro, quase toda a área fica com chuva levemente acima do normal (0 a 30 mm/mês). Em fevereiro, a previsão fica dividida entre levemente abaixo e levemente acima.
> - **INMET** (atualizado em 16/10/2026): em novembro, 61,9% da área fica levemente acima do normal e 38,1%, levemente abaixo. Em dezembro, 76,4% fica levemente abaixo. Em janeiro, 56,6% fica levemente acima.
>
> Chuva acima do normal nos próximos meses ajudaria, mas a previsão não é certeza, e a seca só muda de forma clara quando o Monitor de Secas registra a melhora.
