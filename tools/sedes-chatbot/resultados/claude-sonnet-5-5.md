# Avaliação: claude-sonnet-5-5

Gerado por avaliar.sh em 2026-11-12T16:32:18.744Z.

| Id | Categoria | Tempo (s) | Turnos | Ferramentas |
| --- | --- | --- | --- | --- |
| C01 | conceitual | 6.7 | 2 | listar_indices×1 |
| C02 | conceitual | 5.9 | 2 | listar_indices×1 |
| C03 | conceitual | 6.2 | 2 | listar_indices×1 |
| C04 | conceitual | 7.6 | 2 | listar_indices×1 |
| P01 | valor pontual | 7.7 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P02 | valor pontual | 6.2 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P03 | valor pontual | 5.9 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P04 | valor pontual | 7 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P05 | valor pontual | 7.3 | 3 | listar_indices×1, consultar_sql×1 |
| P06 | valor pontual | 6.8 | 4 | buscar_territorio×1, listar_indices×1, relatorio_territorio×1 |
| R01 | ranking | 7.1 | 3 | listar_indices×1, consultar_sql×1 |
| R02 | ranking | 10.7 | 4 | listar_indices×1, consultar_sql×2 |
| R03 | ranking | 8.4 | 3 | listar_indices×1, consultar_sql×1 |
| R04 | ranking | 8.3 | 3 | listar_indices×1, consultar_sql×1 |
| R05 | ranking | 8.6 | 3 | listar_indices×1, consultar_sql×1 |
| T01 | tendência | 7.8 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| T02 | tendência | 7.7 | 3 | listar_indices×1, consultar_sql×1 |
| T03 | tendência | 7.1 | 3 | listar_indices×1, consultar_sql×1 |
| T04 | tendência | 7.4 | 3 | listar_indices×1, consultar_sql×1 |
| X01 | cruzamento | 8.6 | 3 | listar_indices×1, consultar_sql×1 |
| X02 | cruzamento | 10.2 | 4 | listar_indices×1, consultar_sql×2 |
| X03 | cruzamento | 12.3 | 4 | listar_indices×1, consultar_sql×2 |
| A01 | recorte agregado | 6.6 | 3 | listar_indices×1, consultar_sql×1 |
| A02 | recorte agregado | 8.9 | 4 | listar_indices×1, relatorio_territorio×1, consultar_sql×1 |
| A03 | recorte agregado | 7.1 | 3 | listar_indices×1, consultar_sql×1 |
| A04 | recorte agregado | 9.8 | 3 | listar_indices×1, relatorio_territorio×1 |
| H01 | homônimo | 5.2 | 2 | buscar_territorio×1 |
| H02 | homônimo | 5.3 | 3 | buscar_territorio×1, listar_indices×1 |
| H03 | homônimo | 9 | 5 | buscar_territorio×2, listar_indices×1, consultar_sql×1 |
| I01 | período inexistente | 5.7 | 3 | listar_indices×1, buscar_territorio×1 |
| I02 | período inexistente | 7.9 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I03 | período inexistente | 7 | 4 | listar_indices×1, buscar_territorio×1, relatorio_territorio×1 |
| F01 | fora do escopo | 7.9 | 4 | listar_indices×1, buscar_territorio×1, relatorio_territorio×1 |
| F02 | fora do escopo | 6.7 | 2 | listar_indices×1 |
| F03 | fora do escopo | 9 | 4 | listar_indices×1, buscar_territorio×1, relatorio_territorio×1 |

## C01 — conceitual

**Pergunta:** O que é o CDI?

**Esperado:** Índice Combinado de Seca: monitora mês a mês os estágios da seca (Sem seca, Estágios 1 a 3, Recuperação total e parcial), implementado pelo OCA seguindo Cammalleri et al. (2021). Valor = % da área em cada estágio. No tabelão vai de jan/2001 a jan/2026.

**Tempo:** 6.7 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> CDI é a sigla de **Índice Combinado de Seca** (*Combined Drought Index*). É um dos índices climáticos do SEDES. Ele mostra, mês a mês, qual parte (%) da área de um território está em cada situação de seca.
> 
> **Classes do índice:**
> - Sem seca
> - Estágio 1 (seca mais leve)
> - Estágio 2
> - Estágio 3 (o mais grave)
> - Recuperação total
> - Recuperação parcial
> 
> **Como ler:** o valor é a **% da área do território** em cada classe, e as classes somam cerca de 100%. Por exemplo, "30% em Estágio 1" quer dizer que 30% da área está nesse estágio.
> 
> **Cobertura dos dados** (dados do SEDES de 24/07/2026):
> - O tabelão traz dados mensais de janeiro de 2001 a janeiro de 2026.
> - O site usa hoje uma versão recalculada, a cada 10 dias (dias 1, 11 e 21 de cada mês). Por isso, os números do site podem ser diferentes dos do tabelão.
> 
> Se quiser, consulto o CDI de um município, de um estado ou de um período específico.

## C02 — conceitual

**Pergunta:** Quais são as classes do Monitor de Secas da ANA?

**Esperado:** Seis classes, da menos à mais grave: Sem seca, Seca fraca, Seca moderada, Seca grave, Seca extrema, Seca excepcional. Valor = % da área em cada classe.

**Tempo:** 5.9 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O Monitor de Secas da ANA tem 6 classes, da menos para a mais grave:
> 
> 1. Sem seca
> 2. Seca fraca
> 3. Seca moderada
> 4. Seca grave
> 5. Seca extrema
> 6. Seca excepcional
> 
> Cada classe mostra a % da área do território nessa situação, e a soma das classes dá cerca de 100%. O SEDES tem dados mensais de janeiro de 2024 a abril de 2026 (dados do SEDES de 24/07/2026).

## C03 — conceitual

**Pergunta:** O que mede o percentual de pobreza do CadÚnico no SEDES?

**Esperado:** % das famílias inscritas no CadÚnico em situação de pobreza (total, urbana e rural), anual de 2012 a 2025. Não é % da população. Estado e Brasil são média simples dos municípios.

**Tempo:** 6.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O percentual de pobreza do CadÚnico mede **a parcela das famílias inscritas no Cadastro Único que estão em situação de pobreza**. Não é a pobreza da população inteira do território. Só entram as famílias que estão no cadastro. A unidade é "% das famílias do CadÚnico".
> 
> O SEDES tem três versões, todas anuais, de 2012 a 2025:
> 
> - **Pobreza total** (`pob_total`): todas as famílias inscritas.
> - **Pobreza urbana** (`pob_urb`): só as famílias urbanas inscritas.
> - **Pobreza rural** (`pob_rural`): só as famílias rurais inscritas.
> 
> Dois cuidados ao ler os números:
> 
> - Para estados e para o Brasil, o valor é a **média simples dos municípios**. Ela não pesa pelo número de famílias de cada município, então municípios pequenos contam tanto quanto os grandes.
> - Segundo as observações do SEDES, esses três índices foram conferidos e batem com o site.
> 
> Fonte: lista de índices do SEDES (dados do tabelão de 24/07/2026).
> 
> Se quiser, posso consultar o valor de um município ou estado específico.

## C04 — conceitual

**Pergunta:** Quais índices sobre degradação da terra o SEDES tem?

**Esperado:** Dois: Índice de Degradação da Terra (2001 e 2021; níveis 1 a 5 e Conservado) e Dinâmica da Degradação da Terra – ODS 15.3.1 (2021; Degradando, Estável, Melhorando).

**Tempo:** 7.6 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES tem dois índices diretamente sobre degradação da terra e três que ajudam a estudá-la. Os dados são do tabelão de 24/07/2026.
> 
> **Degradação da terra**
> - **Índice de Degradação da Terra** (`deg`): mostra a % da área do território em cada nível, do Nível 5 (mais degradado) ao Nível 1, mais a classe "Conservado". Só tem 2001 e 2021.
> - **Dinâmica da Degradação da Terra, ODS 15.3.1** (`ods`): mostra a % da área que está degradando, estável ou melhorando. Só tem 2021.
> 
> **Dados de apoio**
> - **Cobertura da Terra (IBGE)** (`terraibge`): são 12 classes de uso do solo, como pastagem, área agrícola e vegetação florestal. Tem os anos 2000, 2010, 2014, 2016, 2018 e 2020.
> - **Produção Primária Bruta (MODIS)** (`prodprimariabruta`): mede quanto carbono a vegetação captura por ano. Vai de 2001 a 2025.
> - **Carbono Orgânico do Solo (Embrapa)** (`carbonoembrapa`): mostra o carbono no solo, em faixas de g/kg. Só tem 2020.
> 
> **Cuidados com os números**
> - Nos índices de degradação, os valores de municípios batem com o site. Os de estados e do Brasil diferem, porque o site recalcula pelo Earth Engine.
> - A produção primária bruta foi recalculada no site, e a diferença é grande para municípios.
> 
> Posso consultar algum desses índices para um município ou estado?

## P01 — valor pontual

**Pergunta:** Como estava a seca em Campina Grande (PB) em abril de 2026, segundo o Monitor de Secas?

**Esperado:** Abr/2026, Monitor de Secas: 71,7% da área em seca moderada e 28,3% em seca fraca. Citar a data dos dados (24/07/2026).

**Tempo:** 7.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `consultar_sql: select classe, valor from valores where indice='anaseca' and periodo='2026-04' and territorio='2504009' order by classe`

**Resposta do bot:**

> Em abril de 2026, Campina Grande (PB) estava com seca em toda a sua área, de intensidade fraca a moderada.
> 
> Monitor de Secas (ANA), abril de 2026, % da área do município:
> - **Seca moderada:** 71,7%
> - **Seca fraca:** 28,3%
> - **Sem seca, seca grave, extrema ou excepcional:** 0%
> 
> Ou seja, nenhuma parte do município estava livre de seca. Também não havia áreas nas classes mais graves.
> 
> (Dados do SEDES de 24/07/2026. Abril de 2026 é o último mês do Monitor de Secas no tabelão.)

## P02 — valor pontual

**Pergunta:** Qual era o percentual de pobreza rural em Juazeiro do Norte em 2025?

**Esperado:** 47,3% das famílias rurais do CadÚnico em situação de pobreza (Juazeiro do Norte–CE, 2025).

**Tempo:** 6.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Juazeiro do Norte"}`
1. `consultar_sql: select periodo, valor from valores where indice='pob_rural' and territorio='2307304' and periodo='2025'`

**Resposta do bot:**

> Em 2025, **47,3%** das famílias rurais de Juazeiro do Norte–CE inscritas no CadÚnico estavam em situação de pobreza.
> 
> Fonte: índice Pobreza rural (CadÚnico), 2025, Juazeiro do Norte–CE (dados do SEDES de 24/07/2026). O valor é a porcentagem das famílias rurais do CadÚnico em pobreza. Não é a porcentagem de toda a população rural.

## P03 — valor pontual

**Pergunta:** Quantos registros de seca e estiagem Petrolina teve em 2024?

**Esperado:** 2 registros em 2024 pelo tabelão. Observação: o relatório atual do site mostra 1 (a contagem foi refeita depois). Acerto = 2 com a fonte citada; mencionar a divergência é bônus.

**Tempo:** 5.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Petrolina"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='s2id_secas_estiagens' AND territorio='2611101' AND periodo BETWEEN '2023' AND '2025'`

**Resposta do bot:**

> Petrolina (PE) teve **2 registros** de seca ou estiagem em 2024. Fonte: Registros de secas e estiagens (S2iD), ano de 2024, dados do SEDES de 24/07/2026.
> 
> O valor é uma contagem de registros no ano, não uma porcentagem. Para comparar, 2023 também teve 2 registros e 2025 teve 4.
> 
> O site do SEDES hoje usa uma contagem refeita do S2iD, que pode dar um número diferente. Se quiser, consulto o relatório atual do site.

## P04 — valor pontual

**Pergunta:** Qual é a cobertura da terra predominante em Sobral, no Ceará?

**Esperado:** Vegetação campestre, com 85,9% da área em 2020 (depois vegetação florestal 4,9% e mosaico florestal 4,3%).

**Tempo:** 7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Sobral","uf":"CE"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='terraibge' AND territorio='2312908' AND periodo='2020' ORDER BY valor DESC`

**Resposta do bot:**

> A cobertura predominante em Sobral–CE é a **vegetação campestre**, que ocupa 85,9% da área do município. Vegetação campestre é a vegetação mais baixa e aberta, de arbustos e gramíneas, típica da Caatinga.
> 
> Os demais valores, todos em % da área do município, são:
> - Vegetação florestal: 4,9%
> - Mosaico florestal: 4,3%
> - Mosaico campestre: 3,2%
> - Área artificial (cidade e construções): 1,1%
> - Corpos d'água continentais: 0,6%
> 
> Fonte: Cobertura da Terra (IBGE), ano de 2020, que é o mais recente do índice. Os dados do SEDES são de 24/07/2026. O site recalculou este índice depois, então os valores atuais podem diferir em alguns pontos percentuais.

## P05 — valor pontual

**Pergunta:** Qual era a situação do CDI na Paraíba em janeiro de 2026?

**Esperado:** Jan/2026: Estágio 2 49,5%, Estágio 1 27,1%, Estágio 3 23,3%, Sem seca 0,1%. Ou seja, ~99,9% da área em algum estágio de seca.

**Tempo:** 7.3 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, valor FROM valores WHERE indice='CDI_Test' AND periodo='2026-01' AND territorio='pb' ORDER BY classe`

**Resposta do bot:**

> Em janeiro de 2026, quase toda a Paraíba estava em seca, e quase um quarto do estado estava no estágio mais grave.
> 
> Índice Combinado de Seca (CDI), janeiro de 2026, Paraíba. Os valores são a % da área do estado em cada classe:
> 
> - Sem seca: 0,1%
> - Estágio 1 (mais leve): 27,1%
> - Estágio 2: 49,5%
> - Estágio 3 (o mais grave): 23,3%
> - Recuperação total ou parcial: 0%
> 
> Ou seja, cerca de 99,9% do território estava com algum nível de seca. O estágio 2 era o mais comum, com cerca de metade da área.
> 
> Esses dados são do tabelão do SEDES, de 24/07/2026, e a série mensal vai até janeiro de 2026. O site hoje usa uma versão do CDI calculada a cada dez dias e refeita, então os números de lá podem ser um pouco diferentes.

## P06 — valor pontual

**Pergunta:** Qual é o PIB de Campina Grande?

**Esperado:** O tabelão não tem PIB. O relatório do site tem (índice produto-interno-bruto): cerca de R$ 12,9 bilhões em 2023. Acerto = buscar no relatório; também vale dizer que o tabelão não tem e oferecer o relatório. Errado = inventar um número.

**Tempo:** 6.8 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"2504009","periodo":"2023","indice":"pib"}`

**Resposta do bot:**

> O PIB de Campina Grande–PB em 2023 foi de cerca de **R$ 12,9 bilhões** (R$ 12.908.743.351). É o dado mais recente do índice Produto Interno Bruto no relatório atual do site, calculado em 12/11/2026. O tabelão do SEDES não tem esse índice.
> 
> Outros anos da série:
> - 2010: R$ 5,0 bilhões
> - 2020: R$ 10,1 bilhões
> 
> Os valores são nominais, ou seja, não estão corrigidos pela inflação. Por isso, a diferença entre os anos não mostra só o crescimento real da economia.

## R01 — ranking

**Pergunta:** Quais os 5 municípios da Paraíba com maior percentual de pobreza total em 2025?

**Esperado:** Juarez Távora 74,2%, Curral de Cima 73,9%, Santa Inês 73,2%, Cacimbas 73,1%, Pedro Régis 72,8%.

**Tempo:** 7.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB' ORDER BY v.valor DESC LIMIT 5`

**Resposta do bot:**

> Os cinco municípios da Paraíba com maior percentual de pobreza total em 2025 são:
> 
> | Posição | Município | Famílias em pobreza |
> |---|---|---|
> | 1º | Juarez Távora | 74,2% |
> | 2º | Curral de Cima | 73,9% |
> | 3º | Santa Inês | 73,2% |
> | 4º | Cacimbas | 73,1% |
> | 5º | Pedro Régis | 72,8% |
> 
> Os dados são do índice Pobreza total (CadÚnico), ano de 2025, e vêm do tabelão do SEDES de 24/07/2026. O valor é a porcentagem das famílias inscritas no CadÚnico que estão em situação de pobreza. Não é a porcentagem da população total do município.

## R02 — ranking

**Pergunta:** Quais municípios do Semiárido tinham mais área em seca grave ou pior no Monitor de Secas em abril de 2026?

**Esperado:** 41 municípios do Semiárido estavam com 100% da área em seca grave ou pior em abr/2026 (33 no PI, 6 no CE, 2 no RN), por exemplo Tibau e Baraúna (RN), Russas e Limoeiro do Norte (CE), Wall Ferraz (PI). Acerto = dizer que há empate em 100% e dar exemplos.

**Tempo:** 10.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, ROUND(SUM(v.valor),1) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='anaseca' AND v.periodo='2026-04' AND v.classe>=4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY t.codigo ORDER BY pct DESC LIMIT 15`
1. `consultar_sql: WITH x AS (SELECT t.codigo, t.uf, SUM(v.valor) pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='anaseca' AND v.periodo='2026-04' AND v.classe>=4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY t.codigo) SELECT uf, COUNT(*) total, SUM(pct>=99.5) com_100 FROM x GROUP BY uf UNION ALL SELECT 'TOTAL', COUNT(*), SUM(pct>=99.5) FROM x`

**Resposta do bot:**

> Em abril de 2026, 41 municípios do Semiárido tinham 100% da área em seca grave, extrema ou excepcional. Os dados são do Monitor de Secas (ANA) e foram consultados no tabelão do SEDES de 24/07/2026. Considerei os 1.477 municípios do Semiárido que têm dado nesse mês e somei as classes "grave", "extrema" e "excepcional".
> 
> Os 41 municípios empatam no topo, então não há um ranking de verdade entre eles. Por estado:
> - **Piauí:** 33 municípios, entre eles Wall Ferraz, Vera Mendes, Sussuapara, São Miguel do Fidalgo, São Luis do Piauí, São José do Piauí e São João da Varjota.
> - **Ceará:** 6 municípios: Tabuleiro do Norte, Russas, Quixeré, Limoeiro do Norte, Jaguaruana e Itaiçaba.
> - **Rio Grande do Norte:** 2 municípios: Tibau e Baraúna.
> 
> Nos outros estados do Semiárido, nenhum município chegou a 100% nessas classes.
> 
> Se quiser, posso listar todos os 41 nomes ou comparar com outro mês.

## R03 — ranking

**Pergunta:** Quais estados tinham a maior parte da área em seca pelo CDI em janeiro de 2026?

**Esperado:** CDI jan/2026, soma dos Estágios 1 a 3: Paraíba 99,9%, Rio Grande do Norte 98,2%, Pernambuco 97,6%, Goiás 96,1%, Piauí 95,5%.

**Tempo:** 8.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT v.territorio, t.nome, SUM(v.valor) AS seca, MAX(CASE WHEN v.classe=4 THEN v.valor END) AS e3 FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='CDI_Test' AND v.periodo='2026-01' AND t.tipo='estado' AND v.classe IN (2,3,4) GROUP BY v.territorio ORDER BY seca DESC LIMIT 8`

**Resposta do bot:**

> Em janeiro de 2026, Paraíba, Rio Grande do Norte e Pernambuco tinham quase toda a área em seca pelo CDI (Índice Combinado de Seca).
> 
> Somei os três estágios de seca (1, 2 e 3) como % da área de cada estado:
> 
> | Estado | Área em seca (estágios 1 a 3) | Só no Estágio 3 (o mais grave) |
> |---|---|---|
> | Paraíba | 99,9% | 23,3% |
> | Rio Grande do Norte | 98,2% | 13,4% |
> | Pernambuco | 97,6% | 17,3% |
> | Goiás | 96,1% | 0,1% |
> | Piauí | 95,5% | 3,8% |
> | Maranhão | 95,3% | 4,3% |
> | Ceará | 88,4% | 28,5% |
> | Distrito Federal | 85,8% | 0,0% |
> 
> - O Ceará tem a maior fatia no Estágio 3 (28,5%), embora não esteja entre os três primeiros no total.
> - Não contei as classes de "recuperação" como seca.
> - O CDI do tabelão é mensal. O site usa hoje uma versão decendial recalculada, então os números de lá podem ser diferentes.
> 
> Fonte: CDI – Índice Combinado de Seca, janeiro de 2026, estados (dados do SEDES de 24/07/2026).

## R04 — ranking

**Pergunta:** No bioma Caatinga, quais municípios tiveram mais registros de seca e estiagem em 2025?

**Esperado:** Coronel José Dias, Curral Novo do Piauí, Dirceu Arcoverde e São Lourenço do Piauí (todos no PI), com 7 registros cada em 2025; vários outros do PI com 6.

**Tempo:** 8.3 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='s2id_secas_estiagens' AND v.periodo='2025' AND t.tipo='municipio' AND t.bioma LIKE '%Caatinga%' ORDER BY v.valor DESC LIMIT 15`

**Resposta do bot:**

> Em 2025, os municípios do bioma Caatinga com mais registros de seca e estiagem ficaram no Piauí. Os dados são do índice "Registros de secas e estiagens (S2iD)", ano de 2025, e é uma contagem de registros no ano. Eles vêm do tabelão do SEDES de 24/07/2026.
> 
> **Topo do ranking (7 registros cada):**
> - Curral Novo do Piauí–PI
> - Coronel José Dias–PI
> - São Lourenço do Piauí–PI
> - Dirceu Arcoverde–PI
> 
> **Com 6 registros:**
> - Itainópolis–PI
> - Belém do Piauí–PI
> - Alegrete do Piauí–PI
> - Acauã–PI
> - São Francisco de Assis do Piauí–PI
> - Dom Inocêncio–PI
> - Lagoa do Barro do Piauí–PI
> 
> **Com 5 registros:**
> - Taquaritinga do Norte–PE
> - Santa Cruz do Capibaribe–PE
> - Toritama–PE
> - Águas Belas–PE
> 
> Dois cuidados ao ler a lista:
> - Usei os municípios cujo bioma predominante é a Caatinga.
> - O site hoje usa uma contagem refeita do S2iD, que difere da do tabelão. Os números podem mudar um pouco no site.

## R05 — ranking

**Pergunta:** Qual estado do Nordeste tem a maior parte da área degradando, segundo o ODS 15.3.1?

**Esperado:** Sergipe, com 33,3% da área degradando (2021). Depois Bahia 18,4% e Alagoas 16,1%. Observação: os números de estado do tabelão diferem do site para este índice.

**Tempo:** 8.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='ods' AND v.classe=1 AND t.tipo='estado' AND t.regiao LIKE '%Nordeste%' ORDER BY v.valor DESC`

**Resposta do bot:**

> **Sergipe** é o estado do Nordeste com a maior parte da área em degradação: 33,3% do território. Esse é o valor de "Degradando" no índice de Dinâmica da Degradação da Terra (ODS 15.3.1), ano de 2021 (dados do SEDES de 24/07/2026). O número é a porcentagem da área do estado nessa classe.
> 
> Os outros estados, do maior para o menor:
> 
> | Estado | Área degradando (2021) |
> |---|---|
> | Bahia | 18,4% |
> | Alagoas | 16,1% |
> | Pernambuco | 15,4% |
> | Maranhão | 13,4% |
> | Paraíba | 12,7% |
> | Ceará | 12,1% |
> | Rio Grande do Norte | 11,9% |
> | Piauí | 10,3% |
> 
> Os valores de estados desse índice no tabelão diferem um pouco dos do relatório atual do site, que recalcula pelo Earth Engine. Não consultei o site, então a ordem pode mudar se ele estiver mais atualizado. O índice só tem o ano de 2021.

## T01 — tendência

**Pergunta:** Como evoluiu a pobreza total em Campina Grande de 2012 a 2025?

**Esperado:** Caiu de 79,1% em 2012 para 36,9% em 2025, com queda forte até 2017 (45,2%), estabilidade perto de 40% e um pico em 2022 (45,5%).

**Tempo:** 7.8 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='pob_total' AND territorio='2504009' ORDER BY periodo`

**Resposta do bot:**

> A pobreza total em Campina Grande–PB caiu bastante: de 79,1% das famílias inscritas no CadÚnico em 2012 para 36,9% em 2025. Isso equivale a menos da metade do valor inicial.
> 
> Os números são do índice Pobreza total (CadÚnico), que mostra a % das famílias inscritas no CadÚnico em situação de pobreza. Não é a % de toda a população. Dados do SEDES de 24/07/2026.
> 
> | Ano | % |
> |---|---|
> | 2012 | 79,1 |
> | 2013 | 72,3 |
> | 2014 | 62,8 |
> | 2015 | 50,8 |
> | 2016 | 47,1 |
> | 2017 | 45,2 |
> | 2018 | 42,3 |
> | 2019 | 40,9 |
> | 2020 | 41,0 |
> | 2021 | 39,3 |
> | 2022 | 45,5 |
> | 2023 | 39,5 |
> | 2024 | 39,7 |
> | 2025 | 36,9 |
> 
> - **Queda forte de 2012 a 2016:** o índice foi de 79,1% para 47,1%.
> - **Queda lenta de 2017 a 2021:** o índice ficou entre 45,2% e 39,3%.
> - **Alta em 2022:** subiu para 45,5%, mas voltou a 39,5% em 2023.
> - **Estabilidade em 2023 e 2024, e mínimo em 2025:** o índice ficou perto de 39,5% e chegou a 36,9% em 2025, o menor valor da série.

## T02 — tendência

**Pergunta:** A seca no Ceará piorou ou melhorou entre janeiro e abril de 2026, pelo Monitor de Secas?

**Esperado:** Melhorou: em janeiro havia 27,3% em seca extrema e 20,9% em grave; em abril não havia seca extrema, só 6,7% em grave, e a maior parte em seca fraca (52,1%) ou moderada (41,2%).

**Tempo:** 7.7 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, classe, valor FROM valores WHERE indice='anaseca' AND territorio='ce' AND periodo IN ('2026-01','2026-04') ORDER BY periodo, classe`

**Resposta do bot:**

> A seca no Ceará **melhorou** entre janeiro e abril de 2026. A seca mais forte perdeu área e a mais fraca ganhou.
> 
> Percentual da área do Ceará em cada classe do Monitor de Secas (ANA):
> 
> | Classe | Janeiro/2026 | Abril/2026 |
> |---|---|---|
> | Seca fraca | 2,2% | 52,1% |
> | Seca moderada | 49,6% | 41,2% |
> | Seca grave | 20,9% | 6,7% |
> | Seca extrema | 27,3% | 0,0% |
> | Seca excepcional | 0,0% | 0,0% |
> 
> - A seca extrema, que cobria 27,3% do estado, desapareceu em abril.
> - A seca grave caiu de 20,9% para 6,7%.
> - Em abril, a maior parte do estado (52,1%) estava com seca fraca.
> - Nos dois meses, nenhuma parte do estado ficou sem seca (0,0%).
> 
> O Ceará melhorou, mas continuou com seca em toda a área.
> 
> Fonte: Monitor de Secas (ANA), Ceará, janeiro e abril de 2026 (dados do SEDES de 24/07/2026). Os valores são a % da área do estado em cada classe.

## T03 — tendência

**Pergunta:** Em que ano o Brasil teve mais registros de seca e estiagem?

**Esperado:** 2013, com 3.275 registros. Depois vêm 2025 (2.780) e 2017 (2.760). Ressalva: faltam 2010–2012, 2014 e 2016 no tabelão.

**Tempo:** 7.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='s2id_secas_estiagens' AND territorio='br' ORDER BY valor DESC`

**Resposta do bot:**

> Em 2013 o Brasil teve mais registros de seca e estiagem: **3.275 registros** no ano. Os dados são do S2iD (sistema da Defesa Civil), no índice "Registros de secas e estiagens", e a soma é de todos os municípios (dados do SEDES de 24/07/2026).
> 
> Os anos seguintes com mais registros foram:
> - 2025: 2.780
> - 2017: 2.760
> - 2021: 2.753
> 
> Há dois limites nessa resposta:
> - Os anos 2010, 2011, 2012, 2014 e 2016 não estão no tabelão. Algum deles pode ter tido mais registros que 2013.
> - O site do SEDES usa hoje uma contagem refeita, que difere desta. Os números podem mudar nessa versão.
> 
> Posso consultar o relatório atual do site para conferir a contagem refeita, se você quiser.

## T04 — tendência

**Pergunta:** Em que mês de 2025 a Paraíba teve a maior área em seca pelo CDI?

**Esperado:** Dezembro de 2025, com 62,8% da área em algum estágio de seca; depois maio (36,4%) e junho (28,1%).

**Tempo:** 7.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor END) AS seca_total, SUM(CASE WHEN classe=4 THEN valor END) AS estagio3 FROM valores WHERE indice='CDI_Test' AND territorio='pb' AND periodo BETWEEN '2025-01' AND '2025-12' GROUP BY periodo ORDER BY seca_total DESC`

**Resposta do bot:**

> **Dezembro de 2025** teve a maior área em seca na Paraíba pelo CDI (Índice Combinado de Seca). Nesse mês, 62,8% do território estava em seca, somando os Estágios 1, 2 e 3.
> 
> O segundo maior foi maio de 2025, com 36,4%. Janeiro e fevereiro ficaram em 0%.
> 
> Se você olhar só o estágio mais grave (Estágio 3), o pico foi em maio, com 1,1% da área. Em dezembro, o Estágio 3 não aparece.
> 
> A fonte é o CDI mensal, território Paraíba (PB), com dados do SEDES de 24/07/2026. O site hoje usa uma versão decendial (a cada 10 dias) recalculada, então os números lá podem ser diferentes.

## X01 — cruzamento

**Pergunta:** Quais municípios do Semiárido estavam com mais de 90% da área em seca grave ou pior em abril de 2026 e também têm pobreza total acima de 60% em 2025?

**Esperado:** Cinco municípios, todos no Piauí: Wall Ferraz (pobreza 68,8%), Aroeiras do Itaim (67,0%), Jaicós (64,9%), Santa Rosa do Piauí (61,5%) e Sussuapara (61,0%), todos com 100% da área em seca grave ou pior.

**Tempo:** 8.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH s AS (SELECT territorio, SUM(valor) seca FROM valores WHERE indice='anaseca' AND periodo='2026-04' AND classe>=4 GROUP BY territorio) SELECT t.nome, t.uf, ROUND(s.seca,1) seca_grave_ou_pior, ROUND(p.valor,1) pobreza FROM s JOIN territorios t ON t.codigo=s.territorio AND t.tipo='municipio' AND t.semiarido=1 JOIN valores p ON p.indice='pob_total' AND p.periodo='2025' AND p.territorio=s.territorio WHERE s.seca>90 AND p.valor>60 ORDER BY s.seca DESC, p.valor DESC`

**Resposta do bot:**

> Cinco municípios do Semiárido atendem aos dois critérios, todos no Piauí. Em abril de 2026, 100% da área de cada um estava em seca grave, extrema ou excepcional. Em 2025, mais de 60% das famílias inscritas no CadÚnico de cada um estavam em situação de pobreza.
> 
> | Município | Área em seca grave ou pior (abr/2026) | Famílias em pobreza (2025) |
> |---|---|---|
> | Wall Ferraz–PI | 100,0% | 68,8% |
> | Aroeiras do Itaim–PI | 100,0% | 67,0% |
> | Jaicós–PI | 100,0% | 64,9% |
> | Santa Rosa do Piauí–PI | 100,0% | 61,5% |
> | Sussuapara–PI | 100,0% | 61,0% |
> 
> **Fontes e significado dos números:**
> - **Seca:** Monitor de Secas (ANA), abril de 2026. É a soma das classes seca grave, extrema e excepcional, em % da área do município. Abril de 2026 é o último mês do tabelão.
> - **Pobreza:** Pobreza total (CadÚnico), 2025. É a % das famílias inscritas no CadÚnico em situação de pobreza.
> - Dados do SEDES de 24/07/2026.

## X02 — cruzamento

**Pergunta:** Entre os municípios com mais da metade da área nos níveis 3 a 5 de degradação em 2021, quais têm a maior pobreza rural em 2025?

**Esperado:** 2.268 municípios têm mais da metade da área nos níveis 3 a 5. Os de maior pobreza rural em 2025: Campo Grande–AL (81,0%), Potiraguá–BA (79,9%), Senador Elói de Souza–RN (79,7%), Colônia Leopoldina–AL (78,0%), Feira Nova–PE (77,9%). Atenção: o nível 5 é o mais degradado; as classes 1 a 3 do tabelão são os níveis 5, 4 e 3.

**Tempo:** 10.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH d AS (SELECT territorio, SUM(valor) s FROM valores WHERE indice='deg' AND periodo='2021' AND classe IN (1,2,3) GROUP BY territorio HAVING s>50) SELECT t.nome, t.uf, ROUND(d.s,1) deg, p.valor pob FROM d JOIN territorios t ON t.codigo=d.territorio AND t.tipo='municipio' JOIN valores p ON p.territorio=d.territorio AND p.indice='pob_rural' AND p.periodo='2025' ORDER BY p.valor DESC LIMIT 15;`
1. `consultar_sql: WITH d AS (SELECT territorio, SUM(valor) s FROM valores WHERE indice='deg' AND periodo='2021' AND classe IN (1,2,3) GROUP BY territorio HAVING s>50) SELECT COUNT(*) n, (SELECT COUNT(*) FROM d JOIN valores p ON p.territorio=d.territorio AND p.indice='pob_rural' AND p.periodo='2025') com_pob FROM d JOIN territorios t ON t.codigo=d.territorio AND t.tipo='municipio';`

**Resposta do bot:**

> Entre os municípios com mais de 50% da área nos níveis 3, 4 e 5 de degradação em 2021, estes 10 têm a maior pobreza rural em 2025. São 2.268 municípios nesse grupo.
> 
> | Município | % da área nos níveis 3–5 (2021) | Pobreza rural (2025) |
> |---|---|---|
> | Campo Grande–AL | 89,1% | 81,0% |
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
> - **Degradação:** usei o Índice de Degradação da Terra de 2021. O valor é a soma dos níveis 3, 4 e 5, em % da área do município.
> - **Pobreza rural:** usei o índice de Pobreza rural (CadÚnico) de 2025. O valor é a % das famílias rurais inscritas no CadÚnico que estão em situação de pobreza.
> 
> Fonte: tabelão do SEDES, dados de 24/07/2026.

## X03 — cruzamento

**Pergunta:** Na Paraíba, os municípios com mais pobreza em 2025 tiveram mais registros de seca em 2025?

**Esperado:** Não: dividindo os 223 municípios da PB em quatro faixas de pobreza, a média de registros fica em ~1,2 em todas. Não há relação visível. Acerto = conclusão de "sem relação clara" baseada nos dados.

**Tempo:** 12.3 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH p AS (SELECT v.territorio, v.valor pob FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB'), s AS (SELECT territorio, valor sec FROM valores WHERE indice='s2id_secas_estiagens' AND periodo='2025') SELECT (SELECT count(*) FROM p) n_pob, (SELECT count(*) FROM p JOIN s USING(territorio)) n_com_s2id, (SELECT count(*) FROM s JOIN territorios t ON t.codigo=s.territorio WHERE t.uf='PB' AND t.tipo='municipio') n_s2id_pb;`
1. `consultar_sql: WITH p AS (SELECT v.territorio, v.valor pob FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.tipo='municipio' AND t.uf='PB'), s AS (SELECT territorio, valor sec FROM valores WHERE indice='s2id_secas_estiagens' AND periodo='2025'), r AS (SELECT p.territorio, pob, COALESCE(sec,0) sec, NTILE(4) OVER (ORDER BY pob DESC) q FROM p LEFT JOIN s USING(territorio)) SELECT q, count(*) n, round(min(pob),1) pmin, round(max(pob),1) pmax, round(avg(sec),2) media_reg, sum(sec) total_reg, sum(sec>0) com_reg FROM r GROUP BY q;`

**Resposta do bot:**

> **Não. Na Paraíba, os municípios mais pobres em 2025 não tiveram mais registros de seca do que os demais.**
> 
> Dividi os 223 municípios da Paraíba em 4 grupos de tamanho parecido, do mais pobre ao menos pobre. Usei a pobreza total do CadÚnico, que é a % de famílias inscritas em situação de pobreza, e os registros de secas e estiagens do S2iD, que são contagens no ano. Ambos são de 2025.
> 
> | Grupo | Pobreza das famílias | Média de registros por município | Municípios com ao menos 1 registro |
> |---|---|---|---|
> | 1 (mais pobres) | 62,8% a 74,2% | 1,16 | 32 de 56 |
> | 2 | 58,6% a 62,7% | 1,16 | 35 de 56 |
> | 3 | 52,9% a 58,6% | 1,21 | 36 de 56 |
> | 4 (menos pobres) | 34,5% a 52,9% | 1,20 | 34 de 55 |
> 
> As médias são praticamente iguais nos quatro grupos, e o total de registros também (65 a 68 por grupo). Isso indica que, em 2025, a quantidade de registros não acompanhou o nível de pobreza dos municípios.
> 
> Esta análise compara grupos e não mede a correlação entre os dois índices. Um registro no S2iD depende também de o município pedir o reconhecimento da situação, então ele não mede a intensidade da seca. O tabelão usa uma contagem do S2iD que difere da versão atual do site.
> 
> Fontes: pobreza total (CadÚnico) e registros de secas e estiagens (S2iD), 2025, municípios da Paraíba (dados do SEDES de 24/07/2026).

## A01 — recorte agregado

**Pergunta:** Como estava a seca no bioma Caatinga em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, bioma Caatinga: seca moderada 55,0%, seca fraca 34,8%, sem seca 5,3% e seca grave 4,9%.

**Tempo:** 6.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: select classe, valor from valores where indice='anaseca' and periodo='2026-04' and territorio='3_bioma-caatinga' order by classe`

**Resposta do bot:**

> Em abril de 2026, a maior parte do bioma Caatinga estava com seca moderada. Segundo o Monitor de Secas (ANA), a divisão da área foi:
> 
> | Classe | % da área |
> |---|---|
> | Sem seca | 5,3% |
> | Seca fraca | 34,8% |
> | Seca moderada | 55,0% |
> | Seca grave | 4,9% |
> | Seca extrema | 0,0% |
> | Seca excepcional | 0,0% |
> 
> Cerca de 94,7% da área tinha algum grau de seca, mas quase toda era fraca ou moderada. Não havia seca extrema nem excepcional.
> 
> Os valores são o percentual da área do bioma em cada classe. Os dados são do SEDES de 24/07/2026.

## A02 — recorte agregado

**Pergunta:** Qual é o percentual de pobreza total na região Nordeste?

**Esperado:** O tabelão não tem valor próprio da região para pobreza. A média simples dos municípios do Nordeste em 2025 é 57,9% (o relatório do site dá o mesmo 57,9%). Por estado, vai de 52,9% (RN) a 64,6% (MA). Acerto = 57,9% com a ressalva da média, ou faixa por estado.

**Tempo:** 8.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"2_regiao-nordeste","periodo":"2025","indice":"pobreza-total"}`
1. `consultar_sql: SELECT ROUND(AVG(v.valor),1) media, COUNT(*) n FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.tipo='municipio' AND t.regiao LIKE '%Nordeste%'`

**Resposta do bot:**

> Em 2025, **57,9%** das famílias do Nordeste inscritas no CadÚnico estavam em situação de pobreza.
> 
> - **Índice e território:** Pobreza total (CadÚnico), 2025, região Nordeste.
> - **O que o número mede:** é a porcentagem das famílias inscritas no CadÚnico que estão em situação de pobreza. Não é a porcentagem da população total.
> - **Fonte do número:** vem do relatório atual do site, calculado em 12/11/2026. A média simples dos 1.794 municípios nordestinos no tabelão (dados de 24/07/2026) dá o mesmo resultado. Essa média não pesa pelo número de famílias de cada município.
> 
> A série recente do Nordeste no relatório do site:
> 
> | Ano | Pobreza total |
> |---|---|
> | 2022 | 70,6% |
> | 2023 | 61,8% |
> | 2024 | 59,7% |
> | 2025 | 57,9% |
> 
> A pobreza vem caindo desde 2022.

## A03 — recorte agregado

**Pergunta:** Qual parte do Brasil estava em seca em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, Brasil: 58,4% sem seca, 26,4% seca fraca, 14,4% moderada, 0,9% grave. Ou seja, ~41,6% da área com algum grau de seca.

**Tempo:** 7.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: select classe, valor from valores where indice='anaseca' and periodo='2026-04' and territorio='br' order by classe`

**Resposta do bot:**

> Em abril de 2026, cerca de 41,6% do território brasileiro estava com algum grau de seca. Os outros 58,4% estavam sem seca.
> 
> Valores do Monitor de Secas (ANA), abril de 2026, Brasil, em % da área do país:
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
> A maior parte da área em seca era de seca fraca ou moderada. A seca grave ficou abaixo de 1%, e não houve seca extrema nem excepcional.
> 
> Os 41,6% são a soma das classes de seca fraca a excepcional (26,36 + 14,37 + 0,87).
> 
> (Dados do SEDES de 24/07/2026.)
> 
> Se quiser, posso mostrar quais estados ou regiões tinham mais área em seca.

## A04 — recorte agregado

**Pergunta:** Como está a degradação da terra no Semiárido?

**Esperado:** O tabelão não tem o Semiárido para degradação. O relatório do site (5_semiarido-semiarido-total, 2021) dá: Conservado 75,5%, Nível 3 12,7%, Nível 4 7,4%, Nível 2 3,9%, Nível 5 0,3%, Nível 1 0,2%; ODS: 7,9% degradando. Acerto = usar o relatório, ou dizer que não há o recorte e oferecer média dos municípios com ressalva.

**Tempo:** 9.8 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"5_semiarido-semiarido-total","periodo":"2021","indice":"degradacao"}`

**Resposta do bot:**

> A degradação da terra no Semiárido aumentou entre 2001 e 2021, mas a maior parte da área ainda está conservada. Os números abaixo são do relatório atual do site, calculado em 12/11/2026. O tabelão do SEDES, de 24/07/2026, não tem valor próprio para o Semiárido nesses índices.
> 
> **Índice de Degradação da Terra** (% da área do Semiárido):
> 
> | Classe | 2001 | 2021 |
> |---|---|---|
> | Conservado | 81,8% | 75,5% |
> | Nível 1 (menos degradado) | 0,1% | 0,2% |
> | Nível 2 | 1,8% | 3,9% |
> | Nível 3 | 10,4% | 12,7% |
> | Nível 4 | 5,7% | 7,4% |
> | Nível 5 (mais degradado) | 0,3% | 0,3% |
> 
> - A área conservada caiu 6,3 pontos percentuais em 20 anos.
> - Os níveis 2, 3 e 4 cresceram.
> 
> **Dinâmica da Degradação (ODS 15.3.1), 2021:**
> - 91,6% da área está estável.
> - 7,9% está degradando.
> - 0,5% está melhorando.
> 
> A dinâmica da degradação só existe para 2021. Por isso ela mostra a situação daquele ano e não permite comparar com anos anteriores.

## H01 — homônimo

**Pergunta:** Como está a seca em Santa Luzia?

**Esperado:** Perguntar qual Santa Luzia: há quatro (BA, MA, MG e PB). Não pode escolher uma sozinho.

**Tempo:** 5.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Santa Luzia"}`

**Resposta do bot:**

> Há quatro municípios chamados Santa Luzia. De qual você fala?
> 
> - Santa Luzia–BA
> - Santa Luzia–MA
> - Santa Luzia–MG
> - Santa Luzia–PB (no Semiárido, bioma Caatinga)
> 
> Quando você me disser a UF, eu consulto a situação da seca.

## H02 — homônimo

**Pergunta:** Qual é o percentual de pobreza em Bom Jesus em 2025?

**Esperado:** Perguntar qual Bom Jesus (PB, PI, RN, RS, SC) ou listar as cinco: PB 51,4%, PI 54,5%, RN 56,6%, RS 45,0%, SC 37,9%.

**Tempo:** 5.3 s · **turnos:** 3

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Bom Jesus"}`
1. `listar_indices: {}`

**Resposta do bot:**

> Há cinco municípios chamados Bom Jesus. Qual deles você quer?
> 
> - Bom Jesus – PB
> - Bom Jesus – PI
> - Bom Jesus – RN
> - Bom Jesus – RS
> - Bom Jesus – SC
> 
> Assim que você escolher, eu busco o percentual de famílias em situação de pobreza no CadÚnico em 2025. Também posso mostrar os cinco lado a lado, se preferir.

## H03 — homônimo

**Pergunta:** E o CDI de São Domingos da Paraíba em janeiro de 2026?

**Esperado:** O usuário já deu a UF. São Domingos–PB, CDI jan/2026: 97,7% da área no Estágio 3 e 2,3% no Estágio 2.

**Tempo:** 9 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"São Domingos da Paraíba"}`
1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"São Domingos","uf":"PB"}`
1. `consultar_sql: SELECT classe, valor FROM valores WHERE indice='CDI_Test' AND periodo='2026-01' AND territorio='2513968' ORDER BY classe`

**Resposta do bot:**

> Em janeiro de 2026, quase todo o município estava em seca grave, segundo o CDI (Índice Combinado de Seca). O SEDES não tem um município chamado "São Domingos da Paraíba". Usei **São Domingos–PB**, o único com esse nome na Paraíba.
> 
> Percentual da área do município em cada classe:
> 
> - **Estágio 3 (o mais grave): 97,7%**
> - Estágio 2: 2,3%
> - Sem seca, Estágio 1, recuperação total e recuperação parcial: 0%
> 
> Fonte: CDI, janeiro de 2026, dados do SEDES de 24/07/2026. O site hoje usa uma versão do CDI recalculada a cada 10 dias, então os números lá podem ser um pouco diferentes.

## I01 — período inexistente

**Pergunta:** Qual era o CDI de Campina Grande em 1995?

**Esperado:** Não há: o CDI no tabelão começa em janeiro de 2001. Pode oferecer o primeiro ano disponível.

**Tempo:** 5.7 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande"}`

**Resposta do bot:**

> O SEDES não tem o CDI (Índice Combinado de Seca) de 1995. A série do CDI começa em janeiro de 2001 e vai até janeiro de 2026 (dados do SEDES de 24/07/2026).
> 
> Posso buscar o CDI de Campina Grande–PB em 2001, que é o primeiro ano disponível, ou em outro mês ou ano que você queira. O valor mostra a % da área do município em cada classe: sem seca, estágios 1 a 3 de seca, recuperação total e recuperação parcial.

## I02 — período inexistente

**Pergunta:** Como estava o Monitor de Secas em Patos (PB) em dezembro de 2026?

**Esperado:** Não existe dezembro de 2026 (ainda não aconteceu). O tabelão vai até abr/2026 (Patos: 100% seca moderada); o relatório do site tem até set/2026 (82,5% seca grave, 17,5% moderada). Errado = inventar o dado de dezembro.

**Tempo:** 7.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Patos","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, valor FROM valores WHERE indice='anaseca' AND periodo='2026-04' AND territorio='2510808' ORDER BY classe`

**Resposta do bot:**

> O SEDES não tem dados de dezembro de 2026. Hoje é 12/11/2026, então esse mês ainda não aconteceu. O Monitor de Secas (ANA) no tabelão vai de janeiro de 2024 a abril de 2026.
> 
> O último dado disponível é de abril de 2026. Nesse mês, 100% da área de Patos–PB estava em seca moderada. Os valores são o % da área do município em cada classe de seca, e as outras classes (sem seca, fraca, grave, extrema e excepcional) tinham 0%. Fonte: Monitor de Secas (ANA), dados do SEDES de 24/07/2026.
> 
> Posso consultar o relatório atual do site, que é calculado na hora, para ver se há um mês mais recente que abril. Também posso mostrar como a seca evoluiu em Patos nos últimos meses.

## I03 — período inexistente

**Pergunta:** Quantos registros de seca Petrolina teve em 2011?

**Esperado:** O tabelão não tem 2011 para este índice (pula de 2009 para 2013). O relatório do site tem a série desde 1991 e mostra 0 registros em 2011 para Petrolina. Acerto = dizer que falta no tabelão e usar o relatório, ou só dizer que não há o ano.

**Tempo:** 7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Petrolina"}`
1. `relatorio_territorio: {"chave":"2611101","periodo":"2011","indice":"registros-de-secas"}`

**Resposta do bot:**

> Petrolina–PE teve **0 registros** de seca ou estiagem em 2011, segundo o relatório atual do site do SEDES, calculado em 12/11/2026. O índice é "Registros de secas e estiagens (S2iD)", uma contagem de registros no ano.
> 
> - O tabelão (dados do SEDES de 24/07/2026) não tem o ano de 2011 para esse índice. Por isso usei o relatório do site.
> - O site usa uma contagem refeita, que pode diferir da do tabelão.
> - Nos anos que o relatório mostra, de 2014 a 2025, Petrolina tem 1 registro por ano.

## F01 — fora do escopo

**Pergunta:** Qual é a população de Campina Grande?

**Esperado:** O SEDES não tem dado de população. Dizer isso, sem inventar número.

**Tempo:** 7.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `relatorio_territorio: {"chave":"2504009","periodo":"2025","indice":"popula"}`

**Resposta do bot:**

> O SEDES não tem a população de Campina Grande–PB. Procurei no tabelão (dados de 24/07/2026) e no relatório atual do site, e nenhum dos dois tem um índice de população ou de habitantes. Não vou dar um número de outra fonte, porque o SEDES não o confirma.
> 
> Para Campina Grande, o SEDES tem estes dados:
> - seca (Monitor de Secas da ANA, CDI e Cemaden);
> - degradação da terra e cobertura da terra;
> - aridez;
> - pobreza (% de famílias no CadÚnico);
> - PIB, IDH, analfabetismo e mortalidade infantil (no relatório do site).
> 
> Se quiser, consulto algum desses para o município.

## F02 — fora do escopo

**Pergunta:** Vai chover amanhã em Fortaleza?

**Esperado:** O SEDES não tem previsão diária do tempo. Tem previsões mensais e trimestrais de anomalia de chuva no site; no tabelão só uma previsão antiga (mai–out/2026). Não pode responder se chove amanhã.

**Tempo:** 6.7 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> Não consigo dizer se vai chover amanhã em Fortaleza. O SEDES não tem previsão do tempo diária. Ele trabalha com índices mensais e anuais, como seca, anomalia de chuva e degradação da terra. Para saber de amanhã, consulte o INMET, o CPTEC/INPE ou a Funceme (órgão de meteorologia do Ceará).
> 
> Posso mostrar, se você quiser:
> - **Monitor de Secas (ANA):** a situação de seca em Fortaleza. O último mês disponível no tabelão é abril de 2026.
> - **Previsão mensal de anomalia de chuva (CPTEC/INPE):** indica se o mês tende a ser mais seco ou mais chuvoso que o normal. Não é previsão de um dia específico, e a que está no tabelão é antiga: cobre maio a outubro de 2026. Para uma previsão mais atual, eu poderia consultar o relatório do site.
> 
> Qual dessas você quer ver?

## F03 — fora do escopo

**Pergunta:** Qual é a taxa de desemprego em Recife?

**Esperado:** O SEDES não tem desemprego. Dizer isso, sem inventar.

**Tempo:** 9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Recife"}`
1. `relatorio_territorio: {"chave":"2611606","periodo":"2026"}`

**Resposta do bot:**

> O SEDES não tem a taxa de desemprego de Recife. Procurei no tabelão e no relatório atual do site (consultado em 12/11/2026), e nenhum dos dois traz esse índice.
> 
> Em Recife–PE, o SEDES tem estes indicadores sociais e econômicos:
> - **Pobreza total (CadÚnico), 2025:** 45,2% das famílias inscritas no CadÚnico estão em situação de pobreza.
> - **PIB, 2023:** R$ 66,4 bilhões.
> - **Taxa de analfabetismo, 2022:** 5,5%.
> - **IDH, 2010:** 0,8.
> - **Mortalidade infantil, 2020:** 11,2%.
> 
> Esses números vêm do relatório atual do site. A pobreza do CadÚnico mede só as famílias inscritas no programa, então não serve como taxa de desemprego.
> 
> Posso detalhar algum desses indicadores se você quiser.
