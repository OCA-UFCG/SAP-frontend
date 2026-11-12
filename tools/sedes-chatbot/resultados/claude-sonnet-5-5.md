# Avaliação: claude-sonnet-5-5

Gerado por avaliar.sh em 2026-11-12T17:24:55.297Z.

| Id | Categoria | Tempo (s) | Turnos | Ferramentas |
| --- | --- | --- | --- | --- |
| C01 | conceitual | 7.4 | 3 | listar_indices×1, detalhar_indice×1 |
| C02 | conceitual | 6.2 | 2 | consultar_sql×1 |
| C03 | conceitual | 7.2 | 2 | listar_indices×1 |
| C04 | conceitual | 9.1 | 2 | listar_indices×1 |
| P01 | valor pontual | 6.9 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P02 | valor pontual | 6.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P03 | valor pontual | 6.7 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P04 | valor pontual | 8.5 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P05 | valor pontual | 8.1 | 3 | listar_indices×1, consultar_sql×1 |
| P06 | valor pontual | 6.9 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| R01 | ranking | 8.1 | 3 | consultar_sql×2 |
| R02 | ranking | 10.5 | 5 | listar_indices×1, consultar_sql×3 |
| R03 | ranking | 8.9 | 3 | listar_indices×1, consultar_sql×1 |
| R04 | ranking | 10.1 | 4 | listar_indices×1, consultar_sql×2 |
| R05 | ranking | 7 | 3 | listar_indices×1, consultar_sql×1 |
| T01 | tendência | 8.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| T02 | tendência | 8.5 | 3 | listar_indices×1, consultar_sql×1 |
| T03 | tendência | 6.6 | 3 | listar_indices×1, consultar_sql×1 |
| T04 | tendência | 9 | 3 | listar_indices×1, consultar_sql×1 |
| T05 | tendência | 10.4 | 5 | buscar_territorio×1, listar_indices×1, consultar_sql×2 |
| X01 | cruzamento | 7.9 | 3 | listar_indices×1, consultar_sql×1 |
| X02 | cruzamento | 10.7 | 3 | listar_indices×1, consultar_sql×1 |
| X03 | cruzamento | 13.5 | 4 | listar_indices×1, consultar_sql×2 |
| A01 | recorte agregado | 7.1 | 3 | listar_indices×1, consultar_sql×1 |
| A02 | recorte agregado | 7.5 | 3 | listar_indices×1, consultar_sql×1 |
| A03 | recorte agregado | 7.1 | 3 | listar_indices×1, consultar_sql×1 |
| A04 | recorte agregado | 10.4 | 3 | listar_indices×1, consultar_sql×1 |
| H01 | homônimo | 6.1 | 2 | buscar_territorio×1 |
| H02 | homônimo | 5 | 3 | buscar_territorio×1, listar_indices×1 |
| H03 | homônimo | 9.8 | 5 | buscar_territorio×2, listar_indices×1, consultar_sql×1 |
| I01 | período inexistente | 6.9 | 3 | listar_indices×1, buscar_territorio×1 |
| I02 | período inexistente | 7 | 3 | buscar_territorio×1, consultar_sql×1 |
| I03 | período inexistente | 6.6 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| F01 | fora do escopo | 5.6 | 3 | listar_indices×1, buscar_territorio×1 |
| F02 | fora do escopo | 5.9 | 2 | listar_indices×1 |
| F03 | fora do escopo | 6.8 | 3 | listar_indices×1, buscar_territorio×1 |

## C01 — conceitual

**Pergunta:** O que é o CDI?

**Esperado:** Índice Combinado de Seca: descreve a seca como um processo em cascata (falta de chuva → falta de umidade no solo → estresse na vegetação). Valor = % da área em cada classe: Sem seca, Estágios 1 a 3, Recuperação total, Recuperação parcial da umidade e Recuperação parcial da vegetação. É decendial (a cada 10 dias), de 01/01/2001 a 21/09/2026.

**Tempo:** 7.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `detalhar_indice: {"id":"indice-combinado-de-seca-cdi"}`

**Resposta do bot:**

> O CDI (Índice Combinado de Seca) descreve a seca como um processo em cascata. Primeiro falta chuva. Depois, com algum atraso, falta umidade no solo. Por fim, a vegetação sofre um estresse que dá para medir.
> 
> **Como aparece no SEDES**
> - O valor é a **% da área do território** em cada classe. As classes de um território somam 100%.
> - É um índice **decendial**, ou seja, tem um valor a cada 10 dias (dias 1, 11 e 21 de cada mês).
> - A série vai de 01/01/2001 a 21/09/2026. O dado foi atualizado no SEDES em 19/10/2026.
> - Cada território (Brasil, estado, bioma, município e outros) tem valor próprio, calculado sobre a área dele. Não é média dos municípios.
> 
> **Classes**
> 1. Sem seca
> 2. Estágio 1
> 3. Estágio 2
> 4. Estágio 3
> 5. Recuperação total
> 6. Recuperação parcial da umidade
> 7. Recuperação parcial da vegetação
> 
> O catálogo não detalha o critério de cada estágio. Se quiser, posso consultar o CDI de algum município ou região.

## C02 — conceitual

**Pergunta:** Quais são as classes do Monitor de Secas da ANA?

**Esperado:** Seis classes, da menos à mais grave: Sem seca, Seca fraca, Seca moderada, Seca grave, Seca extrema, Seca excepcional. Valor = % da área em cada classe.

**Tempo:** 6.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `consultar_sql: SELECT c.ordem, c.rotulo, i.descricao, i.significado_valor, i.unidade, i.ultimo_periodo, i.atualizado_em, i.observacao FROM classes c JOIN indices i ON i.id=c.indice WHERE c.indice='monitor-de-seca-ana' ORDER BY c.ordem`

**Resposta do bot:**

> O Monitor de Secas da ANA tem 6 classes, da menos para a mais severa:
> 
> 1. Sem seca
> 2. Seca fraca
> 3. Seca moderada
> 4. Seca grave
> 5. Seca extrema
> 6. Seca excepcional
> 
> Para cada território e período, o valor de cada classe é a porcentagem da área do território naquela classe. As seis classes somam 100%.
> 
> O índice é mensal. O último período disponível é setembro de 2026, e o dado foi atualizado no SEDES em 19/10/2026.

## C03 — conceitual

**Pergunta:** O que mede o percentual de pobreza do CadÚnico no SEDES?

**Esperado:** % das famílias inscritas no CadÚnico em situação de pobreza (total, urbana e rural), anual de 2012 a 2025. Não é % da população. Estados, Brasil e recortes são média simples dos municípios.

**Tempo:** 7.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O índice **Percentual de pobreza total – CadÚnico** mede a **porcentagem das famílias inscritas no CadÚnico que estão em situação de pobreza**. O valor é um só por território e por ano.
> 
> - **Período:** de 2012 a 2025, com dados anuais. A fonte foi atualizada no SEDES em 06/10/2026.
> - **Municípios:** o número é o percentual das famílias do CadÚnico daquele município que estão em situação de pobreza.
> - **Estados, Brasil, regiões e outros recortes:** o valor é a **média simples dos municípios**. Ela não é ponderada pela população. Municípios pequenos pesam o mesmo que os grandes.
> - **Limite do indicador:** ele cobre só as famílias inscritas no CadÚnico. Não mede a pobreza da população inteira.
> 
> O SEDES também tem duas versões separadas, a **rural** e a **urbana**. Elas medem o mesmo percentual, mas só para as famílias do meio rural ou do meio urbano.
> 
> Posso buscar o valor de um município ou estado específico, se você quiser.

## C04 — conceitual

**Pergunta:** Quais índices sobre degradação da terra o SEDES tem?

**Esperado:** Dois: Índice de Degradação da Terra (2001 e 2021; níveis 1 a 5 e Conservado) e Dinâmica da Degradação da Terra – ODS 15.3.1 (2021; Degradando, Estável, Melhorando).

**Tempo:** 9.1 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES tem dois índices diretamente sobre degradação da terra. Os dois mostram o **% da área do território** em cada classe. Cada território tem valor próprio, que não é média dos municípios.
> 
> **Diretos**
> - **Dinâmica da Degradação da Terra, ODS 15.3.1**: mostra se a terra está Degradando, Estável ou Melhorando. Tem só 2021 (atualizado em 26/08/2026).
> - **Índice de Degradação da Terra**: classifica a área em Nível 5, 4, 3, 2, 1 ou Conservado. Vai de 2001 a 2021, mas tem só 2 períodos (atualizado em 14/08/2026).
> 
> **Relacionados**
> - **PRODES (INPE)**: desmatamento acumulado e vegetação nativa, de 2000 a 2024 (atualizado em 24/10/2026).
> - **Cobertura da Terra (IBGE)**: uso e cobertura do solo, de 2000 a 2020 (atualizado em 26/08/2026).
> - **Produção Primária Bruta**: mede o quanto a vegetação produz, de 2001 a 2025 (atualizado em 03/09/2026).
> - **Carbono Orgânico do Solo (Embrapa)**: 2020 (atualizado em 14/08/2026).
> - **Solos do Brasil (IBGE)**: tipos de solo, 2025 (atualizado em 21/09/2026).
> - **Índices de Aridez (BR-DWGD e ERA5 Land)**: classificam o clima de Árido a Úmido, de 1990 a 2024 e de 1980 a 2024 (atualizados em 27 e 28/08/2026).
> 
> Posso consultar algum deles para um município, estado ou recorte específico.

## P01 — valor pontual

**Pergunta:** Como estava a seca em Campina Grande (PB) em abril de 2026, segundo o Monitor de Secas?

**Esperado:** Abr/2026, Monitor de Secas: 71,7% da área em seca moderada e 28,3% em seca fraca. Citar a data de atualização do índice (19/10/2026).

**Tempo:** 6.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND periodo='2026-04' AND territorio='2504009' ORDER BY classe`

**Resposta do bot:**

> Em abril de 2026, Campina Grande–PB estava com **seca moderada em 71,7% da área** e **seca fraca nos outros 28,3%**. Não havia área sem seca nem em seca grave, extrema ou excepcional.
> 
> Os números são o percentual da área do município em cada classe do Monitor de Secas (ANA), em abril de 2026. O dado foi atualizado no SEDES em 19/10/2026.

## P02 — valor pontual

**Pergunta:** Qual era o percentual de pobreza rural em Juazeiro do Norte em 2025?

**Esperado:** 47,3% das famílias rurais do CadÚnico em situação de pobreza (Juazeiro do Norte–CE, 2025).

**Tempo:** 6.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Juazeiro do Norte"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='percentual-de-pobreza-rural-cadunico' AND territorio='2307304' AND periodo='2025'`

**Resposta do bot:**

> Em 2025, 47,3% das famílias rurais de Juazeiro do Norte–CE inscritas no CadÚnico estavam em situação de pobreza.
> 
> Fonte: índice "Percentual de pobreza rural – CadÚnico", período 2025, dado atualizado no SEDES em 06/10/2026. O valor é o percentual de famílias inscritas no CadÚnico em situação de pobreza no meio rural, não da população total.

## P03 — valor pontual

**Pergunta:** Quantos registros de seca e estiagem Petrolina teve em 2024?

**Esperado:** 1 registro em 2024 (S2iD, Petrolina–PE), igual ao site. Bônus: a ressalva de que na planilha atual quase todo município tem 0 ou 1 por ano.

**Tempo:** 6.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Petrolina"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='2611101' AND periodo='2024'`

**Resposta do bot:**

> Petrolina–PE teve **1 registro** de seca e estiagem em 2024. O número vem do índice "Registros de Secas e Estiagens do S2iD", período 2024, e é uma contagem de registros. O dado foi atualizado no SEDES em 04/11/2026.
> 
> Posso consultar outros anos de Petrolina, se você quiser.

## P04 — valor pontual

**Pergunta:** Qual é a cobertura da terra predominante em Sobral, no Ceará?

**Esperado:** Vegetação campestre, com 85,6% da área em 2020 (depois vegetação florestal 5,2% e mosaico de ocupações em área florestal 4,4%).

**Tempo:** 8.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Sobral","uf":"CE"}`
1. `consultar_sql: SELECT v.periodo, c.rotulo, v.valor FROM valores v JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='cobertura-da-terra-ibge-s' AND v.territorio='2312908' AND v.periodo=(SELECT MAX(periodo) FROM valores WHERE indice='cobertura-da-terra-ibge-s' AND territorio='2312908') ORDER BY v.valor DESC`

**Resposta do bot:**

> A cobertura predominante em Sobral–CE é a **vegetação campestre**. Ela ocupa 85,6% da área do município.
> 
> Dados do índice Cobertura da Terra | IBGE, ano de 2020, que é o último período disponível. O índice foi atualizado no SEDES em 26/08/2026. Os valores são o % da área do município em cada classe.
> 
> As outras classes com área são:
> - Vegetação florestal: 5,2%
> - Mosaico de ocupações em área florestal: 4,4%
> - Mosaico de ocupações em área campestre: 3,2%
> - Área artificial: 1,1%
> - Corpo d'água continental: 0,6%
> 
> Posso mostrar como isso mudou desde 2000, se você quiser.

## P05 — valor pontual

**Pergunta:** Qual era a situação do CDI na Paraíba em janeiro de 2026?

**Esperado:** O CDI é decendial: em janeiro de 2026 a PB teve 86,1% da área em algum estágio de seca no 1º decêndio, 79,1% no 2º e 86,4% no 3º (no 3º: Estágio 3 41,6%, Estágio 1 37,8%, Estágio 2 7,0%). Acerto = explicar os decêndios e dar os números, ou dar um decêndio dizendo qual.

**Tempo:** 8.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, classe, valor FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='pb' AND periodo BETWEEN '2026-01-01' AND '2026-01-31' ORDER BY periodo, classe`

**Resposta do bot:**

> Em janeiro de 2026, quase toda a Paraíba estava em algum estágio de seca. Pelo CDI (Índice Combinado de Seca), só 0,3% da área do estado estava sem seca nos três decêndios do mês. Um decêndio é um período de cerca de 10 dias.
> 
> Os valores abaixo são o percentual da área da Paraíba em cada classe. O CDI é decendial, então há três datas em janeiro. Os dados são do índice atualizado no SEDES em 19/10/2026.
> 
> | Classe | 01/01 | 11/01 | 21/01 |
> |---|---|---|---|
> | Sem seca | 0,3% | 0,3% | 0,3% |
> | Estágio 1 | 58,2% | 49,6% | 37,8% |
> | Estágio 2 | 15,9% | 11,5% | 7,0% |
> | Estágio 3 | 12,0% | 18,0% | 41,6% |
> | Recuperação total | 0,0% | 1,1% | 3,3% |
> | Recuperação parcial da umidade | 10,2% | 13,5% | 6,2% |
> | Recuperação parcial da vegetação | 3,4% | 6,0% | 3,9% |
> 
> Ao longo do mês, a área no Estágio 3 subiu de 12,0% para 41,6%. Esse é o estágio mais grave do CDI entre os listados. A área no Estágio 1 caiu de 58,2% para 37,8%.

## P06 — valor pontual

**Pergunta:** Qual é o PIB de Campina Grande?

**Esperado:** R$ 12,9 bilhões em 2023 (PIB, Campina Grande–PB); antes, R$ 10,1 bi em 2020 e R$ 5,0 bi em 2010. Errado = inventar um número.

**Tempo:** 6.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='produto-interno-bruto' AND territorio='2504009' ORDER BY periodo`

**Resposta do bot:**

> O PIB de Campina Grande–PB em 2023, o dado mais recente, é de cerca de **R$ 12,9 bilhões** (R$ 12.908.743.351). Os dados vêm do índice Produto Interno Bruto do SEDES, em reais, e foram atualizados em 09/10/2026.
> 
> O SEDES tem só três anos para esse índice:
> 
> | Ano | PIB |
> |---|---|
> | 2010 | R$ 5,0 bilhões |
> | 2020 | R$ 10,1 bilhões |
> | 2023 | R$ 12,9 bilhões |
> 
> Posso comparar com outros municípios, se você quiser.

## R01 — ranking

**Pergunta:** Quais os 5 municípios da Paraíba com maior percentual de pobreza total em 2025?

**Esperado:** Juarez Távora 74,2%, Curral de Cima 73,9%, Santa Inês 73,2%, Cacimbas 73,1%, Pedro Régis 72,8%.

**Tempo:** 8.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `consultar_sql: SELECT id, nome, escala_temporal, primeiro_periodo, ultimo_periodo, unidade, significado_valor, agregacao, observacao, atualizado_em FROM indices WHERE id LIKE '%pobreza%'`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='percentual-de-pobreza-total-cadunico' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB' ORDER BY v.valor DESC LIMIT 6`

**Resposta do bot:**

> Os 5 municípios da Paraíba com maior percentual de pobreza total em 2025 são:
> 
> | # | Município | Famílias em situação de pobreza |
> |---|---|---|
> | 1 | Juarez Távora | 74,2% |
> | 2 | Curral de Cima | 73,9% |
> | 3 | Santa Inês | 73,2% |
> | 4 | Cacimbas | 73,1% |
> | 5 | Pedro Régis | 72,8% |
> 
> Fonte: índice "Percentual de pobreza total – CadÚnico", ano de 2025, municípios da Paraíba. O dado foi atualizado no SEDES em 06/10/2026.
> 
> O valor é a porcentagem das famílias inscritas no CadÚnico que estão em situação de pobreza. Não é a porcentagem da população total do município.

## R02 — ranking

**Pergunta:** Quais municípios do Semiárido tinham mais área em seca grave ou pior no Monitor de Secas em abril de 2026?

**Esperado:** 41 municípios do Semiárido estavam com 100% da área em seca grave ou pior em abr/2026 (33 no PI, 6 no CE, 2 no RN), por exemplo Tibau e Baraúna (RN), Russas e Limoeiro do Norte (CE), Wall Ferraz (PI). Acerto = dizer que há empate em 100% e dar exemplos.

**Tempo:** 10.5 s · **turnos:** 5

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe>=4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY t.codigo ORDER BY pct DESC LIMIT 15`
1. `consultar_sql: WITH s AS (SELECT v.territorio, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe>=4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY v.territorio) SELECT COUNT(*) AS total, SUM(pct>=99.95) AS com_100, SUM(pct>0) AS com_alguma FROM s`
1. `consultar_sql: WITH s AS (SELECT t.uf, v.territorio, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe>=4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY v.territorio) SELECT uf, COUNT(*) n FROM s WHERE pct>=99.95 GROUP BY uf ORDER BY n DESC`

**Resposta do bot:**

> 41 municípios do Semiárido tinham 100% da área em seca grave ou pior em abril de 2026, então não há um ranking único. Todos empatam no topo.
> 
> (Monitor de Secas da ANA, abril de 2026. O valor é o % da área do município em seca grave, extrema ou excepcional. Dado atualizado no SEDES em 19/10/2026.)
> 
> - **Piauí:** 33 municípios, entre eles Wall Ferraz, Vera Mendes, Sussuapara, São Miguel do Fidalgo, São Luis do Piauí, São José do Piauí e São João da Varjota.
> - **Ceará:** 6 municípios: Tabuleiro do Norte, Russas, Quixeré, Limoeiro do Norte, Jaguaruana e Itaiçaba.
> - **Rio Grande do Norte:** 2 municípios: Tibau e Baraúna.
> 
> Só 93 dos 1.477 municípios do Semiárido tinham alguma área nessas classes. Os outros não tinham nenhuma.
> 
> Se quiser, listo os 41 municípios completos ou os que vêm logo abaixo, com menos de 100%.

## R03 — ranking

**Pergunta:** Pelo dado mais recente do CDI, quais estados têm a maior parte da área em seca?

**Esperado:** Último decêndio do CDI (21/09/2026), soma dos Estágios 1 a 3: Roraima 98,6%, Pernambuco 96,4%, Amazonas 95,6%, Sergipe 94,3%, Amapá 91,7%. Tem que dizer qual é o período.

**Tempo:** 8.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, SUM(CASE WHEN v.classe IN (2,3,4) THEN v.valor END) AS seca, SUM(CASE WHEN v.classe IN (5,6,7) THEN v.valor END) AS recup, MAX(CASE WHEN v.classe=1 THEN v.valor END) AS sem FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='indice-combinado-de-seca-cdi' AND v.periodo='2026-09-21' AND t.tipo='estado' GROUP BY t.codigo ORDER BY seca DESC LIMIT 10`

**Resposta do bot:**

> Pelo dado mais recente do CDI (Índice Combinado de Seca), o decêndio de 21/09/2026, os estados com maior parte da área em seca são:
> 
> | Estado | % da área em seca |
> |---|---|
> | Roraima | 98,6% |
> | Pernambuco | 96,4% |
> | Amazonas | 95,6% |
> | Sergipe | 94,3% |
> | Amapá | 91,7% |
> | Piauí | 85,1% |
> | Rio Grande do Sul | 75,3% |
> | Alagoas | 75,2% |
> | Maranhão | 73,1% |
> | Acre | 70,4% |
> 
> - **O que o número significa:** é a % da área de cada estado nos estágios 1, 2 ou 3 de seca do CDI, somados. Cada estado tem valor próprio, calculado sobre a área dele.
> - **O que ficou de fora:** as classes de recuperação (total, parcial da umidade e parcial da vegetação) não entraram na soma.
> - **Atualização:** o índice foi atualizado no SEDES em 19/10/2026.
> 
> Se quiser, mostro a divisão por estágio de seca ou como esse resultado mudou em relação aos decêndios anteriores.

## R04 — ranking

**Pergunta:** No bioma Caatinga, quais municípios tiveram mais registros de seca e estiagem em 2025?

**Esperado:** Não há destaque: em 2025, 760 dos 1.095 municípios da Caatinga têm 1 registro e nenhum tem mais que 1. Acerto = dizer que há empate (e a ressalva do S2iD); errado = apresentar 10 municípios como "os que mais tiveram".

**Tempo:** 10.1 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='registros-de-secas-e-estiagens-do-s2id' AND v.periodo='2025' AND t.tipo='municipio' AND t.bioma LIKE '%aatinga%' ORDER BY v.valor DESC LIMIT 15`
1. `consultar_sql: SELECT COUNT(*) n, SUM(v.valor) soma, SUM(v.valor>0) com_registro, MAX(v.valor) mx FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='registros-de-secas-e-estiagens-do-s2id' AND v.periodo='2025' AND t.tipo='municipio' AND t.bioma LIKE '%aatinga%'`

**Resposta do bot:**

> Não há município de destaque: em 2025, nenhum município da Caatinga teve mais registros que os outros. O valor máximo é 1, e 760 municípios empatam nele.
> 
> - **Fonte e período:** Registros de Secas e Estiagens do S2iD, ano de 2025, dado atualizado no SEDES em 04/11/2026.
> - **Município:** aqui entra o município cujo bioma predominante é a Caatinga. O SEDES tem 1.095 deles.
> - **O que o número mede:** é a contagem de registros por município no ano. Na planilha publicada, quase todo município aparece com 0 ou 1 por ano. Por isso eu não afirmo se o 1 quer dizer um único registro ou apenas que houve registro.
> - **Total:** são 760 municípios com 1 registro. Os outros 335 ficaram em 0. A soma é 760 registros no bioma.
> 
> Como o ranking não separa ninguém, a lista abaixo é só uma amostra dos municípios com 1 registro, em ordem alfabética: Água Branca, Batalha, Belo Monte, Cacimbinhas, Canapi, Carneiros, Coité do Nóia, Craíbas e Delmiro Gouveia, todos em Alagoas.
> 
> Posso listar os 760 municípios por estado. Também posso comparar com outros anos, em que os valores podem variar mais.

## R05 — ranking

**Pergunta:** Qual estado do Nordeste tem a maior parte da área degradando, segundo o ODS 15.3.1?

**Esperado:** Sergipe, com 16,7% da área degradando (2021). Depois Bahia 10,3% e Pernambuco 8,3%.

**Tempo:** 7 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='dinamica-da-degradacao-da-terra-ods-15-3-1' AND v.periodo='2021' AND v.classe=1 AND t.tipo='estado' AND t.regiao LIKE '%Nordeste%' ORDER BY v.valor DESC`

**Resposta do bot:**

> **Sergipe** tem a maior parte da área degradando no Nordeste: 16,7% do território.
> 
> Os valores abaixo são o percentual da área de cada estado classificado como "Degradando" (Dinâmica da Degradação da Terra – ODS 15.3.1, ano de 2021; dado atualizado no SEDES em 26/08/2026).
> 
> | Estado | % da área degradando |
> |---|---|
> | Sergipe | 16,7% |
> | Bahia | 10,3% |
> | Pernambuco | 8,3% |
> | Maranhão | 7,8% |
> | Alagoas | 7,2% |
> | Piauí | 6,9% |
> | Paraíba | 6,7% |
> | Rio Grande do Norte | 6,6% |
> | Ceará | 6,1% |
> 
> O valor de cada estado é calculado sobre a área própria dele, não é média dos municípios.

## T01 — tendência

**Pergunta:** Como evoluiu a pobreza total em Campina Grande de 2012 a 2025?

**Esperado:** Caiu de 79,1% em 2012 para 36,9% em 2025, com queda forte até 2017 (45,2%), estabilidade perto de 40% e um pico em 2022 (45,5%).

**Tempo:** 8.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND territorio='2504009' AND periodo BETWEEN '2012' AND '2025' ORDER BY periodo`

**Resposta do bot:**

> A pobreza total em Campina Grande–PB caiu bastante entre 2012 e 2025: de 79,1% para 36,9% das famílias inscritas no CadÚnico.
> 
> **O que o número mede:** o % de famílias inscritas no CadÚnico que estão em situação de pobreza. Não é o % da população total da cidade.
> 
> **Como evoluiu** (Percentual de pobreza total – CadÚnico, Campina Grande–PB):
> - **2012 a 2016:** queda forte, de 79,1% para 47,1%.
> - **2017 a 2021:** queda mais lenta, de 45,2% para 39,3%.
> - **2022:** subiu para 45,5%.
> - **2023 e 2024:** voltou para 39,5% e 39,7%.
> - **2025:** 36,9%, o menor valor da série.
> 
> | Ano | % | Ano | % |
> |---|---|---|---|
> | 2012 | 79,1 | 2019 | 40,9 |
> | 2013 | 72,3 | 2020 | 41,0 |
> | 2014 | 62,8 | 2021 | 39,3 |
> | 2015 | 50,8 | 2022 | 45,5 |
> | 2016 | 47,1 | 2023 | 39,5 |
> | 2017 | 45,2 | 2024 | 39,7 |
> | 2018 | 42,3 | 2025 | 36,9 |
> 
> Dado atualizado no SEDES em 06/10/2026.

## T02 — tendência

**Pergunta:** A seca no Ceará piorou ou melhorou entre janeiro e abril de 2026, pelo Monitor de Secas?

**Esperado:** Melhorou: em janeiro havia 27,3% em seca extrema e 20,9% em grave; em abril não havia seca extrema, só 6,7% em grave, e a maior parte em seca fraca (52,1%) ou moderada (41,2%).

**Tempo:** 8.5 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, classe, valor FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='ce' AND periodo IN ('2026-01','2026-04') ORDER BY periodo, classe`

**Resposta do bot:**

> A seca no Ceará **melhorou** entre janeiro e abril de 2026. A área nas classes mais graves diminuiu bastante.
> 
> Dados do Monitor de Secas (ANA), Ceará, em % da área do estado em cada classe. O índice foi atualizado no SEDES em 19/10/2026.
> 
> | Classe | Janeiro/2026 | Abril/2026 |
> |---|---|---|
> | Seca fraca | 2,1% | 52,1% |
> | Seca moderada | 49,6% | 41,2% |
> | Seca grave | 20,9% | 6,7% |
> | Seca extrema | 27,3% | 0,0% |
> | Seca excepcional | 0,0% | 0,0% |
> | Sem seca | 0,0% | 0,0% |
> 
> - A seca grave ou pior (grave, extrema e excepcional) caiu de 48,2% para 6,7% da área.
> - Em abril, 93,3% da área estava em seca fraca ou moderada.
> - Nenhuma parte do estado estava na classe "sem seca" em nenhum dos dois meses.
> 
> Se quiser, posso mostrar os meses intermediários.

## T03 — tendência

**Pergunta:** Em que ano o Brasil teve mais registros de seca e estiagem?

**Esperado:** 2013, com 1.617 registros (soma dos municípios). Depois vêm 2012 (1.608) e 2020 (1.586). Bônus: a ressalva do S2iD.

**Tempo:** 6.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='br' ORDER BY valor DESC LIMIT 5`

**Resposta do bot:**

> O Brasil teve mais registros de seca e estiagem em **2013**, com **1.617 registros**. Os dados são do índice "Registros de Secas e Estiagens do S2ID", que cobre de 1991 a 2025 e foi atualizado no SEDES em 04/11/2026.
> 
> O número do Brasil é a soma dos registros de todos os municípios. Os anos seguintes no ranking ficaram muito próximos:
> 
> - 2012: 1.608 registros
> - 2020: 1.586 registros
> - 2005: 1.568 registros
> - 2025: 1.511 registros
> 
> Não afirmo o que cada unidade representa na prática. O índice chama o valor apenas de "registros", e a maioria dos municípios aparece com 0 ou 1 por ano.

## T04 — tendência

**Pergunta:** Em que época de 2025 a Paraíba teve a maior área em seca pelo CDI?

**Esperado:** Final de dezembro de 2025: no decêndio que começa em 21/12/2025, 89,2% da área em algum estágio de seca (Estágios 1 a 3); dezembro inteiro foi o pior período (60,7% e 55,6% nos outros dois decêndios). Depois vêm o início de janeiro (46,6%) e o início de maio (45,0%). Tem que dizer que o CDI é por decêndio.

**Tempo:** 9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor END) AS seca, SUM(CASE WHEN classe=4 THEN valor END) AS e3 FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='pb' AND periodo BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY periodo ORDER BY seca DESC LIMIT 5`

**Resposta do bot:**

> A maior área em seca na Paraíba em 2025 foi no fim do ano, no decêndio (período de cerca de 10 dias) que começa em 21 de dezembro de 2025. Nele, 89,2% da área do estado estava em seca.
> 
> Somei os Estágios 1, 2 e 3 do CDI (Índice Combinado de Seca), que são as classes de seca do índice. Não contei as classes de "recuperação".
> 
> Os maiores valores do ano, em % da área da Paraíba:
> - **21/12/2025:** 89,2%
> - **11/12/2025:** 60,7%
> - **01/12/2025:** 55,6%
> - **01/01/2025:** 46,6%
> 
> Em 21/12/2025, a maior parte dessa área estava nos Estágios 1 e 2. O Estágio 3, o mais grave do índice, ocupava só 4,8%.
> 
> Fonte: Índice Combinado de Seca (CDI), território Paraíba, dado decendial. O índice foi atualizado no SEDES em 19/10/2026. O valor de cada decêndio é a % da área do estado em cada classe.

## T05 — tendência

**Pergunta:** Me diga a situação de seca em Itabuna em 7 de maio de 2001 e em 7 de maio de 2026.

**Esperado:** Comparar no mesmo índice, o CDI, que cobre os dois anos: no decêndio que começa em 1º de maio (inclui o dia 7), Itabuna–BA tinha em 2001 45,4% da área sem seca, 44,9% em recuperação total e 9,7% no Estágio 3; em 2026, 100% sem seca. O Monitor de Secas só começa em 2024 (maio/2026: 100% sem seca). Errado = comparar 2001 de um índice com 2026 de outro sem avisar. (Pergunta tirada de uma conversa real de 12/11/2026.)

**Tempo:** 10.4 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Itabuna"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2914802' AND periodo IN ('2001-05-01','2026-05-01') ORDER BY periodo, classe`
1. `consultar_sql: SELECT periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='2914802' AND periodo='2026-05' ORDER BY classe`

**Resposta do bot:**

> Em 7 de maio de 2026, Itabuna–BA estava sem seca. Em 7 de maio de 2001, parte do município estava em seca.
> 
> Usei o Índice Combinado de Seca (CDI), que é a única série do SEDES que chega a 2001. Ele é decendial, ou seja, tem um dado a cada 10 dias. O dia 7 de maio cai no decêndio que começa em 01/05. Os valores são o % da área do município em cada classe.
> 
> | Classe | 01/05/2001 | 01/05/2026 |
> |---|---|---|
> | Sem seca | 45,4% | 100% |
> | Estágio 3 (seca mais forte do índice) | 9,7% | 0% |
> | Recuperação total | 44,9% | 0% |
> | Demais classes | 0% | 0% |
> 
> - **2001:** quase metade da área (45,4%) estava sem seca. Outros 9,7% estavam em Estágio 3, e 44,9% estavam em "recuperação total", ou seja, saindo de uma situação de seca.
> - **2026:** 100% da área estava sem seca.
> 
> O Monitor de Secas da ANA também mostra 100% da área sem seca em maio de 2026. Ele só tem dados a partir de 2024, então não cobre 2001.
> 
> Fonte: CDI, decêndio de 01/05 de 2001 e de 2026, Itabuna–BA, atualizado no SEDES em 19/10/2026. Monitor de Secas, maio de 2026, atualizado em 19/10/2026.

## X01 — cruzamento

**Pergunta:** Quais municípios do Semiárido estavam com mais de 90% da área em seca grave ou pior em abril de 2026 e também têm pobreza total acima de 60% em 2025?

**Esperado:** Cinco municípios, todos no Piauí: Wall Ferraz (pobreza 68,8%), Aroeiras do Itaim (67,0%), Jaicós (64,9%), Santa Rosa do Piauí (61,5%) e Sussuapara (61,0%), todos com 100% da área em seca grave ou pior.

**Tempo:** 7.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, s.pct, p.valor AS pobreza FROM (SELECT territorio, SUM(valor) AS pct FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-04' AND classe>=4 GROUP BY territorio) s JOIN valores p ON p.territorio=s.territorio AND p.indice='percentual-de-pobreza-total-cadunico' AND p.periodo='2025' AND p.classe=1 JOIN territorios t ON t.codigo=s.territorio WHERE t.tipo='municipio' AND t.semiarido=1 AND s.pct>90 AND p.valor>60 ORDER BY s.pct DESC`

**Resposta do bot:**

> Cinco municípios do Semiárido atendem aos dois critérios, todos no Piauí:
> 
> | Município | Área em seca grave ou pior | Pobreza total |
> |---|---|---|
> | Aroeiras do Itaim–PI | 100% | 67,0% |
> | Jaicós–PI | 100% | 64,9% |
> | Santa Rosa do Piauí–PI | 100% | 61,5% |
> | Sussuapara–PI | 100% | 61,0% |
> | Wall Ferraz–PI | 100% | 68,8% |
> 
> - **Seca:** Monitor de Secas (ANA), abril de 2026. É a soma da % da área do município nas classes seca grave, extrema e excepcional. O índice foi atualizado no SEDES em 19/10/2026.
> - **Pobreza:** Percentual de pobreza total (CadÚnico), 2025. É a % das famílias inscritas no CadÚnico em situação de pobreza. O índice foi atualizado em 06/10/2026.

## X02 — cruzamento

**Pergunta:** Entre os municípios com mais da metade da área nos níveis 3 a 5 de degradação em 2021, quais têm a maior pobreza rural em 2025?

**Esperado:** 2.268 municípios têm mais da metade da área nos níveis 3 a 5. Os de maior pobreza rural em 2025: Campo Grande–AL (80,9%), Potiraguá–BA (79,9%), Senador Elói de Souza–RN (79,7%), Colônia Leopoldina–AL (78,0%), Feira Nova–PE (77,9%). Atenção: o nível 5 é o mais degradado; as classes 1 a 3 do tabelão são os níveis 5, 4 e 3.

**Tempo:** 10.7 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH d AS (SELECT v.territorio, SUM(v.valor) pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='indice-de-degradacao-da-terra' AND v.periodo='2021' AND v.classe IN (1,2,3) AND t.tipo='municipio' GROUP BY v.territorio HAVING SUM(v.valor)>50) SELECT (SELECT COUNT(*) FROM d) n, t.nome, t.uf, d.pct, p.valor pobreza_rural FROM d JOIN territorios t ON t.codigo=d.territorio JOIN valores p ON p.territorio=d.territorio AND p.indice='percentual-de-pobreza-rural-cadunico' AND p.periodo='2025' ORDER BY p.valor DESC LIMIT 10`

**Resposta do bot:**

> Entre os 2.268 municípios com mais de 50% da área nos níveis 3, 4 e 5 de degradação em 2021, estes 10 têm a maior pobreza rural em 2025:
> 
> | Município | % da área nos níveis 3 a 5 (2021) | Pobreza rural (2025) |
> |---|---|---|
> | Campo Grande–AL | 89,1% | 80,9% |
> | Potiraguá–BA | 69,5% | 79,9% |
> | Senador Elói de Souza–RN | 75,0% | 79,7% |
> | Colônia Leopoldina–AL | 60,4% | 78,0% |
> | Feira Nova–PE | 90,3% | 77,9% |
> | Altamira do Maranhão–MA | 86,5% | 76,6% |
> | Chã Preta–AL | 72,0% | 76,6% |
> | Coronel Sapucaia–MS | 75,1% | 75,7% |
> | Porto Real do Colégio–AL | 70,8% | 75,6% |
> | Graccho Cardoso–SE | 82,0% | 74,9% |
> 
> **O que os números significam:**
> - **Degradação:** é a soma, em cada município, do percentual da área nas classes Nível 3, Nível 4 e Nível 5. A fonte é o Índice de Degradação da Terra, período 2021, atualizado no SEDES em 14/08/2026.
> - **Pobreza rural:** é o percentual de famílias inscritas no CadÚnico em situação de pobreza no meio rural. A fonte é o Percentual de pobreza rural – CadÚnico, período 2025, atualizado no SEDES em 06/10/2026.
> 
> Posso fazer o mesmo recorte só para o Semiárido ou para um estado, se você quiser.

## X03 — cruzamento

**Pergunta:** Na Paraíba, os municípios com mais pobreza em 2025 tiveram mais registros de seca em 2025?

**Esperado:** Não: dividindo os 223 municípios da PB em quatro faixas de pobreza, a média de registros do S2iD em 2025 fica em ~0,6 em todas. Não há relação visível. Acerto = conclusão de "sem relação clara" baseada nos dados.

**Tempo:** 13.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH p AS ( SELECT v.territorio, v.valor AS pob FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='percentual-de-pobreza-total-cadunico' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB'), s AS (SELECT territorio, valor AS reg FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND periodo='2025'), j AS (SELECT p.territorio, pob, COALESCE(s.reg,0) reg, (s.reg IS NULL) semlinha, NTILE(4) OVER (ORDER BY pob DESC) q FROM p LEFT JOIN s USING(territorio)) SELECT q, COUNT(*) n, ROUND(MIN(pob),1) minpob, ROUND(MAX(pob),1) maxpob, ROUND(AVG(reg),2) media_reg, SUM(reg) soma, SUM(reg>0) com_reg, SUM(semlinha) sem_linha FROM j GROUP BY q`
1. `consultar_sql: WITH p AS ( SELECT v.territorio, v.valor AS pob FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='percentual-de-pobreza-total-cadunico' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB'), s AS (SELECT territorio, valor AS reg FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND periodo='2025') SELECT t.nome, ROUND(pob,1) pob, s.reg FROM p JOIN territorios t ON t.codigo=p.territorio LEFT JOIN s USING(territorio) ORDER BY pob DESC LIMIT 10`

**Resposta do bot:**

> **Não. Na Paraíba, os municípios mais pobres em 2025 não tiveram mais registros de seca do que os demais.**
> 
> Dividi os 223 municípios paraibanos em quatro grupos, do mais pobre ao menos pobre. A pobreza vem do CadÚnico (% das famílias inscritas em situação de pobreza, 2025, atualizado em 06/10/2026). Os registros vêm do S2iD (contagem de registros de secas e estiagens, 2025, atualizado em 04/11/2026).
> 
> | Grupo | Pobreza das famílias | Média de registros por município | Municípios com registro |
> |---|---|---|---|
> | 25% mais pobres (56 municípios) | 62,8% a 74,2% | 0,57 | 32 |
> | 2º grupo (56) | 58,6% a 62,7% | 0,63 | 35 |
> | 3º grupo (56) | 52,9% a 58,6% | 0,64 | 36 |
> | 25% menos pobres (55) | 34,5% a 52,9% | 0,62 | 34 |
> 
> O grupo mais pobre teve a menor média, 0,57 registro por município. As médias dos quatro grupos são muito próximas. Nos 10 municípios mais pobres, só 5 tiveram registro. Juarez Távora (74,2%) e Santa Inês (73,2%) tiveram 0.
> 
> Isso mostra que, em 2025, pobreza e número de registros de seca não andaram juntos na Paraíba. Não significa que a seca não afete os mais pobres. O S2iD conta registros oficiais de município, e quase todos têm 0 ou 1 por ano. Por isso ele mede pouco a intensidade da seca.
> 
> Posso comparar com o Monitor de Secas, que mede a % da área em seca, se você quiser.

## A01 — recorte agregado

**Pergunta:** Como estava a seca no bioma Caatinga em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, bioma Caatinga: seca moderada 55,0%, seca fraca 34,8%, sem seca 5,3% e seca grave 4,9%.

**Tempo:** 7.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, valor FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-04' AND territorio='3_bioma-caatinga' ORDER BY classe`

**Resposta do bot:**

> Em abril de 2026, a maior parte do bioma Caatinga estava em seca moderada, e quase nada estava em seca grave. Os dados são do Monitor de Secas (ANA), para o bioma Caatinga, em abril de 2026. O dado foi atualizado no SEDES em 19/10/2026.
> 
> Cada valor é a % da área do bioma em cada classe:
> 
> - Sem seca: 5,3%
> - Seca fraca: 34,8%
> - Seca moderada: 55,0%
> - Seca grave: 4,9%
> - Seca extrema: 0,0%
> - Seca excepcional: 0,0%
> 
> Somando as classes de seca, cerca de 94,7% da área tinha algum grau de seca. As classes mais fortes, grave e acima, ocupavam 4,9%.
> 
> Posso mostrar como isso mudou nos meses seguintes, se você quiser.

## A02 — recorte agregado

**Pergunta:** Qual é o percentual de pobreza total na região Nordeste?

**Esperado:** 57,9% em 2025 (Nordeste, valor próprio do recorte; é a média simples dos municípios, calculada pelo site). Por estado, vai de 52,9% (RN) a 64,6% (MA).

**Tempo:** 7.5 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND territorio='2_regiao-nordeste' ORDER BY periodo DESC LIMIT 3`

**Resposta do bot:**

> Em 2025, 57,9% das famílias do CadÚnico no Nordeste estavam em situação de pobreza.
> 
> - **Índice:** Percentual de pobreza total – CadÚnico, 2025 (último ano disponível). O dado foi atualizado no SEDES em 06/10/2026.
> - **O que o número significa:** é a % de famílias inscritas no CadÚnico em situação de pobreza. Não é a % da população total.
> - **Como o valor da região é calculado:** é a média simples dos municípios, sem peso por população. Municípios pequenos pesam o mesmo que as capitais.
> 
> Posso mostrar a série dos últimos anos ou separar entre pobreza urbana e rural.

## A03 — recorte agregado

**Pergunta:** Qual parte do Brasil estava em seca em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, Brasil: 58,4% sem seca, 26,4% seca fraca, 14,4% moderada, 0,9% grave. Ou seja, ~41,6% da área com algum grau de seca.

**Tempo:** 7.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, valor FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-04' AND territorio='br' ORDER BY classe`

**Resposta do bot:**

> Em abril de 2026, 41,6% da área do Brasil estava com algum nível de seca, e 58,4% estava sem seca.
> 
> Esses números são do Monitor de Secas (ANA), abril de 2026, Brasil. O dado foi atualizado no SEDES em 19/10/2026. Cada valor é o percentual da área do território em cada classe.
> 
> | Classe | % da área |
> |---|---|
> | Sem seca | 58,4% |
> | Seca fraca | 26,4% |
> | Seca moderada | 14,4% |
> | Seca grave | 0,9% |
> | Seca extrema | 0,0% |
> | Seca excepcional | 0,0% |
> 
> O total em seca (41,6%) é a soma das cinco classes de seca. A maior parte era seca fraca ou moderada, e a seca grave ocupava menos de 1% da área.
> 
> Posso detalhar por região, estado ou município, se quiser.

## A04 — recorte agregado

**Pergunta:** Como está a degradação da terra no Semiárido?

**Esperado:** Semiárido, Índice de Degradação da Terra 2021: Conservado 75,5%, Nível 3 12,7%, Nível 4 7,4%, Nível 2 3,9%, Nível 5 0,3%, Nível 1 0,2%. Bônus: ODS 15.3.1 do Semiárido.

**Tempo:** 10.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT indice, periodo, classe, valor FROM valores WHERE territorio='5_semiarido-semiarido-total' AND indice IN ('dinamica-da-degradacao-da-terra-ods-15-3-1','indice-de-degradacao-da-terra') ORDER BY indice, periodo, classe`

**Resposta do bot:**

> A degradação da terra no Semiárido aumentou entre 2001 e 2021. Em 2021, cerca de 24,5% da área tinha algum nível de degradação, contra 18,2% em 2001. Os números abaixo são o % da área do Semiárido em cada classe.
> 
> **Índice de Degradação da Terra (2001 e 2021; atualizado no SEDES em 14/08/2026)**
> 
> | Situação | 2001 | 2021 |
> |---|---|---|
> | Conservado | 81,8% | 75,5% |
> | Nível 1 (mais leve) | 0,1% | 0,2% |
> | Nível 2 | 1,8% | 3,9% |
> | Nível 3 | 10,4% | 12,7% |
> | Nível 4 | 5,7% | 7,4% |
> | Nível 5 (mais grave) | 0,3% | 0,3% |
> 
> Os níveis 4 e 5, os mais graves, somavam 5,9% da área em 2001 e 7,7% em 2021.
> 
> **Dinâmica da Degradação da Terra, ODS 15.3.1 (2021; atualizado em 26/08/2026)**
> 
> Este índice mostra a tendência da terra, ou seja, se ela está piorando, estável ou melhorando.
> - Degradando: 7,9% da área.
> - Estável: 91,6%.
> - Melhorando: 0,5%.
> 
> Posso detalhar por estado ou município, se quiser.

## H01 — homônimo

**Pergunta:** Como está a seca em Santa Luzia?

**Esperado:** Perguntar qual Santa Luzia: há quatro (BA, MA, MG e PB). Não pode escolher uma sozinho.

**Tempo:** 6.1 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Santa Luzia"}`

**Resposta do bot:**

> Há quatro municípios chamados Santa Luzia. De qual você quer saber?
> 
> - Santa Luzia–BA
> - Santa Luzia–MA
> - Santa Luzia–MG
> - Santa Luzia–PB (no Semiárido, bioma Caatinga)
> 
> Diga a UF e eu consulto a situação da seca.

## H02 — homônimo

**Pergunta:** Qual é o percentual de pobreza em Bom Jesus em 2025?

**Esperado:** Perguntar qual Bom Jesus (PB, PI, RN, RS, SC) ou listar as cinco: PB 51,4%, PI 54,5%, RN 56,6%, RS 45,0%, SC 37,9%.

**Tempo:** 5 s · **turnos:** 3

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Bom Jesus"}`
1. `listar_indices: {}`

**Resposta do bot:**

> Existem cinco municípios chamados Bom Jesus. De qual você quer saber?
> 
> - Bom Jesus–PB
> - Bom Jesus–PI
> - Bom Jesus–RN
> - Bom Jesus–RS
> - Bom Jesus–SC
> 
> Quando você disser a UF, busco o percentual de pobreza de 2025 (CadÚnico, % das famílias inscritas em situação de pobreza).

## H03 — homônimo

**Pergunta:** E o Monitor de Secas de São Domingos da Paraíba em setembro de 2026?

**Esperado:** O usuário já deu a UF. São Domingos–PB, Monitor de Secas set/2026: 100% da área em seca moderada.

**Tempo:** 9.8 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"São Domingos da Paraíba"}`
1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"São Domingos","uf":"PB"}`
1. `consultar_sql: SELECT classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND territorio='2513968' ORDER BY classe`

**Resposta do bot:**

> Em setembro de 2026, 100% da área de São Domingos–PB estava em **seca moderada**. As outras classes (sem seca, fraca, grave, extrema e excepcional) ficaram em 0%.
> 
> O SEDES não tem um município chamado "São Domingos da Paraíba". O único São Domingos na Paraíba é "São Domingos" (código 2513968), e usei esse.
> 
> O valor é o percentual da área do município em cada classe do Monitor de Secas da ANA, e as classes somam 100%. O dado é de setembro de 2026 e foi atualizado no SEDES em 19/10/2026.

## I01 — período inexistente

**Pergunta:** Qual era o CDI de Campina Grande em 1995?

**Esperado:** Não há: o CDI começa em 01/01/2001. Pode oferecer o primeiro ano disponível.

**Tempo:** 6.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande"}`

**Resposta do bot:**

> O CDI no SEDES começa em 2001-01-01, então 1995 está fora da série. O SEDES não tem essa informação.
> 
> - **Índice Combinado de Seca (CDI):** períodos de 2001-01-01 a 2026-09-21, com dados a cada 10 dias. A última atualização foi em 19/10/2026.
> - **Mais antigo para Campina Grande–PB:** posso consultar a partir de janeiro de 2001, se você quiser.

## I02 — período inexistente

**Pergunta:** Como estava o Monitor de Secas em Patos (PB) em dezembro de 2026?

**Esperado:** Não existe dezembro de 2026 (ainda não aconteceu). O último mês é set/2026: Patos–PB com 82,5% da área em seca grave e 17,5% em moderada. Errado = inventar o dado de dezembro.

**Tempo:** 7 s · **turnos:** 3

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Patos","uf":"PB"}`
1. `consultar_sql: SELECT id, primeiro_periodo, ultimo_periodo, atualizado_em, previsao FROM indices WHERE id='monitor-de-seca-ana'`

**Resposta do bot:**

> O SEDES não tem o Monitor de Secas de dezembro de 2026, porque esse mês ainda não chegou (hoje é 12/11/2026). O índice não é previsão. Ele cobre de janeiro de 2024 a setembro de 2026 e foi atualizado no SEDES em 19/10/2026.
> 
> Posso mostrar a situação de Patos–PB em setembro de 2026, o último mês disponível. Quer que eu mostre?

## I03 — período inexistente

**Pergunta:** Quantos registros de seca Petrolina teve em 1985?

**Esperado:** Não há: a série do S2iD no SEDES começa em 1991. Pode oferecer o primeiro ano.

**Tempo:** 6.6 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Petrolina"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='2611101' AND periodo='1985'`

**Resposta do bot:**

> O SEDES não tem esse dado. Os registros de secas e estiagens do S2iD começam em 1991, então 1985 está fora da série e não há valor para Petrolina–PE nesse ano. O índice foi atualizado no SEDES em 04/11/2026.
> 
> Posso consultar Petrolina em 1991 ou em outro ano da série, de 1991 a 2025, se você quiser.

## F01 — fora do escopo

**Pergunta:** Qual é a população de Campina Grande?

**Esperado:** O SEDES não tem dado de população. Dizer isso, sem inventar número.

**Tempo:** 5.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande"}`

**Resposta do bot:**

> O SEDES não tem dados de população de Campina Grande–PB. Nenhum dos índices da plataforma mede o número de habitantes.
> 
> Os índices socioeconômicos disponíveis são:
> - pobreza (CadÚnico)
> - PIB
> - IDH
> - analfabetismo
> - mortalidade infantil
> - registros de seca no S2iD
> 
> Posso trazer algum desses para Campina Grande, se ajudar.

## F02 — fora do escopo

**Pergunta:** Vai chover amanhã em Fortaleza?

**Esperado:** O SEDES não tem previsão diária do tempo. Tem previsões mensais e trimestrais de chuva (CPTEC e INMET) de nov/2026 a fev/2027, que são probabilidades e anomalias, não "vai chover amanhã".

**Tempo:** 5.9 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> Não dá para dizer se vai chover amanhã em Fortaleza. O SEDES não tem previsão do tempo diária, só previsões sazonais, mensais e trimestrais de chuva. Para amanhã, o melhor é consultar o INMET, o CPTEC/INPE ou a Funceme.
> 
> Se quiser, posso buscar a previsão de chuva para Fortaleza em novembro de 2026 (mensal ou trimestral, CPTEC e INMET). Ela indica se o mês deve ter mais ou menos chuva que o normal. Não serve para saber se vai chover num dia específico.

## F03 — fora do escopo

**Pergunta:** Qual é a taxa de desemprego em Recife?

**Esperado:** O SEDES não tem desemprego. Dizer isso, sem inventar.

**Tempo:** 6.8 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Recife"}`

**Resposta do bot:**

> O SEDES não tem a taxa de desemprego de Recife, porque não há nenhum índice de desemprego ou mercado de trabalho na plataforma.
> 
> Para Recife–PE, o SEDES tem estes indicadores socioeconômicos:
> - pobreza (total, rural e urbana, pelo CadÚnico)
> - PIB
> - taxa de analfabetismo
> - IDH
> - mortalidade infantil
> - registros de secas e estiagens (S2iD)
> 
> Se quiser, posso consultar algum deles.
