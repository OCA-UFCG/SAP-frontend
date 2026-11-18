# Rodada z-v1

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T19:42.

| Medida                                                | Valor                           |
| ----------------------------------------------------- | ------------------------------- |
| Perguntas (turnos)                                    | 24 (25)                         |
| Notas do juiz                                         | 18 certo · 5 parcial · 1 errado |
| Com número esperado faltando                          | 3                               |
| Turnos com erro                                       | 0                               |
| Tempo por turno (média · mediana · p90)               | 11,5 · 9,9 · 18,3 s             |
| Rodadas do modelo por turno                           | 3,3                             |
| Ferramentas por turno                                 | 2,3                             |
| Turnos que chamaram listar_indices                    | 4%                              |
| Tokens de entrada por turno (com cache)               | 90,3 mil                        |
| Tokens de saída por turno                             | 1895                            |
| Custo somado (preço de API)                           | US$ 0.07                        |
| Chamadas de ferramenta que voltaram com erro          | 2                               |
| Respostas reescritas pela conferência dos números     | 0                               |
| Respostas que ficaram com número sem fonte            | 0                               |
| Turnos com link para o site · com perguntas sugeridas | 22 · 25                         |

| Id  | Categoria                    | Nota         | Tempo (s) | Rodadas | Ferramentas |
| --- | ---------------------------- | ------------ | --------- | ------- | ----------- |
| Z01 | há quanto tempo              | certo        | 7,3       | 3       | 2           |
| Z02 | pior mês                     | parcial (nº) | 7,3       | 2       | 1           |
| Z03 | época do ano                 | certo        | 9,9       | 2       | 1           |
| Z04 | onde piorou                  | parcial      | 18,8      | 3       | 2           |
| Z05 | km²                          | certo        | 14,3      | 3       | 2           |
| Z06 | milímetros                   | certo        | 9,5       | 4       | 3           |
| Z07 | índice sem teste             | certo        | 10,5      | 4       | 3           |
| Z08 | índice sem teste             | certo        | 7,1       | 4       | 3           |
| Z09 | índice sem teste             | certo        | 13,2      | 3       | 2           |
| Z10 | índice sem teste             | certo        | 13,2      | 3       | 2           |
| Z11 | recorte ASD                  | parcial      | 15,6      | 3       | 2           |
| Z12 | duas fontes                  | parcial (nº) | 18,3      | 3       | 2           |
| Z13 | índice sem teste             | certo        | 12,5      | 5       | 4           |
| Z14 | é normal para a época        | parcial      | 22,7      | 8       | 7           |
| Z15 | posição                      | errado (nº)  | 11,4      | 3       | 2           |
| Z16 | graus                        | certo        | 8,0       | 4       | 3           |
| Z17 | índice sem teste             | certo        | 9,2       | 3       | 2           |
| Z18 | filtro composto              | certo        | 17,9      | 4       | 3           |
| Z19 | mapa                         | certo        | 10,8      | 3       | 2           |
| Z20 | km²                          | certo        | 8,4       | 3       | 2           |
| Z21 | continuação: há quanto tempo | certo        | 8,4 + 8,5 | 4 + 3   | 3 + 2       |
| Z22 | robustez da priorização      | certo        | 7,1       | 2       | 1           |
| Z23 | perfil dos níveis            | certo        | 7,1       | 2       | 1           |
| Z24 | mapa da priorização          | certo        | 9,7       | 2       | 1           |

## Z15 — posição — errado

**Juiz:** A resposta diz "Só 2 dos 223 municípios paraibanos têm percentual mais baixo", mas a ferramenta mostra 221 municípios com valor maior. Isso deixa só 1 município com valor menor (223 − 1 − 221). O número está errado, e a resposta não cita os 221 com percentual maior. A conclusão (Não, Campina Grande está entre os menos pobres) e os valores de 36,9% e 57,9% estão certos.

**Números faltando:** 221

**Esperado:** Não: é o segundo menor percentual do estado. Pobreza total do CadÚnico em 2025: 36,9% das famílias inscritas; só 1 dos 223 municípios tem percentual menor e 221 têm maior; a média dos municípios é 57,9%.

**Pergunta:** Campina Grande está entre os municípios mais pobres da Paraíba?

11,4 s · 3 rodadas · 69,4 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH pb AS (SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'percentual-de-pobreza-total-cadunico' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.uf = 'PB') SELECT nome, valor, (SELECT COUNT(*) FROM pb) AS total_municipios, (SELECT COUNT(*) FROM pb p2 WHERE p2.valor > pb.valor) AS municipios_com_valor_maior, (SELECT valor FROM val`
1. consultar_sql: `{"sql":"SELECT t.nome AS rotulo, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'percentual-de-pobreza-total-cadunico' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.uf = 'PB' ORDER BY v.valor DESC LIMIT 10","grafico":{"tipo":"ranking","titulo":"Pobreza total no CadÚnico, 10 municípios paraibanos com maior percentual, 2025","unidade":"% das famílias do`

> Não. Campina Grande está entre os municípios com **menor** pobreza da Paraíba. Em 2025, 36,9% das famílias inscritas no CadÚnico de Campina Grande estavam em situação de pobreza. Só 2 dos 223 municípios paraibanos têm percentual mais baixo.
>
> Para comparação, a média simples dos municípios da Paraíba foi de 57,9%. Os 10 municípios com maior percentual ficam entre 69,7% (Teixeira) e 74,2% (Juarez Távora).
>
> Índice: Percentual de pobreza total (CadÚnico), 2025, Campina Grande–PB. Atualizado no SEDES em 06/10/2026. O valor é a porcentagem das famílias inscritas no CadÚnico em situação de pobreza, não da população total. O valor da Paraíba é a média simples dos municípios, não a população do estado.

## Z02 — pior mês — parcial

**Juiz:** A resposta cita o empate (dez/2025, jan e fev/2026) com 81,6% em seca grave ou pior e diz o critério, o que está certo. O 81,6 bate com a ferramenta, e a diferença para o 81,7 esperado é só arredondamento. O erro é dizer que os dados vão "de novembro de 2024 a setembro de 2026", quando a série consultada começa em 2024-01.

**Números faltando:** 81,7

**Esperado:** Dezembro de 2025, janeiro e fevereiro de 2026, empatados com 81,7% da área do estado em seca grave ou pior (81,65). Diz o critério de "pior" que usou. Não pode citar um mês só sem dizer do empate.

**Pergunta:** Qual foi o pior mês de seca na Paraíba no Monitor de Secas desde 2024?

7,3 s · 2 rodadas · 69,3 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT periodo AS rotulo, ROUND(SUM(CASE WHEN classe >= 4 THEN valor ELSE 0 END), 1) AS valor, ROUND(SUM(CASE WHEN classe >= 3 THEN valor ELSE 0 END), 1) AS moderada_ou_pior FROM valores WHERE indice = 'monitor-de-seca-ana' AND territorio = 'pb' GROUP BY periodo ORDER BY periodo","grafico":{"tipo":"serie","titulo":"Área da Paraíba em seca grave ou pior (classes 4 a 6), mensal desde 2024","`

> O pior mês foi **dezembro de 2025, janeiro e fevereiro de 2026**, empatados, com **81,6%** da área da Paraíba em seca grave ou pior (classes 4 a 6). Se o corte for seca moderada ou pior, o pico foi **janeiro de 2026**, com 90,2%.
>
> Esses dados são do Monitor de Secas (ANA), de novembro de 2024 a setembro de 2026. O índice foi atualizado no SEDES em 19/10/2026.

## Z04 — onde piorou — parcial

**Juiz:** O essencial bate com as ferramentas: 23 de 184 municípios pioraram, nenhum melhorou, e os aumentos de Nova Olinda (+95,9), Potengi (+72,3), Mauriti (+68,2), Crato (+36,6) e Santana do Cariri (+25,6) estão certos. Mas o texto diz que a seca grave ou pior "não aparece em nenhum município nos dois meses", e isso é falso. A consulta só mostrou essa coluna para os 10 primeiros por seca moderada ou pior, e Penaforte foi de 0% para 23,2% em grave ou pior. Também diz que a lista completa está na consulta, mas a consulta tinha LIMIT 10.

**Esperado:** Pela seca moderada ou pior (Monitor de Secas), 23 dos 184 municípios pioraram e nenhum melhorou; os maiores aumentos: Nova Olinda (+95,9 pontos da área), Potengi (+72,3), Mauriti (+68,2), Crato (+36,6). Pela seca grave ou pior, só Penaforte mudou (0% → 23,2%). Errado: dizer que só um município piorou (olhar só a grave ou pior) ou que o SEDES não tem a série.

**Pergunta:** Em quais municípios do Ceará a seca mais piorou entre junho e setembro de 2026?

18,8 s · 3 rodadas · 70,4 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH a AS (\n  SELECT v.territorio, t.nome,\n    COUNT(DISTINCT v.periodo) AS n,\n    SUM(CASE WHEN v.periodo='2026-06' AND v.classe>=3 THEN v.valor ELSE 0 END) AS mod_jun,\n    SUM(CASE WHEN v.periodo='2026-09' AND v.classe>=3 THEN v.valor ELSE 0 END) AS mod_set,\n    SUM(CASE WHEN v.periodo='2026-06' AND v.classe>=4 THEN v.valor ELSE 0 END) AS grave_jun,\n    SUM(CASE WHEN v.periodo='202`
1. consultar_sql: `{"sql":"WITH a AS (\n  SELECT v.territorio,\n    COUNT(DISTINCT v.periodo) AS n,\n    SUM(CASE WHEN v.periodo='2026-06' AND v.classe>=3 THEN v.valor ELSE 0 END) AS mod_jun,\n    SUM(CASE WHEN v.periodo='2026-09' AND v.classe>=3 THEN v.valor ELSE 0 END) AS mod_set\n  FROM valores v JOIN territorios t ON t.codigo = v.territorio\n  WHERE v.indice='monitor-de-seca-ana' AND v.periodo IN ('2026-06','202`

> Entre junho e setembro de 2026, a seca mais piorou em **Nova Olinda**, **Potengi** e **Mauriti**. Usei a soma das áreas em seca moderada ou pior (classes 3 a 6), porque a seca grave ou pior não aparece em nenhum município nos dois meses.
>
> Em Monitor de Secas (ANA), a área em seca moderada ou pior foi de:
>
> - **Nova Olinda:** 0,5% para 96,4% (+95,9 pontos percentuais)
> - **Potengi:** 26,8% para 99,2% (+72,3)
> - **Mauriti:** 18,0% para 86,2% (+68,2)
> - **Crato:** 41,6% para 78,2% (+36,6)
> - **Santana do Cariri:** 74,4% para 100% (+25,6)
>
> Dos 184 municípios do Ceará, 23 pioraram, nenhum melhorou e 161 ficaram iguais. A lista completa com todos os municípios que pioraram está na consulta, mas não repito aqui.
>
> Os dados são do Monitor de Secas da ANA, referentes a junho e setembro de 2026, atualizados no SEDES em 19/10/2026.

## Z11 — recorte ASD — parcial

**Juiz:** Os números batem com as consultas (68,0%, 69,7%, 63,3%; grave ou pior 33,9%, 33,8%, 29,8%). Mas a resposta não avisa que "o resto do Semiárido" não pode ser separado, porque todo o Semiárido está dentro de ASD + Entorno. Ela trata o Semiárido inteiro como "o resto" e abre com um "Não" categórico, quando a conclusão certa é que os recortes são quase iguais.

**Esperado:** Não dá para separar "o resto do Semiárido": todo município do Semiárido está no recorte ASD + Entorno. Pelos valores próprios dos recortes (Monitor de Secas, setembro de 2026), seca grave ou pior: Apenas ASD 33,9% da área, ASD + Entorno 29,8%, Semiárido 33,8%: quase iguais. Errado: afirmar que é pior (ou melhor) fora das ASD.

**Pergunta:** A seca está pior nas áreas suscetíveis à desertificação do que no resto do Semiárido?

15,6 s · 3 rodadas · 70,6 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT v.periodo, t.nome AS recorte,\n ROUND(SUM(CASE WHEN v.classe>=3 THEN v.valor ELSE 0 END),1) AS moderada_ou_pior,\n ROUND(SUM(CASE WHEN v.classe>=4 THEN v.valor ELSE 0 END),1) AS grave_ou_pior\nFROM valores v JOIN territorios t ON t.codigo=v.territorio\nWHERE v.indice='monitor-de-seca-ana'\n AND v.territorio IN ('4_asd-apenas-asd','4_asd-asd-entorno','5_semiarido-semiarido-total')\n `
1. consultar_sql: `{"sql":"SELECT t.nome AS recorte, v.periodo,\n ROUND(SUM(CASE WHEN v.classe>=3 THEN v.valor ELSE 0 END),1) AS moderada_ou_pior\nFROM valores v JOIN territorios t ON t.codigo=v.territorio\nWHERE v.indice='monitor-de-seca-ana' AND v.territorio IN ('4_asd-apenas-asd','4_asd-asd-entorno','5_semiarido-semiarido-total')\n AND v.periodo = (SELECT MAX(periodo) FROM valores WHERE indice='monitor-de-seca-an`

> Não. Em setembro de 2026, as áreas suscetíveis à desertificação (ASD) não estavam mais secas que o resto do Semiárido. A seca moderada ou pior ocupava 68,0% da área das ASD, contra 69,7% do Semiárido inteiro. Entre as ASD, as que ficam fora do entorno estavam um pouco mais secas que o conjunto de ASD + Entorno (63,3%).
>
> Seca grave ou pior, no mesmo mês: 33,9% nas ASD, 33,8% no Semiárido inteiro e 29,8% no recorte ASD + Entorno.
>
> Ao longo de 2025 e 2026, as três curvas andam juntas, com diferenças de poucos pontos percentuais. Em dezembro de 2025, por exemplo, a seca moderada ou pior chegou a 98,9% no Semiárido, 94,6% nas ASD e 94,5% no ASD + Entorno.
>
> Fonte: Monitor de Secas (ANA), setembro de 2026, dado atualizado no SEDES em 19/10/2026. Os valores são % da área de cada recorte. "Moderada ou pior" soma as classes de seca moderada, grave, extrema e excepcional. Os recortes têm valor próprio no tabelão.

## Z12 — duas fontes — parcial

**Juiz:** Os números e a conclusão batem com as ferramentas: BR-DWGD de 0,441 para 0,407 e ERA5-Land de 0,369 para 0,341, e as duas fontes apontam para mais árido. Faltam os dados por classe: no BR-DWGD, 74,0% da área em Semiárido em 1990 e 94,6% em 2024, e 100% em todos os anos no ERA5-Land. A frase "os dois valores ficam na faixa do Semiárido" vale só para a média. O máximo do BR-DWGD em 1990 foi 0,719, ou seja, parte do município era Úmida, e isso pode confundir quem lê.

**Números faltando:** 74,0, 94,6

**Esperado:** As duas apontam para um pouco mais árido, com intensidades diferentes: o índice de aridez médio do município caiu de 0,44 para 0,41 no BR-DWGD e de 0,37 para 0,34 no ERA5-Land (menor = mais árido), de 1990 a 2024. Nas classes, o BR-DWGD passou de 74,0% da área em Semiárido para 94,6%; no ERA5-Land a área é 100% Semiárido em todos os anos. Não pode dizer na mesma resposta que o município inteiro cai numa classe só e depois dar 74%.

**Pergunta:** O clima de Campina Grande ficou mais árido desde 1990? As duas fontes de aridez concordam?

18,3 s · 3 rodadas · 84,7 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT m.indice, m.periodo, m.media, m.minimo, m.maximo FROM medias m JOIN territorios t ON t.codigo = m.territorio WHERE t.tipo = 'municipio' AND t.uf = 'PB' AND t.nome_sem_acento = 'campina grande' AND m.indice IN ('indice-de-aridez-br-dwgd', 'indice-de-aridez-era5-land') AND m.periodo >= '1990' ORDER BY m.indice, m.periodo"}`
1. listar_indices: `{}`

> Sim, pelos dois índices Campina Grande (PB) ficou mais árido entre 1990 e 2024, e as duas fontes concordam na direção.
>
> - **Índice de Aridez BR-DWGD:** caiu de 0,441 em 1990 para 0,407 em 2024. Os menores valores foram por volta de 2019 a 2021 (0,398), com leve alta depois.
> - **Índice de Aridez ERA5-Land:** caiu de 0,369 em 1990 para 0,341 em 2024. O menor valor foi em 2019 (0,324), com leve alta depois.
>
> Quanto menor o índice, mais seco é o clima. Os dois valores ficam na faixa do Semiárido (0,20 a 0,50). Os níveis são diferentes entre as fontes (o BR-DWGD sempre fica acima do ERA5-Land), por isso compare a tendência, não os números em si. O índice é uma medida climática de longo prazo, não mede seca do momento.
>
> Fontes: Índice de Aridez BR-DWGD (1990 a 2024, atualizado em 27/08/2026) e Índice de Aridez ERA5-Land (1990 a 2024, atualizado em 28/08/2026), média municipal de Campina Grande–PB, tabelão gerado em 12/11/2026.

## Z14 — é normal para a época — parcial

**Juiz:** Os números batem com as ferramentas: 86,1% em 21/09/2026 (69,9% no Estágio 1 e 16,2% no Estágio 3), seca em só 5 dos 25 anos anteriores e 86,3% em 2021. Falta dizer que o SEDES não define um "normal" e que a comparação é só com os outros anos da série. A frase "bem acima do normal" sugere uma referência que o SEDES não tem. Também é impreciso dizer que não conseguiu obter outubro e novembro: o tabelão termina em 21/09/2026.

**Esperado:** Sim, pelo histórico do CDI no mesmo decêndio: em 21/09/2026, 86,1% da área estava em algum estágio de seca; de 2001 a 2025, só 5 dos 25 anos tinham seca nesse decêndio (2012, 2016, 2018 e 2020 com 100% e 2021 com 86,3%). Diz que o SEDES não define um "normal" e que a comparação é com os outros anos da série. Uma resposta só, sem repetir o texto.

**Pergunta:** A seca em Campina Grande agora é pior que o normal para esta época do ano?

22,7 s · 8 rodadas · 222,8 mil tokens de entrada

1. buscar_territorio: `{"nome":"Campina Grande","uf":"PB"}`
1. consultar_sql: `{"sql":"SELECT periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor ELSE 0 END) AS seca_pct, SUM(CASE WHEN classe = 4 THEN valor ELSE 0 END) AS estagio3_pct, SUM(CASE WHEN classe = 2 THEN valor ELSE 0 END) AS estagio1_pct FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND periodo >= '2026-01-01' GROUP BY periodo ORDER BY periodo"}`
1. consultar_sql: `{"sql":"SELECT substr(periodo,1,4) AS ano, periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor ELSE 0 END) AS seca_pct FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND substr(periodo,6,5) = '09-21' ORDER BY periodo"}`
1. consultar_sql: `{"sql":"SELECT periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND (periodo IN ('2026-09-21','2025-09-21','2024-09-21','2023-09-21','2001-09-21') OR periodo LIKE '2001-09%') ORDER BY periodo, classe"}`
1. consultar_sql: `{"sql":"SELECT substr(periodo,1,4) AS ano, COUNT(DISTINCT periodo) AS decendios FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' GROUP BY ano ORDER BY ano"}`
1. consultar_sql: `{"sql":"SELECT substr(periodo,1,4) AS ano, SUM(CASE WHEN classe IN (2,3,4) THEN valor ELSE 0 END) AS seca_pct, SUM(CASE WHEN classe = 4 THEN valor ELSE 0 END) AS estagio3_pct FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND substr(periodo,6,5) = '09-21' GROUP BY ano ORDER BY ano","grafico":{"tipo":"serie","titulo":"Seca (Estágios 1 a 3 do CDI) em Campina Grande`
1. relatorio_territorio: `{"chave":"2504009","periodo":"2026-11","indice":"cdi"}`

> **Sim, pelo último dado disponível, a seca em Campina Grande (PB) estava bem acima do normal para a época.** No decêndio de 21 de setembro de 2026, 86,1% da área do município estava em algum estágio de seca do Índice Combinado de Seca (CDI): 69,9% em Estágio 1 (o mais leve) e 16,2% em Estágio 3 (o mais avançado).
>
> Para o mesmo decêndio, nos 25 anos anteriores (2001 a 2025), houve seca em só 5 anos (2012, 2016, 2018, 2020 e 2021). Em 2021 o valor foi de 86,3%, parecido com o de agora. Nos outros 20 anos, a área em seca nesse decêndio foi zero.
>
> O SEDES não conseguiu obter agora os decêndios de outubro e novembro, então este número é de setembro. A data de atualização do CDI no site é 19/10/2026.

## Z01 — há quanto tempo — certo

**Juiz:** ok. Responde 1 mês (setembro de 2026, 82,5%), com agosto em 0% (a resposta diz de abril a agosto, o que bate com a série). Traz a maior sequência de 11 meses (maio de 2025 a março de 2026, 100%), o corte usado (classes 4 a 6) e que a série começa em janeiro de 2024. A consulta veio com gráfico de série.

**Esperado:** 1 mês: setembro de 2026 (82,5% da área); em agosto era 0%. A maior sequência foi de 11 meses, de maio de 2025 a março de 2026, com 100% da área. Diz o corte usado (seca grave ou pior = grave, extrema e excepcional) e que a série começa em 2024. Série com gráfico.

**Pergunta:** Há quantos meses seguidos Patos (PB) tem área em seca grave ou pior no Monitor de Secas?

7,3 s · 3 rodadas · 102,6 mil tokens de entrada

1. buscar_territorio: `{"nome":"Patos","uf":"PB"}`
1. consultar_sql: `{"sql":"SELECT periodo, SUM(CASE WHEN classe >= 4 THEN valor ELSE 0 END) AS valor FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='2510808' GROUP BY periodo ORDER BY periodo","grafico":{"tipo":"serie","titulo":"Área em seca grave ou pior (classes 4 a 6), Patos (PB), mensal","unidade":"% da área"}}`

> Patos (PB) está em seca grave ou pior há **1 mês seguido**, setembro de 2026, com 82,5% da área nessa condição. Antes disso, a seca grave ou pior ficou 0% da área de abril de 2026 a agosto de 2026.
>
> A maior sequência foi de **11 meses**, de maio de 2025 a março de 2026, quando 100% da área ficou em seca grave ou pior.
>
> Usei o corte "qualquer área em seca grave ou pior" (classes 4 a 6 do Monitor de Secas, ANA). A série vai de janeiro de 2024 a setembro de 2026, e o índice foi atualizado no SEDES em 19/10/2026.

## Z03 — época do ano — certo

**Juiz:** ok: os números (ago 27,8%, mai 20,6%) batem com a ferramenta. Ele diz que foram somados os Estágios 1 a 3 e que a série vai de 2001 a 2026, e avisa que a diferença é moderada. Cita julho a setembro; a ferramenta mostra jul 26,6 e set 25,6, então isso está certo. Só não dá os valores de jul e set nem diz que "não há época bem marcada", mas isso é detalhe.

**Esperado:** Somando os Estágios 1 a 3, a média de 2001 a 2026 é maior em agosto (27,8% da área), julho (26,6%) e setembro (25,6%), e menor em maio (20,6%). A diferença entre os meses é pequena: não há uma época bem marcada. Diz as classes somadas e os anos.

**Pergunta:** Em que meses do ano o CDI costuma apontar mais seca no Semiárido?

9,9 s · 2 rodadas · 69 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH dec AS (SELECT periodo, SUM(valor) AS s FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='5_semiarido-semiarido-total' AND classe IN (2,3,4) GROUP BY periodo) SELECT CASE substr(periodo,6,2) WHEN '01' THEN 'jan' WHEN '02' THEN 'fev' WHEN '03' THEN 'mar' WHEN '04' THEN 'abr' WHEN '05' THEN 'mai' WHEN '06' THEN 'jun' WHEN '07' THEN 'jul' WHEN '08' THEN 'ago' WHEN `

> O CDI aponta mais seca no Semiárido de **julho a setembro**, com pico em **agosto**. Entre os meses, agosto tem a maior média, com 27,8% da área em seca, e maio a menor, com 20,6%. A diferença entre os meses é moderada.
>
> Considerei como seca os Estágios 1 a 3 do CDI. Calculei a média, por mês, dos decêndios de 2001 a 2026 no recorte Semiárido. Ou seja, é a média de todos os anos da série, não o número de anos em que cada mês teve seca.
>
> Índice Combinado de Seca (CDI), Semiárido, todos os decêndios de 2001 a 2026 (dado atualizado no SEDES em 19/10/2026).

## Z05 — km² — certo

**Juiz:** ok. Os números batem com a ferramenta: 21.387 km², 37,9% de 56.463,6 km², Monitor de Secas de setembro de 2026, atualizado em 19/10/2026. O assistente disse que "grave ou pior" soma grave, extrema e excepcional, o que é correto. Só não disse que todo esse total é seca grave, sem área em extrema ou excepcional, mas isso é um detalhe a mais da resposta esperada.

**Esperado:** Cerca de 21,4 mil km² (21.387 km²): 37,9% da área do estado (56,5 mil km²) em seca grave, no Monitor de Secas de setembro de 2026, o último mês; sem área em seca extrema ou excepcional. Não pode mandar a pessoa buscar a área em outra fonte.

**Pergunta:** Quantos km² da Paraíba estão em seca grave agora?

14,3 s · 3 rodadas · 68,4 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT v.periodo, SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END) AS pct_grave_ou_pior, SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END) / 100.0 * t.area_km2 AS km2_grave_ou_pior, t.area_km2 FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND t.codigo = 'pb' AND v.periodo = (SELECT MAX(periodo) FROM valores WHERE indice = 'monito`
1. consultar_sql: `{"sql":"SELECT i.id, i.atualizado_em, i.ultimo_periodo FROM indices i WHERE i.id = 'monitor-de-seca-ana'"}`

> Cerca de **21.387 km²** da Paraíba estavam em seca grave ou pior no último mês disponível, setembro de 2026. Isso é 37,9% da área do estado (de 56.463,6 km²).
>
> Fonte: Monitor de Secas (ANA), setembro de 2026, Paraíba. Dado atualizado no SEDES em 19/10/2026. "Grave ou pior" soma as classes seca grave, extrema e excepcional. O cálculo usa a área do estado que o SEDES adota.

## Z06 — milímetros — certo

**Juiz:** ok. Traz dezembro de 2026, a média do município (64,4 mm no CPTEC e 36,2 mm no INMET) e a faixa de 10 a 100 mm das duas fontes. Diz que é previsão e que as fontes divergem. Os números da anomalia (+0,5 e -17,4) também batem com as ferramentas.

**Esperado:** Previsão para dezembro de 2026, média do município: cerca de 64 mm pelo CPTEC (64,4) e 36 mm pelo INMET (36,2); as duas na faixa de 10 a 100 mm. Diz que é previsão (estimativa) e que as fontes diferem. Só a faixa "10 a 100 mm", sem os milímetros, é parcial.

**Pergunta:** Quantos milímetros deve chover em Petrolina em dezembro?

9,5 s · 4 rodadas · 103,6 mil tokens de entrada

1. buscar_territorio: `{"nome":"Petrolina","uf":"PE"}`
1. consultar_sql: `{"sql":"SELECT m.indice, m.periodo, m.media, m.mediana, m.minimo, m.maximo FROM medias m WHERE m.territorio = '2611101' AND m.indice IN ('previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acumulado-inmet','previsao-anomalia-precipitacao-cptec-inpe','previsao-anomalia-precipitacao-mensal-inmet') AND m.periodo = '2026-12'"}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE territorio = '2611101' AND indice IN ('previsao-precipitacao-mensal-acumulado-cptec-2','previsao-precipitacao-mensal-acumulado-inmet') AND periodo = '2026-12' ORDER BY indice, classe"}`

> Para dezembro de 2026, a previsão indica cerca de **64 mm** em Petrolina (PE) pelo CPTEC/INPE e cerca de **36 mm** pelo INMET. As duas fontes ficam na faixa de 10 a 100 mm/mês, mas a diferença entre elas é grande.
>
> - **CPTEC/INPE**: média de 64,4 mm no município (mínimo 63,6 e máximo 73,4 nas áreas do município). Previsão atualizada em 15/10/2026.
> - **INMET**: média de 36,2 mm no município (mínimo 29,0 e máximo 47,0). Previsão atualizada em 16/10/2026.
> - **Anomalia (desvio em relação ao normal para a época)**: o CPTEC prevê cerca de +0,5 mm, e o INMET, cerca de -17,4 mm. Os dois são pequenos, mas têm sinais opostos, então as fontes discordam sobre se dezembro fica um pouco acima ou um pouco abaixo do normal.
>
> Previsão é estimativa, não certeza.

## Z07 — índice sem teste — certo

**Juiz:** Ok. Os números batem com as ferramentas: 50,5% → 34,5%, pico de 76,0% em 2017, mínimo de 4,8% em 2009, 12 altas e 12 quedas, e 1,4% → 5,9% nas faixas de 1,3 ou mais (1,365 em 2001; 5,857+0,074 em 2025). A conclusão de que não houve queda contínua concorda com a resposta esperada. Faltam as médias de 0,71 → 0,86 kg C/m², que nenhuma ferramenta trouxe. O "por ano" acrescentado à unidade é um detalhe menor.

**Esperado:** Não há queda. Produção Primária Bruta, 2001 a 2025: a média do município foi de 0,71 para 0,86 kg C/m², e a área na faixa mais baixa (< 0,7) foi de 50,5% para 34,5%, com muita oscilação de um ano para o outro (76,0% em 2017, 4,8% em 2009). Uma resposta só, sem repetir o texto.

**Pergunta:** A produtividade da vegetação em Juazeiro (BA) caiu nos últimos anos?

10,5 s · 4 rodadas · 103,6 mil tokens de entrada

1. buscar_territorio: `{"nome":"Juazeiro","uf":"BA"}`
1. consultar_sql: `{"sql":"SELECT periodo AS rotulo, SUM(CASE WHEN classe=1 THEN valor ELSE 0 END) AS valor_pct_abaixo_0_7 FROM valores WHERE indice='producao-primaria-bruta' AND territorio='2918407' GROUP BY periodo ORDER BY periodo","grafico":{"tipo":"serie","titulo":"Produção Primária Bruta: % da área com menos de 0,7 kg*C/m² (classe 1), Juazeiro (BA), 2001 a 2025","unidade":"% da área"}}`
1. consultar_sql: `{"sql":"SELECT v.periodo, v.classe, c.rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='producao-primaria-bruta' AND v.territorio='2918407' AND v.periodo IN ('2001','2010','2020','2025') ORDER BY v.periodo, v.classe"}`

> **Não há uma queda contínua.** A produtividade da vegetação em Juazeiro (BA) oscilou bastante entre 2001 e 2025, e a parcela da área com a menor produtividade caiu no período todo.
>
> - **Área na classe mais baixa** (menos de 0,7 kg de carbono por m² por ano): 50,5% em 2001 e 34,5% em 2025. O maior valor foi 76,0% em 2017 e o menor 4,8% em 2009.
> - **Áreas com produtividade mais alta** (1,3 kg de carbono/m² ou mais) eram 1,4% da área em 2001 e 5,9% em 2025.
> - **Ano a ano:** houve 12 altas e 12 quedas. Em 2025 a parcela da classe mais baixa subiu de 24,5% (2024) para 34,5%.
>
> Produção Primária Bruta, Juazeiro (BA), 2001 a 2025; dado anual atualizado no SEDES em 03/09/2026. O valor é a % da área do município em cada faixa de produtividade.

## Z08 — índice sem teste — certo

**Juiz:** ok: Cambissolo 99,0%, carbono 93,2% em 10-16 g/kg e 6,8% em 8-10 g/kg, com períodos e datas, tudo batendo com as ferramentas. Faltou só a média de 11,0 g/kg, que não está nas saídas das ferramentas. A frase "entre os mais altos do país" é uma afirmação comparativa sem base nas ferramentas, mas é menor.

**Esperado:** Cambissolo em 99,0% da área (Solos do Brasil, IBGE). Carbono orgânico do solo (Embrapa, 2020): 93,2% da área na faixa de 10 a 16 g/kg e 6,8% em 8 a 10 g/kg; média do município de 11,0 g/kg.

**Pergunta:** Que tipo de solo predomina em Irecê (BA) e como é o carbono no solo de lá?

7,1 s · 4 rodadas · 102,9 mil tokens de entrada

1. buscar_territorio: `{"nome":"Irecê","uf":"BA"}`
1. consultar_sql: `{"sql":"SELECT indice, rotulo_classe, valor FROM valores_com_nomes WHERE codigo_territorio_placeholder=1"}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE territorio='2914604' AND indice IN ('solos-do-brasil-ibge','carbono-organico-do-solo-embrapa') ORDER BY indice, valor DESC"}`

> Em Irecê (BA), **Cambissolo** é o tipo de solo que domina: cerca de **99,0% da área** do município, segundo o mapa de Solos do Brasil do IBGE (2025; dado atualizado no SEDES em 21/09/2026). As outras classes somam menos de 1%, e a maior parte disso é área urbana e massa d'água.
>
> O **carbono orgânico do solo** (Embrapa, 2020; atualizado em 14/08/2026) está nas faixas mais altas da escala:
>
> - **93,2% da área** tem entre **10 e 16 g/kg** de carbono.
> - **6,8% da área** tem entre **8 e 10 g/kg**.
> - Nenhuma parte do município fica abaixo de 8 g/kg.
>
> Na escala do índice, valores de 10 a 16 g/kg estão entre os mais altos do país. O dado é de 2020, então não mostra mudanças recentes.

## Z09 — índice sem teste — certo

**Juiz:** ok. A resposta trata "2024" como a diferença entre o acumulado de 2023 e o de 2024, em km² (aceito pela resposta esperada se a ordem for dita). Barra–BA 66,9 km² e Petrolina–PE 41,1 km² batem com as ferramentas, e o total de ~3.345 km² é coerente com os ~3,5 mil km² esperados. Faltou só a variação em pontos percentuais, o que é aceitável.

**Esperado:** O PRODES do SEDES é acumulado; "em 2024" é a diferença entre 2023 e 2024. Na Caatinga inteira, de 43,1% para 43,5% da área (+0,4 ponto, cerca de 3,5 mil km²). Municípios com maior aumento em pontos da área: Serra Redonda–PB (+2,6), Poço Dantas–PB (+2,3), Ribeira do Amparo–BA (+2,1); em área, Barra–BA (cerca de 67 km²) e Petrolina–PE (41 km²). Aceita uma das duas ordens, se disser qual. Responder com o acumulado até 2024 (Lagoa da Canoa 99,1%...) como se fosse o desmatamento de 2024 é errado; dar o acumulado dizendo com todas as letras que não é o de 2024 é parcial.

**Pergunta:** Onde houve mais desmatamento na Caatinga em 2024?

13,2 s · 3 rodadas · 70,7 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH d AS (SELECT t.codigo, t.nome, t.uf, t.area_km2, MAX(CASE WHEN v.periodo='2024' THEN v.valor END) AS a24, MAX(CASE WHEN v.periodo='2023' THEN v.valor END) AS a23 FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice='prodes-inpe' AND v.classe=1 AND v.periodo IN ('2023','2024') AND t.tipo='municipio' AND t.bioma LIKE '%Caatinga%' GROUP BY t.codigo) SELECT codigo, `
1. consultar_sql: `{"sql":"WITH d AS (SELECT t.codigo, t.nome, t.uf, t.area_km2, MAX(CASE WHEN v.periodo='2024' THEN v.valor END) AS a24, MAX(CASE WHEN v.periodo='2023' THEN v.valor END) AS a23 FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice='prodes-inpe' AND v.classe=1 AND v.periodo IN ('2023','2024') AND t.tipo='municipio' AND t.bioma LIKE '%Caatinga%' GROUP BY t.codigo) SELECT nome || `

> Em 2024, o maior desmatamento na Caatinga foi em **Barra (BA)**, com cerca de **66,9 km²** a mais de área desmatada em relação a 2023. Depois vêm Petrolina (PE), com 41,1 km², e Parnaguá (PI), com 39,8 km².
>
> O mapa mostra os 1.095 municípios do bioma. A soma deles foi de cerca de 3.345 km² em 2024, e a mediana foi de 1,3 km² por município. Outros 55 municípios não tiveram aumento.
>
> Fonte: PRODES/INPE, ano de 2024 comparado com 2023, pela classe "Desmatamento Acumulado". A atualização do índice no SEDES é de 24/10/2026. A conta é a diferença entre os dois anos, convertida em km² com a área de cada município.
>
> Ressalva: o SEDES classifica cada município por um bioma predominante. Assim, os números somam a área inteira do município, e não só a parte que é Caatinga.

## Z10 — índice sem teste — certo

**Juiz:** ok: os 5 estados e os valores de mortalidade 2020 e analfabetismo 2022 batem com as ferramentas. Informa os anos diferentes, que estados são médias simples dos municípios e a ressalva da unidade "%". A frase "a unidade correta não é confirmada" é aceitável.

**Esperado:** Mortalidade infantil de 2020: Roraima 25,0, Acre 17,0, Sergipe 15,5, Pará 15,3 e Piauí 15,3. Analfabetismo de 2022: Roraima 13,3%, Acre 16,6%, Sergipe 19,5%, Pará 12,2%, Piauí 23,1%. Diz que são médias simples dos municípios de cada estado, que os anos são diferentes, e repete a ressalva da unidade da mortalidade (o site mostra "%").

**Pergunta:** Quais os 5 estados com maior mortalidade infantil, e como eles estão em analfabetismo?

13,2 s · 3 rodadas · 70,4 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT m.periodo, m.nome_territorio AS estado, m.valor AS mortalidade_infantil, a.valor AS analfabetismo_pct FROM valores_com_nomes m LEFT JOIN valores_com_nomes a ON a.territorio = m.territorio AND a.periodo = m.periodo AND a.indice = 'taxa-de-analfabetismo' WHERE m.indice = 'mortalidade-infatil' AND m.tipo_territorio = 'estado' AND m.periodo IN ('2010','2020') ORDER BY m.periodo, m.valor`
1. consultar_sql: `{"sql":"SELECT periodo, nome_territorio, valor FROM valores_com_nomes WHERE indice = 'taxa-de-analfabetismo' AND tipo_territorio = 'estado' AND periodo IN ('2010','2022') ORDER BY periodo, valor DESC"}`

> Em 2020, o dado mais recente de mortalidade infantil, os 5 estados com maiores taxas são:
>
> | Estado  | Mortalidade infantil (2020) | Analfabetismo (2022) |
> | ------- | --------------------------- | -------------------- |
> | Roraima | 25,0                        | 13,3%                |
> | Acre    | 17,0                        | 16,6%                |
> | Sergipe | 15,5                        | 19,5%                |
> | Pará    | 15,3                        | 12,2%                |
> | Piauí   | 15,3                        | 23,1%                |
>
> Os dados de analfabetismo são de 2022, o ano mais recente, e não de 2020. A taxa de analfabetismo é a porcentagem de pessoas que não sabem ler e escrever um bilhete simples. O valor de mortalidade infantil aparece no site com a unidade "%", mas a unidade correta não é confirmada no catálogo. Os valores de estados são médias simples dos municípios.
>
> Fontes: Mortalidade Infantil (2020) e Taxa de Analfabetismo (2022), SEDES; ambos atualizados em 09/11/2026.

## Z13 — índice sem teste — certo

**Juiz:** ok. Os números batem com as ferramentas: campestre 69,3→50,2%, agrícola 24,3→38,8%, e também mosaico campestre, pastagem, silvicultura e floresta. A frase de que a maior parte da mudança ocorreu até 2014 é verdadeira (campestre 51,9% e agrícola 37,5% em 2014). A resposta traz índice, território, período e data de atualização.

**Esperado:** Cobertura da Terra (IBGE): a área agrícola foi de 24,3% para 38,8% da área do município, e a vegetação campestre caiu de 69,3% para 50,2%. O resto mudou pouco.

**Pergunta:** O que mudou no uso da terra em Barreiras (BA) entre 2000 e 2020?

12,5 s · 5 rodadas · 143,2 mil tokens de entrada

1. buscar_territorio: `{"nome":"Barreiras","uf":"BA"}`
1. detalhar_indice: `{"id":"cobertura-da-terra-ibge-s"}`
1. consultar_sql: `{"sql":"SELECT c.rotulo AS rotulo, v.periodo AS periodo, ROUND(v.valor,1) AS valor_pct, ROUND(v.valor/100*t.area_km2,0) AS km2 FROM valores v JOIN territorios t ON t.codigo=v.territorio JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe LEFT JOIN (SELECT 1) x ON 1=1 WHERE v.indice='cobertura-da-terra-ibge-s' AND v.territorio='2903201' AND v.periodo IN ('2000','2010','2014','2016','2018','202`
1. consultar_sql: `{"sql":"WITH a AS (SELECT c.rotulo AS rotulo, v.valor AS v2000 FROM valores v JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='cobertura-da-terra-ibge-s' AND v.territorio='2903201' AND v.periodo='2000'), b AS (SELECT c.rotulo AS rotulo, v.valor AS v2020 FROM valores v JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='cobertura-da-terra-ibge-s' AND v.t`

> Em Barreiras (BA), entre 2000 e 2020, a **vegetação campestre deu lugar à agricultura**. Os dados são do Cobertura da Terra (IBGE), atualizado no SEDES em 26/08/2026.
>
> - **Vegetação campestre:** caiu de 69,3% para 50,2% da área (−19,1 pontos percentuais, cerca de −1.541 km²).
> - **Área agrícola:** subiu de 24,3% para 38,8% (+14,5 pontos, cerca de +1.170 km²). É a maior mudança depois da queda da vegetação campestre.
> - **Mosaico de ocupações em área campestre:** de 1,4% para 4,1%.
> - **Pastagem com manejo:** de 0,1% para 1,3%.
> - **Silvicultura:** de 0,2% para 1,2%.
> - **Vegetação florestal:** quase estável, de 1,9% para 1,8%.
>
> A série completa tem os anos de 2000, 2010, 2014, 2016, 2018 e 2020. A maior parte da queda da vegetação campestre e do avanço agrícola aconteceu até 2014. Depois disso, as mudanças foram pequenas.

## Z16 — graus — certo

**Juiz:** ok: os números batem com as ferramentas (CPTEC 28,5 °C com 95,5% em 27–29° e 4,5% acima de 29°; INMET 29,6 °C com 100% acima de 29°). A resposta traz as duas fontes, o período, o território e as datas de atualização, e diz que é previsão. Não deixa explícito que é média do mês e não a máxima do dia, mas escreve "média mensal", o que basta.

**Esperado:** Previsão da temperatura média de dezembro de 2026, média do município: cerca de 28,5 °C pelo CPTEC e 29,6 °C pelo INMET. É previsão, e é a média do mês, não a máxima do dia.

**Pergunta:** Quantos graus deve fazer em Teresina em dezembro?

8,0 s · 4 rodadas · 102,9 mil tokens de entrada

1. buscar_territorio: `{"nome":"Teresina"}`
1. consultar_sql: `{"sql":"SELECT m.indice, m.periodo, m.media, m.mediana, m.minimo, m.maximo FROM medias m WHERE m.territorio = '2211001' AND m.periodo LIKE '2026-12%' AND m.indice LIKE 'previsao-temperatura%' ORDER BY m.indice"}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE territorio = '2211001' AND periodo = '2026-12' AND indice IN ('previsao-temperatura-mensal-media-cptec','previsao-temperatura-mensal-media-cptec-2') ORDER BY indice, classe"}`

> Para dezembro de 2026, a previsão é de **cerca de 28,5 °C** em Teresina (média mensal), segundo o CPTEC/INPE. É uma estimativa, não certeza.
>
> - **CPTEC/INPE** (atualizado em 15/10/2026): 95,5% da área do município fica entre 27 e 29 °C, e 4,5% acima de 29 °C. Média de 28,5 °C.
> - **INMET** (atualizado em 16/10/2026): 100% da área fica acima de 29 °C. Média de 29,6 °C.
>
> As duas fontes concordam que o mês será quente, mas o INMET prevê temperatura um pouco mais alta.

## Z17 — índice sem teste — certo

**Juiz:** ok. Os números batem com as ferramentas (rural 82,6→59,8; urbano 78,6→53,9), diz que é maior no campo em todos os anos, que as duas caíram, que são médias simples dos municípios e informa a data. Falta só a diferença em pontos (4,0→5,9), mas isso é detalhe a mais e não prejudica a resposta. Os valores de 2022→2023 também estão corretos.

**Esperado:** No campo, em todos os anos. Em 2025: 59,8% das famílias rurais do CadÚnico e 53,9% das urbanas; em 2012: 82,6% e 78,6%. As duas caíram, e a diferença passou de 4,0 para 5,9 pontos. Média simples dos municípios.

**Pergunta:** Na Bahia, a pobreza é maior no campo ou na cidade? Isso mudou desde 2012?

9,2 s · 3 rodadas · 68,8 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT periodo, MAX(CASE WHEN indice='percentual-de-pobreza-rural-cadunico' THEN valor END) AS rural, MAX(CASE WHEN indice='percentual-de-pobreza-urbano-cadunico' THEN valor END) AS urbano FROM valores WHERE indice IN ('percentual-de-pobreza-rural-cadunico','percentual-de-pobreza-urbano-cadunico') AND territorio='ba' GROUP BY periodo ORDER BY periodo"}`
1. consultar_sql: `{"sql":"SELECT indice, periodo, valor FROM valores WHERE indice IN ('percentual-de-pobreza-rural-cadunico','percentual-de-pobreza-urbano-cadunico') AND territorio='ba' AND periodo IN ('2012','2025') ORDER BY indice, periodo"}`

> Na Bahia, a pobreza é maior no campo do que na cidade, e isso vale em todos os anos de 2012 a 2025.
>
> - **2012:** rural 82,6%, urbano 78,6%.
> - **2025:** rural 59,8%, urbano 53,9%.
>
> Os dois caíram no período. A queda foi mais forte entre 2022 e 2023: o rural passou de 72,2% para 63,2%, e o urbano, de 65,9% para 56,9%. Depois disso, a queda seguiu mais devagar até 2025.
>
> Os valores são o percentual de famílias inscritas no CadÚnico em situação de pobreza (não da população toda). Para a Bahia, são médias simples dos municípios. Fonte: Percentual de pobreza rural e urbano – CadÚnico, dados de 2012 a 2025, atualizados no SEDES em 06/10/2026.

## Z18 — filtro composto — certo

**Juiz:** Ok: conclui que nenhum município do Semiárido teve seca grave ou pior nos seis meses de abril a setembro de 2026, e os números (93, 155 e 415 municípios; 463 de 1.477 com pobreza acima de 60%) batem com as ferramentas. Diz o índice, o período e a data de atualização. "Em maio, junho e julho nenhum município aparece" está correto como leitura das linhas retornadas. Só falta oferecer um critério mais frouxo, o que é um detalhe menor.

**Esperado:** Nenhum: nenhum município do Semiárido teve área em seca grave ou pior em todos os seis meses de abril a setembro de 2026 (os últimos do Monitor de Secas). Diz os meses e oferece um critério mais frouxo. Sem "vou verificar" no meio da resposta.

**Pergunta:** Quais municípios do Semiárido estão em seca grave ou pior há 6 meses seguidos e têm pobreza acima de 60%?

17,9 s · 4 rodadas · 106,6 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH seca AS (SELECT territorio, periodo, SUM(valor) AS graves FROM valores WHERE indice='monitor-de-seca-ana' AND periodo BETWEEN '2026-04' AND '2026-09' AND classe>=4 GROUP BY territorio, periodo HAVING SUM(valor)>0), meses AS (SELECT territorio, COUNT(*) AS n_meses, ROUND(MIN(graves),1) AS menor_area_grave FROM seca GROUP BY territorio HAVING COUNT(*)=6), pob AS (SELECT territorio, valo`
1. consultar_sql: `{"sql":"WITH seca AS (SELECT territorio, periodo, SUM(valor) AS graves FROM valores WHERE indice='monitor-de-seca-ana' AND periodo BETWEEN '2026-04' AND '2026-09' AND classe>=4 GROUP BY territorio, periodo HAVING SUM(valor)>0), meses AS (SELECT territorio, COUNT(*) AS n_meses FROM seca GROUP BY territorio HAVING COUNT(*)=6) SELECT (SELECT COUNT(*) FROM meses m JOIN territorios t ON t.codigo=m.terr`
1. consultar_sql: `{"sql":"SELECT periodo, COUNT(DISTINCT v.territorio) AS municipios_com_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo BETWEEN '2026-04' AND '2026-09' AND v.classe>=4 AND v.valor>0 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY v.periodo ORDER BY v.periodo"}`

> **Nenhum município do Semiárido** ficou em seca grave ou pior por 6 meses seguidos até setembro de 2026, então a lista com pobreza acima de 60% sai vazia.
>
> - **Seca:** Monitor de Secas (ANA), abril a setembro de 2026, atualizado em 19/10/2026. Usei qualquer área do município em seca grave, extrema ou excepcional. Em abril havia 93 municípios com essa seca, em agosto 155 e em setembro 415. Em maio, junho e julho nenhum município aparece com esse nível, então nenhum teve seis meses seguidos.
> - **Pobreza:** percentual de pobreza total do CadÚnico, em 2025 (atualizado em 06/10/2026). São as famílias inscritas no CadÚnico em situação de pobreza, não a população toda. 463 dos 1.477 municípios do Semiárido têm mais de 60%.

## Z19 — mapa — certo

**Juiz:** ok. A consulta pediu o mapa, com 223 municípios. A resposta traz 143 sem seca grave, 80 com alguma área e 50 com 100%, citando Água Branca, Amparo e Areia de Baraúnas. Setembro de 2026 e a atualização de 19/10/2026 estão certos. Os 29,2% aparecem como média simples dos municípios, não como valor do estado. A menção a "Sertão e Cariri" vem de conhecimento próprio, mas é um detalhe menor.

**Esperado:** consultar_sql com grafico tipo mapa, uma linha por município da Paraíba (223). Monitor de Secas, setembro de 2026, seca grave ou pior: 50 municípios com 100% da área, 143 sem nenhuma área; cita alguns nomes dos que têm 100%. A média dos municípios (29,2%) não é o valor do estado (37,9%): chamar 29,2% de "média estadual" ou valor do estado é parcial.

**Pergunta:** Mostre no mapa onde a seca grave está concentrada na Paraíba agora.

10,8 s · 3 rodadas · 69,3 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT t.codigo AS codigo, t.nome AS nome, ROUND(SUM(v.valor), 1) AS valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = (SELECT MAX(periodo) FROM valores WHERE indice = 'monitor-de-seca-ana') AND t.tipo = 'municipio' AND t.uf = 'PB' AND v.classe >= 4 GROUP BY t.codigo, t.nome ORDER BY valor DESC","grafico":{"tipo":"mapa`
1. consultar_sql: `{"sql":"SELECT MAX(periodo) AS ultimo_periodo, (SELECT ultima_atualizacao FROM (SELECT atualizado_em AS ultima_atualizacao FROM indices WHERE id = 'monitor-de-seca-ana')) AS atualizado_em FROM valores WHERE indice = 'monitor-de-seca-ana'"}`

> No mapa, a seca grave ou pior (classes grave, extrema e excepcional) está concentrada em um grupo de municípios do Sertão e do Cariri, enquanto a maior parte do estado não tem esse tipo de seca.
>
> - **Dados:** Monitor de Secas da ANA, setembro de 2026, atualizado no SEDES em 19/10/2026. O último mês disponível é setembro, não novembro.
> - **Números:** dos 223 municípios da Paraíba, 80 têm alguma área em seca grave ou pior e 143 não têm nenhuma. Outros 50 estão com 100% da área nessa condição, como Água Branca, Amparo e Areia de Baraúnas. A média simples entre os 223 municípios é de 29,2% da área.

## Z20 — km² — certo

**Juiz:** ok. Os números batem com as ferramentas: 374.828 km² (43,5%) em 2024 e 333.862 km² (38,7%) em 2010. A diferença de 40.966 km² está correta (374.828 − 333.862), e a resposta traz índice, território, período e data de atualização.

**Esperado:** PRODES, acumulado até 2024: 43,5% da Caatinga, cerca de 375 mil km² (374.828). Em 2010 eram 38,7%, cerca de 334 mil km²: de 2010 a 2024 foram cerca de 41 mil km² (4,8 pontos).

**Pergunta:** Quantos km² da Caatinga já foram desmatados, e quanto disso foi depois de 2010?

8,4 s · 3 rodadas · 69,1 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT v.periodo AS rotulo, ROUND(v.valor/100.0*t.area_km2, 0) AS valor, v.valor AS pct_area FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'prodes-inpe' AND v.classe = 1 AND v.territorio = '3_bioma-caatinga' ORDER BY v.periodo","grafico":{"tipo":"serie","titulo":"Desmatamento acumulado (PRODES) no bioma Caatinga, km²","unidade":"km²"}}`
1. consultar_sql: `{"sql":"SELECT t.codigo, t.nome, t.area_km2 FROM territorios t WHERE t.codigo = '3_bioma-caatinga'"}`

> Até 2024, cerca de **374.828 km²** da Caatinga já estavam desmatados, o equivalente a 43,5% do bioma (área de 862.466 km²). Desse total, **40.966 km²** foram desmatados depois de 2010, já que até 2010 o acumulado era de 333.862 km² (38,7%).
>
> Fonte: PRODES/INPE, classe "Desmatamento Acumulado" (tudo o que já foi desmatado até cada ano), bioma Caatinga, dado de 2024, atualizado no SEDES em 24/10/2026.

## Z21 — continuação: há quanto tempo — certo

**Juiz:** ok. Os 25 meses seguidos com 100% da área em seca (set/2024 a set/2026) batem com a série. Moderada ou pior (12 meses, abr/2025 a mar/2026) e grave ou pior (jun/2025 a mar/2026) também batem. A resposta esperada diz que grave ou pior começa em agosto de 2025, mas a ferramenta mostra 100% já em junho de 2025 e 93,5% em maio, então o assistente está certo.

**Esperado:** Sousa está em seca (alguma área em seca fraca ou pior) há 25 meses seguidos, de setembro de 2024 a setembro de 2026, sempre com 100% da área. Em seca grave ou pior ficou de agosto de 2025 a março de 2026; desde abril de 2026 não tem área nessa condição. Entende que "assim" é a situação de seca da resposta anterior e usa a série inteira.

**Pergunta:** Como está a seca em Sousa (PB) agora?

8,4 s · 4 rodadas · 137,1 mil tokens de entrada

1. buscar_territorio: `{"nome":"Sousa","uf":"PB"}`
1. consultar_sql: `{"sql":"SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND codigo_territorio='2516201' AND periodo >= '2026-01' ORDER BY periodo, classe","grafico":{"tipo":"serie","titulo":"Monitor de Secas, Sousa-PB, 2026 (% da área por classe)","unidade":"% da área"}}`
1. consultar_sql: `{"sql":"SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='2516201' AND periodo >= '2026-01' ORDER BY periodo, classe"}`

> Em setembro de 2026, o último mês disponível no Monitor de Secas, **100% da área de Sousa (PB) estava em seca moderada**. Em setembro, a seca estava em um nível mais brando que em janeiro, quando 100% da área estava em seca extrema.
>
> Desde janeiro de 2026, nenhum mês teve área sem seca. A área passou por seca extrema (janeiro), grave (fevereiro e março), moderada e fraca (abril), fraca (maio a agosto) e moderada de novo em setembro.
>
> Fonte: Monitor de Secas (ANA), setembro de 2026, Sousa–PB. Dado atualizado no SEDES em 19/10/2026. Os valores são % da área do município em cada classe.

**Pergunta:** Há quanto tempo está assim?

8,5 s · 3 rodadas · 74,4 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT periodo AS rotulo, 100 - MAX(CASE WHEN classe = 1 THEN valor END) AS valor FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='2516201' GROUP BY periodo ORDER BY periodo","grafico":{"tipo":"serie","titulo":"Monitor de Secas, Sousa-PB: % da área em qualquer seca (fraca ou pior), 2024 a 2026","unidade":"% da área"}}`
1. consultar_sql: `{"sql":"SELECT periodo, SUM(CASE WHEN classe >= 3 THEN valor ELSE 0 END) AS moderada_ou_pior, SUM(CASE WHEN classe >= 4 THEN valor ELSE 0 END) AS grave_ou_pior, MAX(CASE WHEN classe = 1 THEN valor END) AS sem_seca FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='2516201' GROUP BY periodo ORDER BY periodo"}`

> Sousa está em alguma seca (fraca ou pior) **desde setembro de 2024**, sem nenhum mês completo sem seca. Até setembro de 2026 são **25 meses seguidos** com 100% da área em seca. Em agosto de 2024, 24,6% da área já estava em seca.
>
> Se "assim" for seca moderada ou pior, a sequência atual é mais curta: 100% da área ficou em moderada ou pior de abril de 2025 a março de 2026 (12 meses), com uma interrupção em abril de 2026 (30,4%) e maio a agosto de 2026 sem seca moderada. Em setembro de 2026 voltou a 100%. Em seca grave ou pior, a série mostra 100% da área de junho de 2025 a março de 2026 (10 meses).
>
> Fonte: Monitor de Secas (ANA), janeiro de 2024 a setembro de 2026, Sousa–PB. Dado atualizado no SEDES em 19/10/2026. A série do Monitor começa em 2024.

## Z22 — robustez da priorização — certo

**Juiz:** ok: cita Assunção, Juazeirinho e Tenório (3 em 6 variações), os 73 em parte das variações, as variações testadas (padrão, dobro de cada critério, otimista) e que não são todas as combinações. Os números batem com a ferramenta (23 na configuração padrão, 13 de fora), com a ressalva de que a Priorização usa dados da planilha, não do tabelão.

**Esperado:** priorizar_municipios com robustez. Em 6 variações (a padrão, cada um dos 4 critérios com o dobro do peso e o cenário otimista), só 3 ficam em prioridade muito alta em todas: Assunção, Juazeirinho e Tenório. Outros 73 entram em parte delas. Diz o que foi variado e que não são todas as combinações possíveis.

**Pergunta:** Quais municípios da Paraíba ficam em prioridade muito alta com qualquer peso ou cenário?

7,1 s · 2 rodadas · 69,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"robustez":true,"listar":["Muito alta"]}`

> Três municípios da Paraíba ficaram em prioridade muito alta em todas as variações testadas: **Assunção**, **Juazeirinho** e **Tenório**.
>
> Testei 6 variações da mesma análise: a configuração padrão (critérios com peso igual, cenário pessimista), cada um dos 4 critérios com o dobro do peso e o cenário otimista. Não testei todas as combinações possíveis de pesos, então "qualquer peso" quer dizer "nas variações testadas". Os critérios foram Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com os limiares padrão do site, e cada estado foi comparado separadamente. A Priorização usa dados da planilha do site, não do tabelão, e é relativa à Paraíba: "muito alta" significa pior situação que a maioria dos municípios do estado nesses critérios.
>
> Na configuração padrão, 23 municípios paraibanos ficaram em prioridade muito alta. Outros 73 aparecem nesse nível em pelo menos uma variação, mas não em todas, então estão na fronteira. 13 municípios ficaram de fora por falta de dado, entre eles João Pessoa e Cabedelo.

## Z23 — perfil dos níveis — certo

**Juiz:** Ok: os números batem com o perfil da ferramenta (seca 25 vs 17,1; aridez 0,265; área degradada 21,7 vs 10,2; pobreza 77,4 igual). Diz que a pobreza não diferencia os níveis e que é descrição de grupo, não causa. Informa a configuração e os 13 municípios excluídos.

**Esperado:** Pelo Perfil dos níveis da Priorização padrão da Paraíba (23 municípios em muito alta): Índice de Seca bem maior (mediana 25 contra 17,1 no nível alta e 10,4 no média), mais aridez (índice 0,265, o menor dos níveis) e mais área degradada (21,7). A Pobreza Rural quase não muda entre os níveis (77,4 em muito alta e em alta). É descrição dos grupos, não causa. Errado: dizer que a pobreza é o que distingue.

**Pergunta:** O que os municípios de prioridade muito alta da Paraíba têm em comum?

7,1 s · 2 rodadas · 69 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta"]}`

> Nos 23 municípios de prioridade muito alta da Paraíba, o que mais se destaca é a **seca e a degradação da terra**. Eles estão entre os mais secos e os mais degradados do estado, na comparação entre municípios paraibanos (Priorização do SEDES, configuração padrão do site, com pesos iguais, cenário pessimista):
>
> - **Índice de Seca:** mediana de 25%, contra 17,1% no nível alta. É o maior contraste entre os níveis.
> - **Índice de Aridez:** mediana de 0,265, contra 0,328 no nível alta. Quanto menor o valor, mais seco o ambiente.
> - **Área Degradada:** mediana de 21,7 km², contra 10,2 km² no nível alta.
> - **Pobreza Rural:** mediana de 77,4, igual à do nível alta. Este critério não diferencia os dois níveis.
>
> Esses valores são de grupo, não causas. O nível é relativo aos municípios da Paraíba. Ficaram de fora 13 municípios por falta de dado no Índice de Seca, entre eles João Pessoa e Cabedelo.
>
> Municípios de prioridade muito alta (ordem alfabética, sem ranking interno):
> Areial, Assunção, Baraúna, Camalaú, Caraúbas, Congo, Coxixola, Cubati, Curral de Cima, Ingá, Juazeirinho, Junco do Seridó, Lagoa de Dentro, Montadas, Parari, Pilar, Riacho de Santo Antônio, Salgadinho, Santo André, São Vicente do Seridó, Serra Branca, Sobrado e Tenório.

## Z24 — mapa da priorização — certo

**Juiz:** ok: traz 184 classificados, a distribuição 27/63/62/23/9, a configuração (4 critérios, pesos de 25%, pessimista, comparação por estado) e diz que o mapa aparece na página. Os números do perfil batem com a ferramenta (0,339 vs 0,734; 16,5 vs 3,33; 12,3 vs 0). A frase "pobreza rural parecida entre os níveis" é coerente com 73,2 vs 64,3.

**Esperado:** Priorização padrão do Ceará (4 critérios, pesos iguais, cenário pessimista): 27 municípios em muito alta, 63 em alta, 62 em média, 23 em baixa e 9 em muito baixa; 184 classificados. A página desenha o mapa dos níveis sozinha a partir de priorizar_municipios: não precisa de outra consulta nem de consultar_sql com mapa.

**Pergunta:** Faça a priorização padrão do Ceará e mostre no mapa.

9,7 s · 2 rodadas · 68,8 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"}}`

> A Priorização padrão do Ceará classificou os 184 municípios do estado, sem nenhum fora por falta de dado. O mapa com os cinco níveis aparece na página.
>
> Configuração: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, todos com peso igual (25%). Cada estado foi comparado só consigo mesmo (padrão do site), no cenário pessimista. Os valores vêm da planilha da Priorização, não do tabelão.
>
> Distribuição: 27 municípios em prioridade muito alta, 63 em alta, 62 em média, 23 em baixa e 9 em muito baixa.
>
> Os municípios de prioridade muito alta têm menos Índice de Aridez (mediana de 0,339, contra 0,734 na muito baixa), mais Índice de Seca (16,5% contra 3,33%) e mais Área Degradada (12,3 km² contra 0 km²). A pobreza rural é parecida entre os níveis, com diferença menor.
>
> Entre os 27 de prioridade muito alta estão Aiuaba, Antonina do Norte, Assaré, Baixio, Banabuiú, Brejo Santo, Campos Sales, Icó, Iguatu e Independência, além de outros 17.
