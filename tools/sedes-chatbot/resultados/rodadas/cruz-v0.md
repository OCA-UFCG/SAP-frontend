# Rodada cruz-v0

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T13:28.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 8 (9)                          |
| Notas do juiz                           | 6 certo · 2 parcial · 0 errado |
| Com número esperado faltando            | 1                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 15,3 · 17,0 · 21,9 s           |
| Rodadas do modelo por turno             | 4,1                            |
| Ferramentas por turno                   | 3,1                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 93,4 mil                       |
| Tokens de saída por turno               | 2674                           |
| Custo somado (preço de API)             | US$ 0.05                       |

| Id  | Categoria                   | Nota         | Tempo (s)  | Rodadas | Ferramentas |
| --- | --------------------------- | ------------ | ---------- | ------- | ----------- |
| W01 | priorização e monitoramento | parcial (nº) | 16,3       | 4       | 3           |
| W02 | priorização e monitoramento | certo        | 17,5       | 5       | 4           |
| W03 | priorização e monitoramento | certo        | 21,9       | 4       | 3           |
| W04 | priorização e monitoramento | certo        | 8,7        | 4       | 3           |
| W05 | priorização e monitoramento | certo        | 6,1 + 12,4 | 2 + 3   | 1 + 2       |
| W06 | priorização e monitoramento | certo        | 17,0       | 4       | 3           |
| W07 | priorização e monitoramento | parcial      | 20,9       | 7       | 6           |
| W08 | priorização e monitoramento | certo        | 17,3       | 4       | 3           |

## W01 — priorização e monitoramento — parcial

**Juiz:** Os dados estão certos: 11 municípios com 100%, Tenório com 76,9%, Juazeirinho com 75,7% e 10 sem seca grave. Também avisa que a Priorização e o Monitor vêm de fontes diferentes. Mas a resposta nunca diz o total pedido, 13 dos 23, e destaca "11 dos 23" no início, o que dá a impressão de que só 11 estão em seca grave ou pior.

**Números faltando:** 13

**Esperado:** Priorização padrão da Paraíba: 23 municípios de prioridade muito alta. No Monitor de Secas de setembro de 2026, 13 deles têm área em seca grave ou pior: 11 com 100% da área (Assunção, Camalaú, Caraúbas, Congo, Coxixola, Junco do Seridó, Parari, Riacho de Santo Antônio, Salgadinho, Santo André, Serra Branca), Tenório (76,9%) e Juazeirinho (75,7%). Os outros 10 não têm seca grave. Diz que a Priorização usa a planilha dela e o Monitor vem do tabelão.

**Pergunta:** Dos municípios da Paraíba com prioridade muito alta na Priorização, quantos estão em seca grave ou pior no Monitor de Secas?

16,3 s · 4 rodadas · 90,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT t.nome AS municipio, SUM(v.valor) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe>=4 AND t.tipo='municipio' AND t.uf='PB' AND t.nome IN ('Areial','Assunção','Baraúna','Camalaú','Caraúbas','Congo','Coxixola','Cubati','Curral de Cima','Ingá','Juazeirinho','Junco do Seridó','Lagoa`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pb"}`

> **11 dos 23 municípios** de prioridade muito alta na Priorização da Paraíba estão com **100% da área em seca grave ou pior** no Monitor de Secas (setembro de 2026).
>
> - **100%:** Assunção, Camalaú, Caraúbas, Congo, Coxixola, Junco do Seridó, Parari, Riacho de Santo Antônio, Salgadinho, Santo André e Serra Branca.
> - **Parcial:** Tenório (76,9%) e Juazeirinho (75,7%).
> - **Sem seca grave ou pior:** os outros 10 (Areial, Baraúna, Cubati, Curral de Cima, Ingá, Lagoa de Dentro, Montadas, Pilar, São Vicente do Seridó e Sobrado).
>
> Seca grave ou pior são as classes 4 a 6 do índice. O dado é do Monitor de Secas (ANA), de setembro de 2026, atualizado no SEDES em 19/10/2026.
>
> A Priorização usou os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com pesos iguais), comparando os municípios dentro da Paraíba. Ela usa uma planilha própria, e o critério de seca dela é "Seca Registrada" nos últimos 6 meses, não o Monitor de Secas. Por isso, a comparação acima cruza duas fontes diferentes.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=pb&period=2026&layers=monitor-de-seca-ana)

## W07 — priorização e monitoramento — parcial

**Juiz:** Os números citados batem com as ferramentas: 24 municípios com 100%, 3 entre 73% e 80%, e só Penaforte com seca grave (23,2%). Mas "a maioria em seca fraca" não tem base nas consultas, que só separaram "qualquer seca" de "grave ou pior". Faltou dizer que Penaforte e Salitre têm 100% da área em seca moderada ou pior, e que 6 municípios têm alguma área em seca moderada.

**Esperado:** Sim, mas quase toda seca fraca: no Monitor de Secas de setembro de 2026, os 27 de prioridade muito alta da Priorização padrão do Ceará têm, em média, 97,4% da área em seca fraca ou pior; só 6 têm alguma área em seca moderada ou pior (Penaforte e Salitre com 100%) e só Penaforte tem seca grave (23,2%). Não diz que estão em seca forte.

**Pergunta:** Os municípios do Ceará com prioridade muito alta estão em seca agora?

20,9 s · 7 rodadas · 156,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT t.nome || '–' || t.uf AS municipio, ROUND(SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END),1) AS seca_qualquer, ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END),1) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' AND t.tipo = 'municipio' AND t.uf = 'CE' AND lower(t.nome_s`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","priorizacao"],"territorio":"ce"}`
1. consultar_sql: `{"sql":"SELECT t.nome || '–' || t.uf AS municipio, ROUND(SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END),1) AS seca_qualquer, ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END),1) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' AND t.tipo = 'municipio' AND t.uf = 'CE' AND lower(t.nome_s`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"ce"}`
1. consultar_sql: `{"sql":"SELECT t.nome || '–' || t.uf AS municipio, ROUND(SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END),1) AS seca_qualquer, ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END),1) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' AND t.tipo = 'municipio' AND t.uf = 'CE' AND lower(t.nome_s`

> **Sim, quase todos estão em seca, mas a maioria em seca fraca.** Dos 27 municípios de prioridade muito alta no Ceará, 24 têm 100% da área em algum nível de seca, e 3 têm entre 73% e 80%. Só Penaforte está em seca grave ou pior, com 23,2% da área.
>
> Os dados são do Monitor de Secas da ANA, de setembro de 2026, que é o último mês disponível no SEDES. O dado foi atualizado em 19/10/2026, então não reflete novembro.
>
> A lista de prioridade veio da Priorização, com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural), pesos iguais e comparação dentro de cada estado. Esses critérios vêm da planilha da Priorização, não do tabelão, e a seca usada nela é a dos últimos seis meses, por isso os números podem não bater exatamente com o Monitor de setembro.

## W02 — priorização e monitoramento — certo

**Juiz:** ok. Prioridade muito alta, comparada com os 210 municípios da PB e com a configuração padrão. A série do Monitor de Secas de 2026 bate com a consulta e com a esperada: extrema em jan e fev, grave em mar, moderada de abr a ago, grave em set. Cita a data de atualização (19/10/2026) e o último mês disponível. Os percentuais "situação melhor" são a leitura correta de "situação pior que".

**Esperado:** Prioridade muito alta na Priorização padrão da Paraíba. No Monitor de Secas de 2026: seca extrema em 100% da área em janeiro e fevereiro, seca grave em março, seca moderada em 100% de abril a agosto, e seca grave de novo em 100% em setembro (o último mês disponível).

**Pergunta:** Assunção-PB está em que nível de prioridade? E como está a seca lá no Monitor de Secas este ano?

17,5 s · 5 rodadas · 92 mil tokens de entrada

1. buscar_territorio: `{"nome":"Assunção","uf":"PB"}`
1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["Assunção-PB"],"listar":[]}`
1. consultar_sql: `{"sql":"SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='2501351' AND periodo BETWEEN '2026-01' AND '2026-12' ORDER BY periodo, classe"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"2501351"}`

> **Prioridade:** Assunção–PB está em **prioridade muito alta**. A comparação foi feita com os 210 municípios da Paraíba, com os critérios padrão do site e pesos iguais. Ela está em situação pior que a maioria deles em quatro critérios:
>
> - Índice de Seca: 98,6% dos municípios estão em situação melhor.
> - Índice de Aridez: 97,6% estão em situação melhor.
> - Pobreza Rural: 82,9% estão em situação melhor.
> - Área Degradada: 58,6% estão em situação melhor.
>
> Os dados da Priorização vêm da planilha da própria Priorização, não do tabelão. A Priorização não é um índice de medição: o nível é relativo ao grupo.
>
> **Monitor de Secas em 2026** (Assunção–PB, dado atualizado no SEDES em 19/10/2026; o último mês disponível é setembro):
>
> - **Janeiro e fevereiro:** 100% da área em seca extrema.
> - **Março:** 100% da área em seca grave.
> - **Abril a agosto:** 100% da área em seca moderada.
> - **Setembro:** 100% da área em seca grave.
>
> Em 2026, a seca começou extrema e melhorou para moderada de abril a agosto. Em setembro voltou a grave. Não há dados de outubro e novembro no SEDES ainda.

## W03 — priorização e monitoramento — certo

**Juiz:** ok. Os números batem com as ferramentas: 29 dos 34 têm 100% da área em seca grave ou pior, e os outros cinco têm Araripina 60,9%, Calçado 94,4%, Frei Miguelinho 37,1%, Santa Maria do Cambucá 29,4% e Cumaru 0%. Dá 33 de 34 com seca grave, o que bate com a resposta esperada (média 91,8%). Os 72 municípios com 100% também conferem. A resposta diz que é associação, não causa, e lembra o critério Índice de Seca da Priorização. Não compara os outros níveis, mas o essencial está certo.

**Esperado:** Sim, há associação. Média da % da área em seca grave ou pior em setembro de 2026, por nível da Priorização padrão: 91,8% (muito alta, 34 municípios), 76,8% (alta), 37,9% (média), 2,2% (baixa), 0% (muito baixa). Outra medida equivalente (ex.: quantos de cada nível têm seca grave: 33 de 34, 46 de 53, 22 de 44, 3 de 45, 0 de 6) também vale. Diz que é associação, não causa, e de preferência lembra que a Priorização padrão já tem um critério de seca (Índice de Seca).

**Pergunta:** Em Pernambuco, os municípios com prioridade mais alta na Priorização são também os que estão mais em seca no Monitor de Secas?

21,9 s · 4 rodadas · 100,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT t.codigo, t.nome, SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END) AS seca_grave_ou_pior, SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END) AS qualquer_seca FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' AND t.tipo = 'municipio' AND t.uf = 'PE' GROUP BY t.codigo, t.nome ORDER BY seca_grave_ou_pior `
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pe"}`

> Em parte. Quase todos os municípios de prioridade muito alta estão em seca grave ou pior, mas o contrário não vale: muitos municípios muito secos não entram nessa prioridade.
>
> - **Priorização (Pernambuco):** 34 municípios em prioridade muito alta. Critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Cada estado foi comparado separadamente. Ficaram de fora 3 municípios por falta de dado.
> - **Monitor de Secas, setembro de 2026** (dado atualizado no SEDES em 19/10/2026): dos 34, todos estão com algum grau de seca. Em 29 deles, 100% da área está em seca grave, extrema ou excepcional. Os outros 5 são Araripina (60,9%), Calçado (94,4%), Frei Miguelinho (37,1%), Santa Maria do Cambucá (29,4%) e Cumaru (0%; em Cumaru a seca é só fraca ou moderada).
> - **No sentido inverso:** 72 municípios pernambucanos têm 100% da área em seca grave ou pior. Só 29 deles estão na prioridade muito alta; os outros 43 ficam em prioridade alta, média ou baixa.
>
> Duas ressalvas. A Priorização não usa o Monitor de Secas: seu critério de seca é o "Índice de Seca", e a fonte e o período são diferentes. Por isso, a coincidência é uma associação, não uma medida direta. Além disso, o nível é relativo aos outros municípios de Pernambuco nesses critérios.
>
> Ver no SEDES: o botão abaixo mostra o Monitor de Secas em Pernambuco.

## W04 — priorização e monitoramento — certo

**Juiz:** ok. Equador com 33,7% da área em seca grave ou pior em setembro de 2026 e prioridade muito alta batem com as ferramentas e com a resposta esperada. A resposta traz índice, período, território, data de atualização e a configuração da Priorização. A explicação dos critérios (aridez e seca puxam para cima, área degradada para baixo) também confere com os percentuais.

**Esperado:** Só um: Equador, com 33,7% da área em seca grave ou pior em setembro de 2026, e prioridade muito alta na Priorização padrão do Rio Grande do Norte.

**Pergunta:** Quais municípios do Rio Grande do Norte estão com seca grave ou pior no Monitor de Secas, e qual a prioridade deles?

8,7 s · 4 rodadas · 89,5 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT t.nome AS municipio, v.periodo, ROUND(SUM(v.valor),1) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo=(SELECT MAX(periodo) FROM valores WHERE indice='monitor-de-seca-ana') AND v.classe>=4 AND t.tipo='municipio' AND t.uf='RN' GROUP BY t.codigo HAVING SUM(v.valor)>0 ORDER BY seca_grave_ou_pior DESC"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"rn"}`
1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"RN"},"municipios":["Equador-RN"]}`

> Só **Equador–RN** está com seca grave ou pior no Monitor de Secas. Em setembro de 2026, 33,7% da área do município estava nessas classes (seca grave, extrema ou excepcional). Os demais municípios do RN não aparecem nessa faixa.
>
> Pela Priorização do SEDES, Equador tem **prioridade muito alta** entre os 165 municípios do RN. Usei os critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Cada estado é comparado separadamente. O Índice de Seca e a aridez puxam a prioridade para cima; a área degradada, para baixo. Os dados da Priorização vêm da planilha dela, não do Monitor de Secas, por isso não se misturam com o número de 33,7%.
>
> Monitor de Secas, setembro de 2026 (último período disponível; dado atualizado no SEDES em 19/10/2026). Equador–RN.

## W05 — priorização e monitoramento — certo

**Juiz:** ok: respondeu 54 dos 84 municípios em seca grave ou pior em setembro de 2026, batendo com a ferramenta e com a resposta esperada. Disse o período, o índice, a data de atualização e a ressalva de que 54 conta qualquer área acima de zero. Não citou os 42 com 100% da área, mas isso é detalhe extra.

**Esperado:** Primeira resposta: Priorização padrão da Bahia, 84 municípios de prioridade muito alta (416 classificados). Segunda: dos 84, 54 têm área em seca grave ou pior no Monitor de Secas de setembro de 2026 (42 deles com 100% da área); os outros 30 não têm. Diz que é setembro de 2026, o último mês do Monitor.

**Pergunta:** Quais municípios a Bahia deveria priorizar?

6,1 s · 2 rodadas · 59,2 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"},"listar":["Muito alta"]}`

> Com os critérios padrão do site, 84 dos 416 municípios da Bahia ficaram com prioridade **muito alta**. Os municípios estão ordenados por nível de prioridade, sem ordem dentro de cada nível.
>
> **Configuração:** Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com pesos iguais (25% cada). Cada estado foi comparado separadamente, no cenário pessimista e com os limiares padrão do site. Madre de Deus ficou de fora por falta de dado.
>
> **Distribuição:** muito alta 84, alta 120, média 104, baixa 77 e muito baixa 31.
>
> **Alguns dos municípios de prioridade muito alta:** Abaré, Andorinha, Araci, Barrocas, Caém, Caetanos, Caldeirão Grande, Campo Formoso, Candeal e Candiba. Há outros 74 na lista completa.
>
> Esses valores vêm da planilha da Priorização, não do tabelão de índices. Se quiser ver outro recorte, como a comparação de todos os municípios da Bahia numa lista única ou critérios diferentes, é só pedir.

**Pergunta:** E desses, quantos estão em seca grave ou pior no Monitor de Secas agora?

12,4 s · 3 rodadas · 64,7 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH p AS (SELECT MAX(periodo) AS per FROM valores WHERE indice='monitor-de-seca-ana'),\nm AS (SELECT codigo, nome FROM territorios WHERE tipo='municipio' AND uf='BA' AND nome IN ('Abaré','Andorinha','Araci','Barrocas','Caém','Caetanos','Caldeirão Grande','Campo Formoso','Candeal','Candiba','Cansanção','Canudos','Capela do Alto Alegre','Capim Grosso','Casa Nova','Central','Chorrochó','Cipó`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"ba"}`

> Em setembro de 2026, **54 dos 84 municípios** de prioridade muito alta tinham alguma área em seca grave ou pior (classes grave, extrema ou excepcional) no Monitor de Secas da ANA.
>
> A porcentagem da área nessas classes varia de 0,1% a 100%. O número de 54 conta qualquer área acima de zero, então não diz quanto de cada município está em seca.
>
> O período mais recente que o SEDES tem para esse índice é setembro de 2026, atualizado em 19/10/2026. Os 84 municípios vêm da Priorização; a seca vem do tabelão.

## W06 — priorização e monitoramento — certo

**Juiz:** ok: 59,7% (23 municípios) contra 57,7% (187), 2025, com ressalvas de que a Priorização usa Pobreza Rural, da planilha, e de que a pobreza é % das famílias do CadÚnico. Não cita o 57,9% do estado nem diz "média simples dos municípios", mas são detalhes menores que não mudam a conclusão.

**Esperado:** Quase a mesma: média de 59,7% das famílias do CadÚnico em pobreza (2025) nos 23 de prioridade muito alta, contra 57,7% nos outros 187 classificados (o estado tem 57,9%). Diz que é média simples dos municípios e que a Priorização usa outro dado (Pobreza Rural, da planilha da Priorização), não este índice do SEDES.

**Pergunta:** Os municípios de prioridade muito alta na Paraíba têm mais pobreza no CadÚnico do que os outros?

17,0 s · 4 rodadas · 94,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta","Alta","Média","Baixa","Muito baixa"]}`
1. consultar_sql: `{"sql":"WITH g AS (\n  SELECT t.codigo, t.nome,\n    CASE WHEN t.nome IN ('Areial','Assunção','Baraúna','Camalaú','Caraúbas','Congo','Coxixola','Cubati','Curral de Cima','Ingá','Juazeirinho','Junco do Seridó','Lagoa de Dentro','Montadas','Parari','Pilar','Riacho de Santo Antônio','Salgadinho','Santo André','São Vicente do Seridó','Serra Branca','Sobrado','Tenório') THEN 'Muito alta'\n         WHEN`
1. link_no_sedes: `{"indices":["percentual-de-pobreza-total-cadunico"],"territorio":"pb"}`

> Sim, mas a diferença é pequena. Em 2025, os 23 municípios de prioridade muito alta da Paraíba tinham em média **59,7%** das famílias do CadÚnico em situação de pobreza. Os outros 187 municípios classificados tinham média de **57,7%**.
>
> Os intervalos se sobrepõem: os de prioridade muito alta variam de 40,0% a 73,9%, e os demais, de 34,5% a 74,2%. Ou seja, há municípios muito pobres em todos os níveis.
>
> - **Priorização:** configuração padrão do site, com pesos iguais para Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. A comparação é feita dentro da Paraíba. Os dados vêm da planilha da Priorização, não do tabelão. Ficaram de fora 13 municípios sem dado (entre eles João Pessoa e Bayeux), que não entram na comparação.
> - **Pobreza:** Monitor de Pobreza Total do CadÚnico, 2025, Paraíba. É "% das famílias inscritas no CadÚnico", não da população toda. Os dados foram atualizados no SEDES em 06/10/2026.
>
> Como a Priorização usa a pobreza rural, e não a total, a associação entre os dois não é direta. Posso comparar também com a pobreza rural ou com outro índice, se quiser.

## W08 — priorização e monitoramento — certo

**Juiz:** ok. Os 50 municípios em setembro de 2026 batem com a consulta. Cruzei a lista com os níveis da Priorização e deu 11 muito alta, 29 alta e 10 média, igual à resposta esperada. A resposta também traz período, data e ressalvas corretas, e não lista os 50.

**Esperado:** 50 municípios em setembro de 2026. Na Priorização padrão da Paraíba: 11 de prioridade muito alta, 29 alta e 10 média. Não precisa listar os 50.

**Pergunta:** Quantos municípios da Paraíba estão com 100% da área em seca grave ou pior no Monitor de Secas, e em que nível de prioridade eles ficam?

17,3 s · 4 rodadas · 93,7 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT t.codigo, t.nome, t.uf, ROUND(SUM(v.valor),1) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe>=4 AND t.tipo='municipio' AND t.uf='PB' GROUP BY t.codigo HAVING SUM(v.valor)>=99.95 ORDER BY t.nome;"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pb"}`
1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta","Alta","Média","Baixa","Muito baixa"]}`

> Dos 223 municípios da Paraíba, **50 estavam com 100% da área em seca grave ou pior** no Monitor de Secas da ANA (setembro de 2026; dado atualizado no SEDES em 19/10/2026).
>
> Na Priorização, esses 50 municípios ficam assim:
>
> - **Prioridade muito alta: 11** (Assunção, Camalaú, Caraúbas, Congo, Coxixola, Junco do Seridó, Parari, Riacho de Santo Antônio, Salgadinho, Santo André e Serra Branca)
> - **Prioridade alta: 29**
> - **Prioridade média: 10**
> - Baixa e muito baixa: nenhum
>
> Todos os 50 foram classificados; nenhum ficou de fora por falta de dado.
>
> Ressalvas sobre a Priorização:
>
> - Usei os critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca (SPE), Área Degradada e Pobreza Rural. Cada estado foi comparado separadamente, no cenário pessimista. Se quiser outra combinação, posso refazer.
> - Ela não usa o Monitor de Secas diretamente. O "Índice de Seca" da Priorização vem de outra planilha, então o nível não reflete só a seca do Monitor.
> - O nível é relativo aos outros municípios paraibanos, não um valor absoluto.
