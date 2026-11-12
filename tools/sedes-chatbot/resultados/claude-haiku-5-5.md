# Avaliação: claude-haiku-5-5

Gerado por avaliar.sh em 2026-11-12T17:24:55.097Z.

| Id | Categoria | Tempo (s) | Turnos | Ferramentas |
| --- | --- | --- | --- | --- |
| C01 | conceitual | 7.9 | 4 | detalhar_indice×2, listar_indices×1 |
| C02 | conceitual | 5.2 | 2 | listar_indices×1 |
| C03 | conceitual | 6.9 | 2 | listar_indices×1 |
| C04 | conceitual | 7.7 | 2 | listar_indices×1 |
| P01 | valor pontual | 6.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P02 | valor pontual | 5.9 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P03 | valor pontual | 6.2 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P04 | valor pontual | 7.2 | 5 | buscar_territorio×1, listar_indices×1, consultar_sql×2 |
| P05 | valor pontual | 10.5 | 3 | listar_indices×1, consultar_sql×1 |
| P06 | valor pontual | 6.6 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| R01 | ranking | 6.5 | 3 | listar_indices×1, consultar_sql×1 |
| R02 | ranking | 10.2 | 4 | listar_indices×1, consultar_sql×2 |
| R03 | ranking | 9.9 | 4 | listar_indices×1, consultar_sql×2 |
| R04 | ranking | 8.9 | 5 | listar_indices×1, consultar_sql×3 |
| R05 | ranking | 7.5 | 4 | listar_indices×1, consultar_sql×2 |
| T01 | tendência | 7.8 | 4 | buscar_territorio×1, consultar_sql×2 |
| T02 | tendência | 7.5 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| T03 | tendência | 7.5 | 4 | listar_indices×1, consultar_sql×2 |
| T04 | tendência | 8.9 | 3 | listar_indices×1, consultar_sql×1 |
| T05 | tendência | 12 | 5 | buscar_territorio×1, listar_indices×1, consultar_sql×2 |
| X01 | cruzamento | 8.8 | 3 | listar_indices×1, consultar_sql×1 |
| X02 | cruzamento | 9.7 | 4 | listar_indices×1, consultar_sql×2 |
| X03 | cruzamento | 13.5 | 4 | listar_indices×1, consultar_sql×2 |
| A01 | recorte agregado | 6.5 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| A02 | recorte agregado | 6.3 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| A03 | recorte agregado | 6.9 | 3 | consultar_sql×1, listar_indices×1 |
| A04 | recorte agregado | 9.4 | 3 | listar_indices×1, consultar_sql×1 |
| H01 | homônimo | 4.8 | 2 | buscar_territorio×1 |
| H02 | homônimo | 11.6 | 2 | buscar_territorio×1 |
| H03 | homônimo | 6.5 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I01 | período inexistente | 8.2 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I02 | período inexistente | 7.6 | 4 | buscar_territorio×1, consultar_sql×2 |
| I03 | período inexistente | 7.1 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| F01 | fora do escopo | 7.1 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| F02 | fora do escopo | 7.6 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| F03 | fora do escopo | 7 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |

## C01 — conceitual

**Pergunta:** O que é o CDI?

**Esperado:** Índice Combinado de Seca: descreve a seca como um processo em cascata (falta de chuva → falta de umidade no solo → estresse na vegetação). Valor = % da área em cada classe: Sem seca, Estágios 1 a 3, Recuperação total, Recuperação parcial da umidade e Recuperação parcial da vegetação. É decendial (a cada 10 dias), de 01/01/2001 a 21/09/2026.

**Tempo:** 7.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `detalhar_indice: {"id":"cdi"}`
1. `listar_indices: {}`
1. `detalhar_indice: {"id":"indice-combinado-de-seca-cdi"}`

**Resposta do bot:**

> O **CDI** (Índice Combinado de Seca) é um índice do SEDES que acompanha a seca como um processo em cascata. Um período sem chuva reduz primeiro a umidade do solo e, depois, afeta a vegetação, com algum atraso entre uma etapa e a outra. O índice mostra em que fase esse processo está em cada parte do território.
> 
> Ele é calculado a cada dez dias (decêndios), com dados de 1º/1/2001 a 21/9/2026. Os valores são a porcentagem da área do território em cada classe:
> 
> - **Sem seca**
> - **Estágio 1, 2 e 3**: níveis crescentes de seca
> - **Recuperação total**
> - **Recuperação parcial da umidade**
> - **Recuperação parcial da vegetação**
> 
> Fonte: Índice Combinado de Seca - CDI, dado atualizado no SEDES em 19/10/2026.

## C02 — conceitual

**Pergunta:** Quais são as classes do Monitor de Secas da ANA?

**Esperado:** Seis classes, da menos à mais grave: Sem seca, Seca fraca, Seca moderada, Seca grave, Seca extrema, Seca excepcional. Valor = % da área em cada classe.

**Tempo:** 5.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O Monitor de Secas da ANA tem 6 classes, de "Sem seca" a "Seca excepcional". Cada número é a **porcentagem da área do território** que está em cada classe:
> 
> 1. Sem seca
> 2. Seca fraca
> 3. Seca moderada
> 4. Seca grave
> 5. Seca extrema
> 6. Seca excepcional
> 
> O índice vai de janeiro de 2024 a setembro de 2026 e foi atualizado no SEDES em 19/10/2026. Para municípios, estados e recortes, o valor é calculado sobre a área de cada um, não é média dos municípios.

## C03 — conceitual

**Pergunta:** O que mede o percentual de pobreza do CadÚnico no SEDES?

**Esperado:** % das famílias inscritas no CadÚnico em situação de pobreza (total, urbana e rural), anual de 2012 a 2025. Não é % da população. Estados, Brasil e recortes são média simples dos municípios.

**Tempo:** 6.9 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O **percentual de pobreza total do CadÚnico** mede a **porcentagem de famílias inscritas no Cadastro Único que estão em situação de pobreza**. O denominador são as famílias cadastradas, não a população inteira do território.
> 
> - **Unidade:** % das famílias do CadÚnico, um valor por território e ano. Período disponível: 2012 a 2025, atualizado no SEDES em 06/10/2026.
> - **Estados, Brasil e outros recortes:** são a média simples dos municípios, sem ponderar pela população. Um número de estado não representa o total de famílias pobres dele.
> 
> Se quiser, posso mostrar o mesmo indicador separado entre meio rural e urbano.

## C04 — conceitual

**Pergunta:** Quais índices sobre degradação da terra o SEDES tem?

**Esperado:** Dois: Índice de Degradação da Terra (2001 e 2021; níveis 1 a 5 e Conservado) e Dinâmica da Degradação da Terra – ODS 15.3.1 (2021; Degradando, Estável, Melhorando).

**Tempo:** 7.7 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES tem dois índices diretamente sobre degradação da terra, e outros relacionados que ajudam a entender o tema:
> 
> **Diretamente sobre degradação**
> - **Dinâmica da Degradação da Terra (ODS 15.3.1)**: classifica a área como *Degradando*, *Estável* ou *Melhorando*. Período: 2021. Atualizado em 26/08/2026.
> - **Índice de Degradação da Terra**: classes de *Nível 1* a *Nível 5* e *Conservado*. Períodos: 2001 e 2021. Atualizado em 14/08/2026.
> 
> **Relacionados**
> - **Produção Primária Bruta**: produtividade da vegetação, em faixas de kg de carbono por m². Período: 2001 a 2025. Atualizado em 03/09/2026.
> - **Carbono Orgânico do Solo (Embrapa)**: teor de carbono no solo, em g/kg. Período: 2020. Atualizado em 14/08/2026.
> - **Cobertura da Terra (IBGE)**: tipos de uso e cobertura, como vegetação, pastagem e área agrícola. Períodos: 2000 a 2020. Atualizado em 26/08/2026.
> - **PRODES (INPE)**: desmatamento acumulado e vegetação nativa. Períodos: 2000 a 2024. Atualizado em 24/10/2026.
> - **Solos do Brasil (IBGE)**: tipos de solo. Período: 2025. Atualizado em 21/09/2026.
> 
> Todos os valores são o percentual da área de cada território em cada classe. Os valores de Brasil, regiões, biomas, Semiárido e ASD são calculados sobre a própria área, e não são média dos municípios.
> 
> Se quiser, posso mostrar os valores de algum deles para um município ou estado.

## P01 — valor pontual

**Pergunta:** Como estava a seca em Campina Grande (PB) em abril de 2026, segundo o Monitor de Secas?

**Esperado:** Abr/2026, Monitor de Secas: 71,7% da área em seca moderada e 28,3% em seca fraca. Citar a data de atualização do índice (19/10/2026).

**Tempo:** 6.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.classe, v.valor, c.rotulo FROM valores v LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.territorio='2504009' ORDER BY v.classe`

**Resposta do bot:**

> Em abril de 2026, 71,7% da área de Campina Grande (PB) estava em **seca moderada** e 28,3% em **seca fraca**. Nenhuma parte do município aparecia em seca grave, extrema ou excepcional.
> 
> Fonte: Monitor de Secas (ANA), abril de 2026, Campina Grande–PB. O índice foi atualizado no SEDES em 19/10/2026. Os valores são percentuais da área do município em cada classe.

## P02 — valor pontual

**Pergunta:** Qual era o percentual de pobreza rural em Juazeiro do Norte em 2025?

**Esperado:** 47,3% das famílias rurais do CadÚnico em situação de pobreza (Juazeiro do Norte–CE, 2025).

**Tempo:** 5.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Juazeiro do Norte"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='percentual-de-pobreza-rural-cadunico' AND territorio='2307304' AND periodo BETWEEN '2024' AND '2025' ORDER BY periodo;`

**Resposta do bot:**

> Em 2025, o percentual de pobreza rural em Juazeiro do Norte (CE) era de **47,3%** das famílias inscritas no CadÚnico em situação de pobreza no meio rural.
> 
> - Índice: Percentual de pobreza rural – CadÚnico
> - Período: 2025 (em 2024 era 49,6%)
> - Dado atualizado no SEDES em 06/10/2026

## P03 — valor pontual

**Pergunta:** Quantos registros de seca e estiagem Petrolina teve em 2024?

**Esperado:** 1 registro em 2024 (S2iD, Petrolina–PE), igual ao site. Bônus: a ressalva de que na planilha atual quase todo município tem 0 ou 1 por ano.

**Tempo:** 6.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Petrolina"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='2611101' AND periodo BETWEEN '2024' AND '2024' ORDER BY periodo;`

**Resposta do bot:**

> Petrolina (PE) teve **1 registro** de seca e estiagem em 2024, segundo o índice "Registros de Secas e Estiagens do S2ID" (dado anual, atualizado no SEDES em 04/11/2026).
> 
> O S2iD é o sistema do governo federal onde os municípios registram decretos de situação de emergência por seca. O índice mostra a contagem de registros, e não a intensidade da seca.

## P04 — valor pontual

**Pergunta:** Qual é a cobertura da terra predominante em Sobral, no Ceará?

**Esperado:** Vegetação campestre, com 85,6% da área em 2020 (depois vegetação florestal 5,2% e mosaico de ocupações em área florestal 4,4%).

**Tempo:** 7.2 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Sobral","uf":"CE"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, v.classe, v.valor, t.rotulo FROM valores_com_nomes v JOIN (SELECT 1 AS dummy) d ON 1=1 LEFT JOIN (SELECT indice, classe, rotulo FROM classes) t ON 0 WHERE 0;`
1. `consultar_sql: SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='cobertura-da-terra-ibge-s' AND territorio='2312908' AND periodo = (SELECT MAX(periodo) FROM valores WHERE indice='cobertura-da-terra-ibge-s' AND territorio='2312908') ORDER BY valor DESC`

**Resposta do bot:**

> A cobertura predominante em Sobral (CE) é a **Vegetação Campestre**, com cerca de **85,6%** da área do município.
> 
> Dados do IBGE, Cobertura da Terra, 2020 (atualizado no SEDES em 26/08/2026). O valor é o percentual da área do município em cada classe. Na sequência vêm a Vegetação Florestal (5,2%) e o Mosaico de Ocupações em Área Florestal (4,4%). A Área Artificial (urbanização) fica em 1,1%, e a Área Agrícola aparece zerada.

## P05 — valor pontual

**Pergunta:** Qual era a situação do CDI na Paraíba em janeiro de 2026?

**Esperado:** O CDI é decendial: em janeiro de 2026 a PB teve 86,1% da área em algum estágio de seca no 1º decêndio, 79,1% no 2º e 86,4% no 3º (no 3º: Estágio 3 41,6%, Estágio 1 37,8%, Estágio 2 7,0%). Acerto = explicar os decêndios e dar os números, ou dar um decêndio dizendo qual.

**Tempo:** 10.5 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='indice-combinado-de-seca-cdi' AND territorio='pb' AND periodo BETWEEN '2026-01-01' AND '2026-01-31' ORDER BY periodo, classe`

**Resposta do bot:**

> Em janeiro de 2026, a Paraíba estava com seca em quase toda a área, segundo o Índice Combinado de Seca (CDI). O CDI é atualizado a cada dez dias, então há três leituras no mês. Os valores são o percentual da área do estado em cada classe:
> 
> | Data | Sem seca | Estágios 1 a 3 (seca) | Recuperação | Estágio 3 |
> |---|---|---|---|---|
> | 01/01/2026 | 0,3% | 86,2% | 13,6% | 12,0% |
> | 11/01/2026 | 0,3% | 79,1% | 20,6% | 18,0% |
> | 21/01/2026 | 0,3% | 86,4% | 13,4% | 41,6% |
> 
> - **Início do mês:** a maior parte da área estava no Estágio 1 (58,2%).
> - **Meio do mês:** a seca diminuiu um pouco, e a recuperação da umidade e da vegetação cresceu.
> - **Fim do mês:** a seca voltou a se intensificar. O Estágio 3 chegou a 41,6% da área, enquanto o Estágio 1 caiu para 37,8%.
> 
> Os estágios são classes de seca, numeradas na ordem do índice. Pela ordem, o Estágio 3 é o mais intenso.
> 
> Fonte: Índice Combinado de Seca (CDI), Paraíba, decêndios de 01, 11 e 21 de janeiro de 2026. Dado atualizado no SEDES em 19/10/2026.

## P06 — valor pontual

**Pergunta:** Qual é o PIB de Campina Grande?

**Esperado:** R$ 12,9 bilhões em 2023 (PIB, Campina Grande–PB); antes, R$ 10,1 bi em 2020 e R$ 5,0 bi em 2010. Errado = inventar um número.

**Tempo:** 6.6 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='produto-interno-bruto' AND territorio='2504009' ORDER BY periodo`

**Resposta do bot:**

> O PIB de Campina Grande (PB) em 2023 foi de **R$ 12,9 bilhões**, segundo o Produto Interno Bruto do IBGE no SEDES. O último dado disponível é de 2023 (índice atualizado no SEDES em 09/10/2026).
> 
> Série disponível (PIB do município, em reais):
> - 2010: R$ 5,0 bilhões
> - 2020: R$ 10,1 bilhões
> - 2023: R$ 12,9 bilhões

## R01 — ranking

**Pergunta:** Quais os 5 municípios da Paraíba com maior percentual de pobreza total em 2025?

**Esperado:** Juarez Távora 74,2%, Curral de Cima 73,9%, Santa Inês 73,2%, Cacimbas 73,1%, Pedro Régis 72,8%.

**Tempo:** 6.5 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'percentual-de-pobreza-total-cadunico' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.uf = 'PB' ORDER BY v.valor DESC LIMIT 5;`

**Resposta do bot:**

> Os 5 municípios da Paraíba com maior percentual de pobreza total em 2025 são:
> 
> 1. **Juarez Távora**: 74,2%
> 2. **Curral de Cima**: 73,9%
> 3. **Santa Inês**: 73,2%
> 4. **Cacimbas**: 73,1%
> 5. **Pedro Régis**: 72,8%
> 
> Os valores são o percentual de famílias inscritas no CadÚnico (Cadastro Único) que estão em situação de pobreza. Índice: Percentual de pobreza total – CadÚnico, ano de 2025, dado atualizado no SEDES em 06/10/2026.

## R02 — ranking

**Pergunta:** Quais municípios do Semiárido tinham mais área em seca grave ou pior no Monitor de Secas em abril de 2026?

**Esperado:** 41 municípios do Semiárido estavam com 100% da área em seca grave ou pior em abr/2026 (33 no PI, 6 no CE, 2 no RN), por exemplo Tibau e Baraúna (RN), Russas e Limoeiro do Norte (CE), Wall Ferraz (PI). Acerto = dizer que há empate em 100% e dar exemplos.

**Tempo:** 10.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, ROUND(SUM(v.valor),1) AS pct_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe >= 4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY t.codigo ORDER BY pct_grave_ou_pior DESC LIMIT 15;`
1. `consultar_sql: SELECT COUNT(*) AS n_municipios, SUM(CASE WHEN pct >= 99.95 THEN 1 ELSE 0 END) AS com_100pct FROM (SELECT t.codigo, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe >= 4 AND t.tipo='municipio' AND t.semiarido=1 GROUP BY t.codigo);`

**Resposta do bot:**

> Em abril de 2026, **41 municípios do Semiárido tinham 100% da área em seca grave ou pior** (classes "seca grave", "seca extrema" e "seca excepcional" somadas). Entre eles estão Tibau e Baraúna (RN), Tabuleiro do Norte, Russas, Quixeré, Limoeiro do Norte, Jaguaruana e Itaiçaba (CE), e Wall Ferraz, Vera Mendes, Sussuapara, São Miguel do Fidalgo, São Luis do Piauí, São José do Piauí e São João da Varjota (PI).
> 
> Fonte: Monitor de Secas (ANA), abril de 2026, dado atualizado no SEDES em 19/10/2026. Os valores são percentuais da área de cada município, não km². Por isso a lista empata no topo, e não consigo ordenar por área absoluta com esses dados.
> 
> Se quiser, posso listar os 41 municípios completos ou mostrar a situação de algum deles em outro mês.

## R03 — ranking

**Pergunta:** Pelo dado mais recente do CDI, quais estados têm a maior parte da área em seca?

**Esperado:** Último decêndio do CDI (21/09/2026), soma dos Estágios 1 a 3: Roraima 98,6%, Pernambuco 96,4%, Amazonas 95,6%, Sergipe 94,3%, Amapá 91,7%. Tem que dizer qual é o período.

**Tempo:** 9.9 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT MAX(periodo) AS ultimo FROM valores WHERE indice='indice-combinado-de-seca-cdi';`
1. `consultar_sql: SELECT t.nome, t.uf, ROUND(SUM(CASE WHEN v.classe IN (2,3,4) THEN v.valor ELSE 0 END),1) AS pct_seca, ROUND(SUM(CASE WHEN v.classe=2 THEN v.valor ELSE 0 END),1) AS e1, ROUND(SUM(CASE WHEN v.classe=3 THEN v.valor ELSE 0 END),1) AS e2, ROUND(SUM(CASE WHEN v.classe=4 THEN v.valor ELSE 0 END),1) AS e3 FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='indice-combinado-de-seca-cdi' AND v.periodo='2026-09-21' AND t.tipo='estado' GROUP BY t.codigo ORDER BY pct_seca DESC;`

**Resposta do bot:**

> Em 21/09/2026 (último decêndio disponível no CDI, atualizado no SEDES em 19/10/2026), **14 estados** tinham mais da metade da área em seca:
> 
> | Estado | Área em seca |
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
> | Acre | 70,3% |
> | Pará | 69,8% |
> | Bahia | 67,2% |
> | Rondônia | 63,1% |
> | Paraíba | 58,6% |
> 
> Mato Grosso ficou logo abaixo, com 49,1%.
> 
> "Em seca" soma os três estágios de seca do CDI (Estágio 1, 2 e 3). Não entram as classes de "Sem seca" nem de recuperação. Os valores são a porcentagem da área de cada estado.

## R04 — ranking

**Pergunta:** No bioma Caatinga, quais municípios tiveram mais registros de seca e estiagem em 2025?

**Esperado:** Não há destaque: em 2025, 760 dos 1.095 municípios da Caatinga têm 1 registro e nenhum tem mais que 1. Acerto = dizer que há empate (e a ressalva do S2iD); errado = apresentar 10 municípios como "os que mais tiveram".

**Tempo:** 8.9 s · **turnos:** 5

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.codigo, t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='registros-de-secas-e-estiagens-do-s2id' AND v.periodo='2025' AND t.tipo='municipio' AND t.bioma LIKE '%aatinga%' ORDER BY v.valor DESC, t.nome LIMIT 30;`
1. `consultar_sql: SELECT COUNT(*) AS n, SUM(CASE WHEN v.valor>0 THEN 1 ELSE 0 END) AS com_registro, MAX(v.valor) AS maximo, SUM(v.valor) AS total FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='registros-de-secas-e-estiagens-do-s2id' AND v.periodo='2025' AND t.tipo='municipio' AND t.bioma LIKE '%aatinga%';`
1. `consultar_sql: SELECT t.codigo, t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='registros-de-secas-e-estiagens-do-s2id' AND v.periodo='2025' AND t.codigo='3_bioma-caatinga';`

**Resposta do bot:**

> Em 2025, nenhum município da Caatinga teve mais de 1 registro de seca e estiagem. O valor máximo foi 1 em todos os municípios.
> 
> - **Municípios com registro:** 760 dos 1.095 municípios com bioma predominante Caatinga (Registros de Secas e Estiagens do S2ID, 2025).
> - **Total no bioma:** 760 registros, o mesmo número que o SEDES mostra para o bioma Caatinga como um todo.
> 
> O índice conta registros no S2ID (Sistema Integrado de Informações sobre Desastres), e o SEDES mostra esses números como "registros". Não dá para distinguir se o 1 significa um registro ou apenas que houve registro. Por isso, não há um "top" de municípios: todos os 760 empatam.
> 
> Dado de 2025, atualizado no SEDES em 04/11/2026.
> 
> Se quiser, posso listar os municípios com registro por estado ou cruzar com o Semiárido.

## R05 — ranking

**Pergunta:** Qual estado do Nordeste tem a maior parte da área degradando, segundo o ODS 15.3.1?

**Esperado:** Sergipe, com 16,7% da área degradando (2021). Depois Bahia 10,3% e Pernambuco 8,3%.

**Tempo:** 7.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'dinamica-da-degradacao-da-terra-ods-15-3-1' AND v.periodo = '2021' AND v.classe = 1 AND t.tipo = 'estado' AND t.regiao LIKE '%Nordeste%' ORDER BY v.valor DESC`
1. `consultar_sql: SELECT codigo, nome, regiao FROM territorios WHERE tipo = 'estado' LIMIT 40`

**Resposta do bot:**

> **Sergipe** tem a maior parte da área degradando: **16,7%** do território, segundo o indicador ODS 15.3.1 (Dinâmica da Degradação da Terra), de 2021.
> 
> Os outros estados do Nordeste ficam bem abaixo: Bahia (10,3%), Pernambuco (8,3%), Maranhão (7,8%), Alagoas (7,2%), Piauí (6,9%), Paraíba (6,7%), Rio Grande do Norte (6,6%) e Ceará (6,1%).
> 
> Esse índice mostra a porcentagem da área de cada território classificada como "degradando", "estável" ou "melhorando". O dado é de 2021 e foi atualizado no SEDES em 26/08/2026.

## T01 — tendência

**Pergunta:** Como evoluiu a pobreza total em Campina Grande de 2012 a 2025?

**Esperado:** Caiu de 79,1% em 2012 para 36,9% em 2025, com queda forte até 2017 (45,2%), estabilidade perto de 40% e um pico em 2022 (45,5%).

**Tempo:** 7.8 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `consultar_sql: SELECT id, nome, unidade, significado_valor, fonte, atualizado_em, ultimo_periodo, observacao FROM indices WHERE id = 'percentual-de-pobreza-total-cadunico'`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice = 'percentual-de-pobreza-total-cadunico' AND territorio = '2504009' AND periodo BETWEEN '2012' AND '2025' ORDER BY periodo`

**Resposta do bot:**

> A pobreza total em Campina Grande caiu de 79,1% em 2012 para 36,9% em 2025. A queda foi quase contínua, com uma alta em 2022.
> 
> | Ano | % das famílias em pobreza |
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
> Fonte: Percentual de pobreza total (CadÚnico), município de Campina Grande–PB. Esse índice mede o percentual de famílias inscritas no Cadastro Único que estão em situação de pobreza. Os dados foram atualizados no SEDES em 06/10/2026.

## T02 — tendência

**Pergunta:** A seca no Ceará piorou ou melhorou entre janeiro e abril de 2026, pelo Monitor de Secas?

**Esperado:** Melhorou: em janeiro havia 27,3% em seca extrema e 20,9% em grave; em abril não havia seca extrema, só 6,7% em grave, e a maior parte em seca fraca (52,1%) ou moderada (41,2%).

**Tempo:** 7.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Ceará","uf":"CE"}`
1. `consultar_sql: SELECT periodo, classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='ce' AND periodo BETWEEN '2025-12' AND '2026-04' ORDER BY periodo, classe;`

**Resposta do bot:**

> A seca no Ceará **melhorou** entre janeiro e abril de 2026.
> 
> Pelo Monitor de Secas da ANA (dado atualizado no SEDES em 19/10/2026), a parcela do estado em seca grave ou pior caiu de 48,2% da área em janeiro para 6,7% em abril. Em seca extrema, a área caiu de 27,3% para zero no mesmo período. Em abril, 52,1% da área estava em seca fraca, e a seca moderada cobria 41,2%.
> 
> Os valores são o percentual da área do Ceará em cada classe.

## T03 — tendência

**Pergunta:** Em que ano o Brasil teve mais registros de seca e estiagem?

**Esperado:** 2013, com 1.617 registros (soma dos municípios). Depois vêm 2012 (1.608) e 2020 (1.586). Bônus: a ressalva do S2iD.

**Tempo:** 7.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, SUM(valor) AS registros FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='br' GROUP BY periodo ORDER BY registros DESC LIMIT 5;`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='br' ORDER BY periodo;`

**Resposta do bot:**

> O ano com mais registros de seca e estiagem no Brasil foi **2013**, com **1.617 registros**. Ficou logo atrás **2012** (1.608).
> 
> Fonte: Registros de Secas e Estiagens do S2ID, série anual de 1991 a 2025, dado atualizado no SEDES em 04/11/2026. Os registros são a soma dos municípios brasileiros, segundo a planilha do S2ID, o sistema do governo federal onde municípios pedem reconhecimento de situação de emergência por seca.

## T04 — tendência

**Pergunta:** Em que época de 2025 a Paraíba teve a maior área em seca pelo CDI?

**Esperado:** Final de dezembro de 2025: no decêndio que começa em 21/12/2025, 89,2% da área em algum estágio de seca (Estágios 1 a 3); dezembro inteiro foi o pior período (60,7% e 55,6% nos outros dois decêndios). Depois vêm o início de janeiro (46,6%) e o início de maio (45,0%). Tem que dizer que o CDI é por decêndio.

**Tempo:** 8.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor ELSE 0 END) AS pct_seca, SUM(CASE WHEN classe=4 THEN valor ELSE 0 END) AS pct_estagio3 FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='pb' AND periodo BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY periodo ORDER BY pct_seca DESC LIMIT 5;`

**Resposta do bot:**

> A maior área em seca da Paraíba em 2025 foi no decêndio de **21 a 31 de dezembro de 2025**, com cerca de **89,2%** do território em alguma fase de seca (estágios 1 a 3 do CDI). Dentro desse total, 4,8% estavam no estágio 3, o mais grave.
> 
> Fonte: Índice Combinado de Seca (CDI), Paraíba, decêndio de 21/12/2025. Dado atualizado no SEDES em 19/10/2026. Os valores são % da área do estado.
> 
> Para comparação, os decêndios seguintes foram 60,7% (11 de dezembro) e 55,6% (1º de dezembro).

## T05 — tendência

**Pergunta:** Me diga a situação de seca em Itabuna em 7 de maio de 2001 e em 7 de maio de 2026.

**Esperado:** Comparar no mesmo índice, o CDI, que cobre os dois anos: no decêndio que começa em 1º de maio (inclui o dia 7), Itabuna–BA tinha em 2001 45,4% da área sem seca, 44,9% em recuperação total e 9,7% no Estágio 3; em 2026, 100% sem seca. O Monitor de Secas só começa em 2024 (maio/2026: 100% sem seca). Errado = comparar 2001 de um índice com 2026 de outro sem avisar. (Pergunta tirada de uma conversa real de 12/11/2026.)

**Tempo:** 12 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Itabuna"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2914802' AND periodo IN ('2001-05-01','2001-05-11','2026-05-01','2026-05-11') ORDER BY periodo, classe;`
1. `consultar_sql: SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='2914802' AND periodo IN ('2026-05','2026-06') ORDER BY periodo, classe;`

**Resposta do bot:**

> **Itabuna (BA): situação de seca em 7 de maio de 2001 e em 7 de maio de 2026**
> 
> - **7/5/2001: seca presente, mas com pouca área afetada.** No Índice Combinado de Seca (CDI), no período de 1 a 10 de maio de 2001, 9,7% do município estava no Estágio 3 de seca, 45,4% sem seca e 44,9% em recuperação total.
> - **7/5/2026: sem seca.** No CDI, no período de 1 a 10 de maio de 2026, 100% do município estava sem seca. No Monitor de Secas da ANA, o mês de maio de 2026 também aparece 100% sem seca.
> 
> O CDI é calculado por decêndio (períodos de 10 dias que começam em 1, 11 e 21 do mês), então 7 de maio cai no decêndio que começa em 1 de maio. Os dados são do SEDES, atualizados em 19/10/2026. O CDI mostra a área do município em cada classe, em %.

## X01 — cruzamento

**Pergunta:** Quais municípios do Semiárido estavam com mais de 90% da área em seca grave ou pior em abril de 2026 e também têm pobreza total acima de 60% em 2025?

**Esperado:** Cinco municípios, todos no Piauí: Wall Ferraz (pobreza 68,8%), Aroeiras do Itaim (67,0%), Jaicós (64,9%), Santa Rosa do Piauí (61,5%) e Sussuapara (61,0%), todos com 100% da área em seca grave ou pior.

**Tempo:** 8.8 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH seca AS ( SELECT v.territorio, SUM(v.valor) AS pct_grave_ou_pior FROM valores v WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.classe >= 4 GROUP BY v.territorio ), pob AS ( SELECT territorio, valor AS pobreza_total FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND periodo='2025' AND classe=1 ) SELECT t.codigo, t.nome, t.uf, ROUND(s.pct_grave_ou_pior,1) AS seca_grave_ou_pior_pct, ROUND(p.pobreza_total,1) AS pobreza_total_2025_pct FROM seca s JOIN territorios t ON t.codigo = s.territorio JOIN pob p ON p.territorio = s.territorio WHERE t.tipo='municipio' AND t.semiarido=1 AND s.pct_grave_ou_pior > 90 AND p.pobreza_total > 60 ORDER BY s.pct_grave_ou_pior DESC;`

**Resposta do bot:**

> Cinco municípios do Semiárido atendem às duas condições. Todos são do Piauí:
> 
> | Município | Área em seca grave ou pior (abril/2026) | Pobreza total (2025) |
> |---|---|---|
> | Wall Ferraz–PI | 100% | 68,8% |
> | Aroeiras do Itaim–PI | 100% | 67,0% |
> | Jaicós–PI | 100% | 64,9% |
> | Santa Rosa do Piauí–PI | 100% | 61,5% |
> | Sussuapara–PI | 100% | 61,0% |
> 
> - **Seca:** Monitor de Secas (ANA), abril de 2026, % da área do município nas classes seca grave, extrema e excepcional. Atualizado no SEDES em 19/10/2026.
> - **Pobreza:** CadÚnico, 2025, % das famílias inscritas em situação de pobreza. Atualizado no SEDES em 06/10/2026.

## X02 — cruzamento

**Pergunta:** Entre os municípios com mais da metade da área nos níveis 3 a 5 de degradação em 2021, quais têm a maior pobreza rural em 2025?

**Esperado:** 2.268 municípios têm mais da metade da área nos níveis 3 a 5. Os de maior pobreza rural em 2025: Campo Grande–AL (80,9%), Potiraguá–BA (79,9%), Senador Elói de Souza–RN (79,7%), Colônia Leopoldina–AL (78,0%), Feira Nova–PE (77,9%). Atenção: o nível 5 é o mais degradado; as classes 1 a 3 do tabelão são os níveis 5, 4 e 3.

**Tempo:** 9.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH deg AS (SELECT v.territorio, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='indice-de-degradacao-da-terra' AND v.periodo='2021' AND v.classe IN (1,2,3) AND t.tipo='municipio' GROUP BY v.territorio HAVING SUM(v.valor) > 50) SELECT t.nome, t.uf, ROUND(d.pct,1) AS pct_deg_niveis_3_a_5, ROUND(p.valor,1) AS pobreza_rural_2025 FROM deg d JOIN territorios t ON t.codigo=d.territorio LEFT JOIN valores p ON p.territorio=d.territorio AND p.indice='percentual-de-pobreza-rural-cadunico' AND p.periodo='2025' ORDER BY p.valor DESC LIMIT 15;`
1. `consultar_sql: SELECT COUNT(*) AS n_municipios, SUM(CASE WHEN p.valor IS NULL THEN 1 ELSE 0 END) AS sem_pobreza_rural FROM (SELECT v.territorio FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='indice-de-degradacao-da-terra' AND v.periodo='2021' AND v.classe IN (1,2,3) AND t.tipo='municipio' GROUP BY v.territorio HAVING SUM(v.valor) > 50) d LEFT JOIN valores p ON p.territorio=d.territorio AND p.indice='percentual-de-pobreza-rural-cadunico' AND p.periodo='2025';`

**Resposta do bot:**

> Os municípios com mais pobreza rural em 2025 entre os que têm mais da metade da área em degradação de nível 3 a 5 são Campo Grande (AL), Potiraguá (BA) e Senador Elói de Souza (RN), todos com cerca de 80%.
> 
> Ao todo, 2.268 municípios têm mais da metade da área nesses níveis em 2021. Os 10 com maior pobreza rural estão abaixo:
> 
> | Município | UF | Área em nível 3 a 5 (2021) | Pobreza rural (2025) |
> |---|---|---|---|
> | Campo Grande | AL | 89,1% | 80,9% |
> | Potiraguá | BA | 69,5% | 79,9% |
> | Senador Elói de Souza | RN | 75,0% | 79,7% |
> | Colônia Leopoldina | AL | 60,4% | 78,0% |
> | Feira Nova | PE | 90,3% | 77,9% |
> | Altamira do Maranhão | MA | 86,5% | 76,6% |
> | Chã Preta | AL | 72,0% | 76,6% |
> | Coronel Sapucaia | MS | 75,1% | 75,7% |
> | Porto Real do Colégio | AL | 70,8% | 75,6% |
> | Graccho Cardoso | SE | 82,0% | 74,9% |
> 
> Fontes e significado:
> - **Degradação da terra:** Índice de Degradação da Terra, 2021 (atualizado no SEDES em 14/08/2026). Os valores são a soma da área do município nos níveis 5, 4 e 3, que correspondem aos níveis 3 a 5 do índice, em % da área do território.
> - **Pobreza rural:** Percentual de pobreza rural do CadÚnico, 2025 (atualizado no SEDES em 06/10/2026). É o % das famílias inscritas no CadÚnico em situação de pobreza no meio rural.

## X03 — cruzamento

**Pergunta:** Na Paraíba, os municípios com mais pobreza em 2025 tiveram mais registros de seca em 2025?

**Esperado:** Não: dividindo os 223 municípios da PB em quatro faixas de pobreza, a média de registros do S2iD em 2025 fica em ~0,6 em todas. Não há relação visível. Acerto = conclusão de "sem relação clara" baseada nos dados.

**Tempo:** 13.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH d AS ( SELECT t.codigo, t.nome, p.valor AS pobreza, r.valor AS registros FROM territorios t JOIN valores p ON p.territorio=t.codigo AND p.indice='percentual-de-pobreza-total-cadunico' AND p.periodo='2025' JOIN valores r ON r.territorio=t.codigo AND r.indice='registros-de-secas-e-estiagens-do-s2id' AND r.periodo='2025' WHERE t.tipo='municipio' AND t.uf='PB' ), q AS (SELECT *, NTILE(4) OVER (ORDER BY pobreza) AS quartil FROM d) SELECT quartil, COUNT(*) AS n, ROUND(MIN(pobreza),1) AS pob_min, ROUND(MAX(pobreza),1) AS pob_max, ROUND(AVG(pobreza),1) AS pob_media, ROUND(AVG(registros),2) AS reg_media, SUM(CASE WHEN registros>0 THEN 1 ELSE 0 END) AS n_com_registro, (SELECT COUNT(*) FROM d) AS total_municipios FROM q GROUP BY quartil ORDER BY quartil;`
1. `consultar_sql: SELECT (SELECT COUNT(*) FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND periodo='2025' AND territorio IN (SELECT codigo FROM territorios WHERE tipo='municipio' AND uf='PB')) AS n_pobreza, (SELECT COUNT(*) FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND periodo='2025' AND territorio IN (SELECT codigo FROM territorios WHERE tipo='municipio' AND uf='PB')) AS n_registros, (SELECT COUNT(*) FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND periodo='2025' AND territorio='pb') AS estado_registros, (SELECT valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND periodo='2025' AND territorio='pb') AS estado_valor, (SELECT valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND periodo='2025' AND territorio='pb') AS estado_pobreza;`

**Resposta do bot:**

> **Não.** Na Paraíba, os municípios com mais pobreza em 2025 não tiveram mais registros de seca em 2025. O padrão é praticamente o mesmo nos quatro grupos.
> 
> Dividi os 223 municípios paraibanos em quatro grupos de tamanho parecido, do menos ao mais pobre:
> 
> | Grupo de pobreza | Faixa de pobreza (% das famílias) | Média de registros de seca | Municípios com algum registro |
> |---|---|---|---|
> | 1º (menos pobres) | 34,5% a 52,9% | 0,63 | 35 de 56 |
> | 2º | 53,0% a 58,6% | 0,63 | 35 de 56 |
> | 3º | 58,8% a 62,8% | 0,63 | 35 de 56 |
> | 4º (mais pobres) | 63,1% a 74,2% | 0,58 | 32 de 55 |
> 
> Os dados são do **Percentual de pobreza total do CadÚnico** (famílias inscritas em situação de pobreza, em %), de 2025, atualizado no SEDES em 06/10/2026, e dos **Registros de Secas e Estiagens do S2iD** (contagem de registros), de 2025, atualizado em 04/11/2026. Os dois são do tabelão do SEDES, gerado em 12/11/2026.
> 
> Ressalvas:
> - Os registros do S2iD são pequenos: quase todo município tem 0 ou 1 por ano. Isso limita a comparação.
> - O S2iD registra eventos decretados ou reconhecidos, não a seca medida no solo. Para isso, use o Monitor de Secas da ANA.
> - Estes números mostram só uma comparação entre grupos, não uma causa.

## A01 — recorte agregado

**Pergunta:** Como estava a seca no bioma Caatinga em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, bioma Caatinga: seca moderada 55,0%, seca fraca 34,8%, sem seca 5,3% e seca grave 4,9%.

**Tempo:** 6.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Caatinga"}`
1. `consultar_sql: SELECT c.rotulo AS classe, v.valor FROM valores v JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.territorio='3_bioma-caatinga' ORDER BY v.classe;`

**Resposta do bot:**

> Em abril de 2026, cerca de 95% da área da Caatinga estava em algum nível de seca, segundo o Monitor de Secas (ANA).
> 
> - Sem seca: 5,3%
> - Seca fraca: 34,8%
> - Seca moderada: 55,0% (a classe mais comum)
> - Seca grave: 4,9%
> - Seca extrema e excepcional: 0%
> 
> Os valores são o percentual da área do bioma em cada classe. Os dados são do Monitor de Secas, abril de 2026, com atualização no SEDES em 19/10/2026. O valor do bioma é calculado sobre a própria área dele, e não é média dos municípios.

## A02 — recorte agregado

**Pergunta:** Qual é o percentual de pobreza total na região Nordeste?

**Esperado:** 57,9% em 2025 (Nordeste, valor próprio do recorte; é a média simples dos municípios, calculada pelo site). Por estado, vai de 52,9% (RN) a 64,6% (MA).

**Tempo:** 6.3 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Nordeste"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='percentual-de-pobreza-total-cadunico' AND territorio='2_regiao-nordeste' ORDER BY periodo DESC LIMIT 5;`

**Resposta do bot:**

> Em 2025, **57,9%** das famílias inscritas no CadÚnico da Região Nordeste estavam em situação de pobreza (Percentual de pobreza total, CadÚnico, 2025; dado atualizado no SEDES em 06/10/2026).
> 
> O valor do Nordeste é a média simples dos municípios, sem ponderar pela população. Os anos anteriores foram 59,7% em 2024 e 61,8% em 2023.

## A03 — recorte agregado

**Pergunta:** Qual parte do Brasil estava em seca em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, Brasil: 58,4% sem seca, 26,4% seca fraca, 14,4% moderada, 0,9% grave. Ou seja, ~41,6% da área com algum grau de seca.

**Tempo:** 6.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `consultar_sql: SELECT v.classe, c.rotulo, v.valor, i.ultimo_periodo, i.atualizado_em FROM valores v JOIN indices i ON i.id=v.indice LEFT JOIN classes c ON c.indice=v.indice AND c.ordem=v.classe WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-04' AND v.territorio='br' ORDER BY v.classe`
1. `listar_indices: {}`

**Resposta do bot:**

> Em abril de 2026, cerca de **41,6% da área do Brasil estava em algum nível de seca**, segundo o Monitor de Secas (ANA). O restante, 58,4%, estava sem seca.
> 
> Por nível (% da área do país):
> - Seca fraca: 26,4%
> - Seca moderada: 14,4%
> - Seca grave: 0,9%
> - Seca extrema e excepcional: 0%
> 
> Ou seja, quase toda a seca era fraca ou moderada.
> 
> Fonte: Monitor de Secas, ANA, abril de 2026, Brasil. Dado atualizado no SEDES em 19/10/2026.

## A04 — recorte agregado

**Pergunta:** Como está a degradação da terra no Semiárido?

**Esperado:** Semiárido, Índice de Degradação da Terra 2021: Conservado 75,5%, Nível 3 12,7%, Nível 4 7,4%, Nível 2 3,9%, Nível 5 0,3%, Nível 1 0,2%. Bônus: ODS 15.3.1 do Semiárido.

**Tempo:** 9.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT indice, periodo, rotulo_classe, valor FROM valores_com_nomes WHERE territorio='5_semiarido-semiarido-total' AND indice IN ('dinamica-da-degradacao-da-terra-ods-15-3-1','indice-de-degradacao-da-terra') ORDER BY indice, periodo, classe;`

**Resposta do bot:**

> No Semiárido, a maior parte da área ainda está conservada, mas a degradação aumentou entre 2001 e 2021.
> 
> - **Dinâmica da Degradação da Terra (ODS 15.3.1), 2021:** 7,9% da área está degradando, 91,6% estável e 0,5% melhorando. Este índice tem só o ano de 2021, então não mostra tendência.
> - **Índice de Degradação da Terra:** em 2021, 75,5% da área está conservada e 24,5% em algum nível de degradação. Em 2001, eram 81,8% conservada e 18,2% degradada. Ou seja, a área degradada subiu cerca de 6 pontos percentuais em 20 anos.
> 
> Os valores são percentuais da área do Semiárido inteiro. O índice de 2021 foi atualizado no SEDES em 14/08/2026, e o da dinâmica (ODS), em 26/08/2026.
> 
> Se quiser, posso mostrar a distribuição por estado ou por município dentro do Semiárido.

## H01 — homônimo

**Pergunta:** Como está a seca em Santa Luzia?

**Esperado:** Perguntar qual Santa Luzia: há quatro (BA, MA, MG e PB). Não pode escolher uma sozinho.

**Tempo:** 4.8 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Santa Luzia"}`

**Resposta do bot:**

> Há quatro municípios chamados Santa Luzia. Qual deles você quer?
> 
> - Santa Luzia (BA)
> - Santa Luzia (MA)
> - Santa Luzia (MG)
> - Santa Luzia (PB)
> 
> Se a sua pergunta for sobre a Paraíba, por exemplo, é só dizer a UF que eu consulto o Monitor de Secas para ele.

## H02 — homônimo

**Pergunta:** Qual é o percentual de pobreza em Bom Jesus em 2025?

**Esperado:** Perguntar qual Bom Jesus (PB, PI, RN, RS, SC) ou listar as cinco: PB 51,4%, PI 54,5%, RN 56,6%, RS 45,0%, SC 37,9%.

**Tempo:** 11.6 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Bom Jesus"}`

**Resposta do bot:**

> Existem cinco municípios chamados Bom Jesus: na Paraíba (PB), no Piauí (PI), no Rio Grande do Norte (RN), no Rio Grande do Sul (RS) e em Santa Catarina (SC). De qual deles você quer saber o percentual de pobreza em 2025?

## H03 — homônimo

**Pergunta:** E o Monitor de Secas de São Domingos da Paraíba em setembro de 2026?

**Esperado:** O usuário já deu a UF. São Domingos–PB, Monitor de Secas set/2026: 100% da área em seca moderada.

**Tempo:** 6.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"São Domingos","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT classe, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND territorio='2513968' ORDER BY classe;`

**Resposta do bot:**

> Em setembro de 2026, 100% da área de São Domingos (PB) estava em **seca moderada**, segundo o Monitor de Secas (ANA). Nenhuma parte do município aparece nas outras classes.
> 
> - **Índice:** Monitor de Secas (ANA), mensal, valor em % da área do território
> - **Período:** setembro de 2026
> - **Atualização no SEDES:** 19/10/2026

## I01 — período inexistente

**Pergunta:** Qual era o CDI de Campina Grande em 1995?

**Esperado:** Não há: o CDI começa em 01/01/2001. Pode oferecer o primeiro ano disponível.

**Tempo:** 8.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, classe, valor FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='2504009' AND periodo BETWEEN '1995-01-01' AND '1995-12-31' AND valor > 0 ORDER BY periodo, classe`

**Resposta do bot:**

> O SEDES não tem o CDI de Campina Grande para 1995. O Índice Combinado de Seca (CDI) começa em 1º de janeiro de 2001 e vai até 21 de setembro de 2026, e não há dado anterior para o município.
> 
> Se quiser, posso mostrar o CDI de Campina Grande a partir de janeiro de 2001. O índice é decendial (medido a cada 10 dias) e mostra o percentual da área do município em cada estágio de seca.

## I02 — período inexistente

**Pergunta:** Como estava o Monitor de Secas em Patos (PB) em dezembro de 2026?

**Esperado:** Não existe dezembro de 2026 (ainda não aconteceu). O último mês é set/2026: Patos–PB com 82,5% da área em seca grave e 17,5% em moderada. Errado = inventar o dado de dezembro.

**Tempo:** 7.6 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Patos","uf":"PB"}`
1. `consultar_sql: SELECT id, nome, primeiro_periodo, ultimo_periodo, atualizado_em, previsao FROM indices WHERE id = 'monitor-de-seca-ana'`
1. `consultar_sql: SELECT v.periodo, c.rotulo AS classe, v.valor FROM valores v LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'monitor-de-seca-ana' AND v.territorio = '2510808' AND v.periodo BETWEEN '2026-07' AND '2026-09' ORDER BY v.periodo, v.classe`

**Resposta do bot:**

> Não há dados do Monitor de Secas para dezembro de 2026. Esse mês ainda não chegou (hoje é 12/11/2026), e o último período disponível no SEDES é setembro de 2026.
> 
> Para Patos–PB, o último dado disponível foi:
> 
> - **Setembro de 2026** (Monitor de Secas, dado atualizado no SEDES em 19/10/2026): 82,5% da área em **seca grave** e 17,5% em **seca moderada**. Nenhuma área sem seca.
> - Em julho e agosto de 2026, a área inteira estava em seca moderada.
> 
> Os valores são "% da área do município" em cada classe.

## I03 — período inexistente

**Pergunta:** Quantos registros de seca Petrolina teve em 1985?

**Esperado:** Não há: a série do S2iD no SEDES começa em 1991. Pode oferecer o primeiro ano.

**Tempo:** 7.1 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Petrolina"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='registros-de-secas-e-estiagens-do-s2id' AND territorio='2611101' AND periodo BETWEEN '1980' AND '1995' ORDER BY periodo`

**Resposta do bot:**

> O SEDES não tem o número de registros de seca de Petrolina (PE) em 1985. A série do índice "Registros de Secas e Estiagens do S2ID" começa em 1991.
> 
> Se quiser, posso mostrar a série de Petrolina a partir de 1991. Nos primeiros anos disponíveis, 1991 e 1992 têm 0 registros, 1993 tem 1 e 1994 e 1995 têm 0. O índice foi atualizado no SEDES em 04/11/2026.

## F01 — fora do escopo

**Pergunta:** Qual é a população de Campina Grande?

**Esperado:** O SEDES não tem dado de população. Dizer isso, sem inventar número.

**Tempo:** 7.1 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT id, nome, categoria FROM indices WHERE lower(nome) LIKE '%popula%' OR lower(descricao) LIKE '%popula%' OR lower(id) LIKE '%popula%' OR lower(id) LIKE '%censo%' OR lower(nome) LIKE '%censo%' OR lower(nome) LIKE '%habitante%'`

**Resposta do bot:**

> O SEDES não tem a população de Campina Grande (PB). A plataforma não reúne um índice de população, e a busca no catálogo de índices não encontrou nenhum relacionado a população ou censo.
> 
> O que o SEDES tem sobre Campina Grande (código IBGE 2504009) inclui indicadores socioeconômicos, como PIB, IDH, pobreza no CadÚnico e taxa de analfabetismo, que são medidos por famílias, pessoas ou reais, não como contagem de habitantes. Se quiser, posso mostrar algum desses.

## F02 — fora do escopo

**Pergunta:** Vai chover amanhã em Fortaleza?

**Esperado:** O SEDES não tem previsão diária do tempo. Tem previsões mensais e trimestrais de chuva (CPTEC e INMET) de nov/2026 a fev/2027, que são probabilidades e anomalias, não "vai chover amanhã".

**Tempo:** 7.6 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Fortaleza","uf":"CE"}`
1. `consultar_sql: SELECT v.indice, v.periodo, v.classe, v.valor FROM valores v WHERE v.territorio='2304400' AND v.indice IN ('previsao-precipitacao-mensal-acumulado-inmet','previsao-precipitacao-mensal-acumulado-cptec-2') AND v.periodo='2026-11' ORDER BY v.indice, v.classe`

**Resposta do bot:**

> Não tenho como responder isso. O SEDES não tem previsão do tempo diária, então não sei se vai chover amanhã (13/11/2026) em Fortaleza.
> 
> O que tenho são previsões mensais e trimestrais de chuva. Para Fortaleza, a previsão de precipitação acumulada de novembro de 2026 (CPTEC e INMET) indica 10 a 100 mm no mês, com 100% da área do município nessa faixa. Isso é uma previsão para o mês inteiro, não para amanhã, e não é medição. Se quiser, posso mostrar também a probabilidade de chuva acima ou abaixo do normal para novembro.
> 
> Para saber sobre amanhã, consulte um serviço de previsão diária, como o Inmet ou o Funceme.

## F03 — fora do escopo

**Pergunta:** Qual é a taxa de desemprego em Recife?

**Esperado:** O SEDES não tem desemprego. Dizer isso, sem inventar.

**Tempo:** 7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Recife"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT id, nome, categoria FROM indices WHERE lower(nome) LIKE '%desemprego%' OR lower(id) LIKE '%desemprego%' OR lower(descricao) LIKE '%desemprego%' OR lower(nome) LIKE '%ocupa%' OR lower(nome) LIKE '%trabalho%';`

**Resposta do bot:**

> O SEDES não tem a taxa de desemprego de Recife. Não há nenhum índice de desemprego, ocupação ou trabalho na plataforma, então não tenho esse número.
> 
> O que o SEDES tem para Recife (município de Recife–PE) inclui indicadores socioeconômicos como percentual de pobreza no CadÚnico, PIB, IDH e taxa de analfabetismo. Se quiser, posso mostrar algum deles.
> 
> Para a taxa de desemprego, o IBGE (PNAD Contínua) é a fonte mais indicada.
