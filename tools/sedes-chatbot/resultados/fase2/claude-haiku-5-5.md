# Avaliação: claude-haiku-5-5

Gerado por avaliar.sh em 2026-11-12T16:31:39.185Z.

| Id | Categoria | Tempo (s) | Turnos | Ferramentas |
| --- | --- | --- | --- | --- |
| C01 | conceitual | 6.3 | 2 | listar_indices×1 |
| C02 | conceitual | 5.1 | 2 | listar_indices×1 |
| C03 | conceitual | 6.4 | 2 | listar_indices×1 |
| C04 | conceitual | 6.9 | 2 | listar_indices×1 |
| P01 | valor pontual | 6.2 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P02 | valor pontual | 5.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P03 | valor pontual | 5.5 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| P04 | valor pontual | 6.2 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| P05 | valor pontual | 6.2 | 3 | listar_indices×1, consultar_sql×1 |
| P06 | valor pontual | 7.2 | 4 | buscar_territorio×1, listar_indices×1, relatorio_territorio×1 |
| R01 | ranking | 6.1 | 3 | listar_indices×1, consultar_sql×1 |
| R02 | ranking | 13.1 | 5 | listar_indices×1, consultar_sql×3 |
| R03 | ranking | 9.2 | 3 | listar_indices×1, consultar_sql×1 |
| R04 | ranking | 7.7 | 4 | listar_indices×1, consultar_sql×2 |
| R05 | ranking | 6.7 | 4 | listar_indices×1, consultar_sql×2 |
| T01 | tendência | 6.4 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| T02 | tendência | 7.2 | 4 | listar_indices×1, buscar_territorio×1, consultar_sql×1 |
| T03 | tendência | 7.3 | 3 | listar_indices×1, consultar_sql×1 |
| T04 | tendência | 8.1 | 4 | listar_indices×1, consultar_sql×2 |
| X01 | cruzamento | 7.4 | 3 | listar_indices×1, consultar_sql×1 |
| X02 | cruzamento | 8.6 | 3 | listar_indices×1, consultar_sql×1 |
| X03 | cruzamento | 18.4 | 6 | listar_indices×1, consultar_sql×4 |
| A01 | recorte agregado | 6.3 | 3 | listar_indices×1, consultar_sql×1 |
| A02 | recorte agregado | 9.9 | 5 | listar_indices×1, relatorio_territorio×2, consultar_sql×1 |
| A03 | recorte agregado | 9.2 | 4 | listar_indices×1, consultar_sql×2 |
| A04 | recorte agregado | 10.8 | 4 | listar_indices×1, relatorio_territorio×1, consultar_sql×1 |
| H01 | homônimo | 4.5 | 2 | buscar_territorio×1 |
| H02 | homônimo | 4.2 | 2 | buscar_territorio×1 |
| H03 | homônimo | 6.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I01 | período inexistente | 8.4 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I02 | período inexistente | 8.3 | 4 | buscar_territorio×1, listar_indices×1, consultar_sql×1 |
| I03 | período inexistente | 7.2 | 5 | buscar_territorio×1, listar_indices×1, relatorio_territorio×2 |
| F01 | fora do escopo | 6 | 3 | buscar_territorio×1, listar_indices×1 |
| F02 | fora do escopo | 6.9 | 3 | buscar_territorio×1, listar_indices×1 |
| F03 | fora do escopo | 17.5 | 4 | listar_indices×1, buscar_territorio×1, relatorio_territorio×1 |

## C01 — conceitual

**Pergunta:** O que é o CDI?

**Esperado:** Índice Combinado de Seca: monitora mês a mês os estágios da seca (Sem seca, Estágios 1 a 3, Recuperação total e parcial), implementado pelo OCA seguindo Cammalleri et al. (2021). Valor = % da área em cada estágio. No tabelão vai de jan/2001 a jan/2026.

**Tempo:** 6.3 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O **CDI (Índice Combinado de Seca)** é um indicador do SEDES que classifica, mês a mês, a situação de seca de cada território. Ele mostra a parte da área de um município, estado ou região em cada nível de seca, de "Sem seca" até "Estágio 3", o mais grave. As classes "Recuperação total" e "Recuperação parcial" indicam que a área está voltando à normalidade. O valor é sempre "% da área do território".
> 
> No tabelão do SEDES (dados de 24/07/2026), a série vai de janeiro de 2001 a janeiro de 2026. O site usa uma versão recalculada, com atualizações a cada dez dias, então os números do site podem ser diferentes dos do tabelão.
> 
> Se quiser, posso mostrar a situação do CDI em um município, estado ou no Brasil.

## C02 — conceitual

**Pergunta:** Quais são as classes do Monitor de Secas da ANA?

**Esperado:** Seis classes, da menos à mais grave: Sem seca, Seca fraca, Seca moderada, Seca grave, Seca extrema, Seca excepcional. Valor = % da área em cada classe.

**Tempo:** 5.1 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O Monitor de Secas da ANA classifica cada território em seis classes, da menos à mais grave:
> 
> 1. **Sem seca**
> 2. **Seca fraca**
> 3. **Seca moderada**
> 4. **Seca grave**
> 5. **Seca extrema**
> 6. **Seca excepcional**
> 
> Os valores são o percentual da área do território em cada classe. As seis classes somam cerca de 100%.
> 
> Os dados do tabelão do SEDES vão de janeiro de 2024 a abril de 2026 e são de 24/07/2026. Como hoje é 12/11/2026, o site pode ter períodos mais recentes. Se quiser o dado mais atual de algum município ou estado, posso consultar o relatório do site.

## C03 — conceitual

**Pergunta:** O que mede o percentual de pobreza do CadÚnico no SEDES?

**Esperado:** % das famílias inscritas no CadÚnico em situação de pobreza (total, urbana e rural), anual de 2012 a 2025. Não é % da população. Estado e Brasil são média simples dos municípios.

**Tempo:** 6.4 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O índice **Pobreza total (CadÚnico)** mede a **porcentagem de famílias inscritas no Cadastro Único que estão em situação de pobreza**. A unidade é "% das famílias do CadÚnico", não % da área nem % da população.
> 
> O SEDES também traz duas variações:
> - **Pobreza rural**: a mesma conta, só com as famílias rurais.
> - **Pobreza urbana**: a mesma conta, só com as famílias urbanas.
> 
> Os três cobrem de 2012 a 2025, com um valor por ano para cada município. Para estados e para o Brasil, o valor é a **média simples dos municípios**, sem ponderar pelo número de famílias. Isso significa que um município pequeno pesa tanto quanto uma capital. Se quiser um número nacional ou estadual mais representativo, é melhor pedir os dados dos municípios e calcular com outro critério.
> 
> A ferramenta não traz o critério exato de "situação de pobreza" usado pelo SEDES, então não vou detalhá-lo aqui. Os dados são do tabelão do SEDES, com data de 24/07/2026. Se quiser, posso buscar os valores de algum município ou estado.

## C04 — conceitual

**Pergunta:** Quais índices sobre degradação da terra o SEDES tem?

**Esperado:** Dois: Índice de Degradação da Terra (2001 e 2021; níveis 1 a 5 e Conservado) e Dinâmica da Degradação da Terra – ODS 15.3.1 (2021; Degradando, Estável, Melhorando).

**Tempo:** 6.9 s · **turnos:** 2

**Ferramentas chamadas:**

1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES tem dois índices que medem a degradação da terra diretamente e três que ajudam a entendê-la. Os números são do tabelão, com dados de 24/07/2026. Todos são "% da área do território em cada classe".
> 
> **Medem a degradação diretamente:**
> - **Índice de Degradação da Terra** (id `deg`): mostra a área em cada nível de degradação, do Nível 1 (menos degradado) ao Nível 5 (mais degradado), além da classe "Conservado". Períodos disponíveis: 2001 e 2021.
> - **Dinâmica da Degradação da Terra, ODS 15.3.1** (id `ods`): mostra a área que está degradando, estável ou melhorando, seguindo a metodologia da ONU para o Objetivo de Desenvolvimento Sustentável 15.3.1. Período disponível: apenas 2021.
> 
> **Ajudam a entender a degradação:**
> - **Produção Primária Bruta (MODIS)** (id `prodprimariabruta`): mede a produtividade da vegetação, em kg de carbono por m² por ano. Cobre 2001 a 2025. Para municípios, o site recalculou este índice e a diferença é grande, então vale conferir antes de publicar.
> - **Cobertura da Terra (IBGE)** (id `terraibge`): mostra o uso e a cobertura do solo, como pastagem, vegetação florestal e área agrícola. Cobre 2000 a 2020.
> - **Carbono Orgânico do Solo (Embrapa)** (id `carbonoembrapa`): mostra o teor de carbono no solo. Tem apenas o ano de 2020.
> 
> Se quiser, posso mostrar os dados de um município ou estado específico, por exemplo o Índice de Degradação da Terra de 2001 e 2021.

## P01 — valor pontual

**Pergunta:** Como estava a seca em Campina Grande (PB) em abril de 2026, segundo o Monitor de Secas?

**Esperado:** Abr/2026, Monitor de Secas: 71,7% da área em seca moderada e 28,3% em seca fraca. Citar a data dos dados (24/07/2026).

**Tempo:** 6.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, v.classe, c.rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.territorio = '2504009' AND v.periodo = '2026-04' ORDER BY v.classe`

**Resposta do bot:**

> Em abril de 2026, o Monitor de Secas classificou **71,7% da área de Campina Grande (PB) como seca moderada** e **28,3% como seca fraca**. Não houve área sem seca nem em níveis mais graves (grave, extrema ou excepcional).
> 
> Fonte: Monitor de Secas (ANA), abril de 2026, Campina Grande–PB. Dados do tabelão do SEDES de 24/07/2026. O valor é o percentual da área do município em cada classe de seca.

## P02 — valor pontual

**Pergunta:** Qual era o percentual de pobreza rural em Juazeiro do Norte em 2025?

**Esperado:** 47,3% das famílias rurais do CadÚnico em situação de pobreza (Juazeiro do Norte–CE, 2025).

**Tempo:** 5.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Juazeiro do Norte","uf":"CE"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='pob_rural' AND territorio='2307304' AND periodo BETWEEN '2024' AND '2025' ORDER BY periodo`

**Resposta do bot:**

> Em 2025, a pobreza rural em Juazeiro do Norte (CE) era de **47,3%** das famílias rurais inscritas no CadÚnico.
> 
> Ou seja, quase metade dessas famílias estava em situação de pobreza. Em 2024, o índice era de 49,6%.
> 
> Fonte: Pobreza rural (CadÚnico), 2025, Juazeiro do Norte–CE. Dados do tabelão do SEDES de 24/07/2026.

## P03 — valor pontual

**Pergunta:** Quantos registros de seca e estiagem Petrolina teve em 2024?

**Esperado:** 2 registros em 2024 pelo tabelão. Observação: o relatório atual do site mostra 1 (a contagem foi refeita depois). Acerto = 2 com a fonte citada; mencionar a divergência é bônus.

**Tempo:** 5.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Petrolina"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='s2id_secas_estiagens' AND territorio='2611101' AND periodo BETWEEN '2023' AND '2025' ORDER BY periodo`

**Resposta do bot:**

> Petrolina (PE) teve **2 registros** de seca ou estiagem em 2024.
> 
> Fonte: S2iD (Sistema Integrado de Informações sobre Desastres), registros de secas e estiagens, ano de 2024, Petrolina–PE. Dados do tabelão do SEDES de 24/07/2026. Cada registro é uma contagem de ocorrências reconhecidas, não uma área em percentual.
> 
> Observação: o site do SEDES recalcula essa contagem, então o número atual no site pode ser diferente.

## P04 — valor pontual

**Pergunta:** Qual é a cobertura da terra predominante em Sobral, no Ceará?

**Esperado:** Vegetação campestre, com 85,9% da área em 2020 (depois vegetação florestal 4,9% e mosaico florestal 4,3%).

**Tempo:** 6.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Sobral"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, v.classe, c.rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice='terraibge' AND c.ordem=v.classe WHERE v.indice='terraibge' AND v.territorio='2312908' AND v.periodo='2020' ORDER BY v.valor DESC`

**Resposta do bot:**

> A cobertura predominante em Sobral (CE) é **vegetação campestre**, que ocupa **85,9%** da área do município.
> 
> Os demais tipos somam cerca de 14%: vegetação florestal (4,9%), mosaico florestal (4,3%), mosaico campestre (3,2%), área artificial (1,1%) e corpo d'água continental (0,6%).
> 
> Fonte: Cobertura da Terra (IBGE), ano 2020, Sobral–CE (dados do SEDES de 24/07/2026). O índice tem dados para 2000, 2010, 2014, 2016, 2018 e 2020; 2020 é o ano mais recente no tabelão.

## P05 — valor pontual

**Pergunta:** Qual era a situação do CDI na Paraíba em janeiro de 2026?

**Esperado:** Jan/2026: Estágio 2 49,5%, Estágio 1 27,1%, Estágio 3 23,3%, Sem seca 0,1%. Ou seja, ~99,9% da área em algum estágio de seca.

**Tempo:** 6.2 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, i.rotulo AS classe, v.valor FROM valores v JOIN classes i ON i.indice = v.indice AND i.ordem = v.classe WHERE v.indice = 'CDI_Test' AND v.territorio = 'pb' AND v.periodo = '2026-01' ORDER BY v.classe`

**Resposta do bot:**

> Em janeiro de 2026, quase toda a Paraíba estava em seca pelo CDI (Índice Combinado de Seca):
> 
> - **Estágio 2:** 49,5% da área
> - **Estágio 1:** 27,1% da área
> - **Estágio 3** (o mais grave): 23,3% da área
> - **Sem seca:** 0,1% da área
> - **Recuperação (total ou parcial):** 0%
> 
> Ou seja, 99,9% do território estava com algum nível de seca. O Estágio 2 foi a faixa mais frequente.
> 
> Fonte: CDI – Índice Combinado de Seca, janeiro de 2026, Paraíba (dados do SEDES de 24/07/2026). O tabelão é mensal, e o site hoje usa uma versão decendial recalculada, então os números do site podem ser um pouco diferentes.

## P06 — valor pontual

**Pergunta:** Qual é o PIB de Campina Grande?

**Esperado:** O tabelão não tem PIB. O relatório do site tem (índice produto-interno-bruto): cerca de R$ 12,9 bilhões em 2023. Acerto = buscar no relatório; também vale dizer que o tabelão não tem e oferecer o relatório. Errado = inventar um número.

**Tempo:** 7.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"2504009","periodo":"2026","indice":"pib"}`

**Resposta do bot:**

> O PIB de Campina Grande (PB) em 2023 foi de cerca de **R$ 12,9 bilhões**.
> 
> Série disponível:
> - 2010: R$ 5,0 bilhões
> - 2020: R$ 10,1 bilhões
> - 2023: R$ 12,9 bilhões
> 
> O PIB é a soma de tudo o que o município produz em bens e serviços num ano. Esse dado veio do relatório atual do site SEDES (calculado em 12/11/2026), não do tabelão, que não tem esse índice. Os valores são em reais correntes, sem descontar a inflação.

## R01 — ranking

**Pergunta:** Quais os 5 municípios da Paraíba com maior percentual de pobreza total em 2025?

**Esperado:** Juarez Távora 74,2%, Curral de Cima 73,9%, Santa Inês 73,2%, Cacimbas 73,1%, Pedro Régis 72,8%.

**Tempo:** 6.1 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT v.territorio, t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'pob_total' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.uf = 'PB' AND v.classe = 1 ORDER BY v.valor DESC LIMIT 5`

**Resposta do bot:**

> Os 5 municípios da Paraíba com maior percentual de pobreza total em 2025 são:
> 
> 1. **Juarez Távora**: 74,2%
> 2. **Curral de Cima**: 73,9%
> 3. **Santa Inês**: 73,2%
> 4. **Cacimbas**: 73,1%
> 5. **Pedro Régis**: 72,8%
> 
> Esse índice é o "% das famílias inscritas no CadÚnico que estão em situação de pobreza" (Pobreza total, CadÚnico, ano de 2025). Fonte: tabelão do SEDES, dados de 24/07/2026.

## R02 — ranking

**Pergunta:** Quais municípios do Semiárido tinham mais área em seca grave ou pior no Monitor de Secas em abril de 2026?

**Esperado:** 41 municípios do Semiárido estavam com 100% da área em seca grave ou pior em abr/2026 (33 no PI, 6 no CE, 2 no RN), por exemplo Tibau e Baraúna (RN), Russas e Limoeiro do Norte (CE), Wall Ferraz (PI). Acerto = dizer que há empate em 100% e dar exemplos.

**Tempo:** 13.1 s · **turnos:** 5

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, ROUND(SUM(v.valor),1) AS pct_grave_ou_pior, COUNT(*) AS n_classes FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND v.classe IN (4,5,6) AND t.tipo = 'municipio' AND t.semiarido = 1 GROUP BY t.codigo, t.nome, t.uf ORDER BY pct_grave_ou_pior DESC LIMIT 20`
1. `consultar_sql: SELECT COUNT(DISTINCT t.codigo) AS n_municipios_semiarido, SUM(CASE WHEN s.pct >= 100 THEN 1 ELSE 0 END) AS n_100 FROM territorios t LEFT JOIN (SELECT territorio, SUM(valor) AS pct FROM valores WHERE indice='anaseca' AND periodo='2026-04' AND classe IN (4,5,6) GROUP BY territorio) s ON s.territorio = t.codigo WHERE t.tipo='municipio' AND t.semiarido=1`
1. `consultar_sql: SELECT t.nome || ' (' || t.uf || ')' AS municipio FROM territorios t JOIN (SELECT territorio, SUM(valor) AS pct FROM valores WHERE indice='anaseca' AND periodo='2026-04' AND classe IN (4,5,6) GROUP BY territorio HAVING SUM(valor) >= 99.95) s ON s.territorio = t.codigo WHERE t.tipo='municipio' AND t.semiarido=1 ORDER BY t.uf, t.nome`

**Resposta do bot:**

> Em abril de 2026, **41 municípios do Semiárido** tinham 100% da área em seca grave, extrema ou excepcional (Monitor de Secas, dados do SEDES de 24/07/2026). Nenhum outro município do Semiárido chegou a esse nível. Entre os 1.477 municípios do Semiárido, esses 41 são os únicos com o máximo possível.
> 
> - **Piauí (33):** Aroeiras do Itaim, Barra D'Alcântara, Bocaina, Campinas do Piauí, Campo Grande do Piauí, Colônia do Piauí, Dom Expedito Lopes, Floresta do Piauí, Francisco Santos, Geminiano, Inhuma, Ipiranga do Piauí, Isaías Coelho, Itainópolis, Jaicós, Lagoa do Sítio, Monsenhor Hipólito, Novo Oriente do Piauí, Paquetá, Picos, Santa Cruz do Piauí, Santa Rosa do Piauí, Santana do Piauí, Santo Antônio de Lisboa, Santo Inácio do Piauí, Sussuapara, São José do Piauí, São João da Canabrava, São João da Varjota, São Luis do Piauí, São Miguel do Fidalgo, Vera Mendes e Wall Ferraz.
> - **Ceará (6):** Itaiçaba, Jaguaruana, Limoeiro do Norte, Quixeré, Russas e Tabuleiro do Norte.
> - **Rio Grande do Norte (2):** Baraúna e Tibau.
> 
> Como o índice é dado em % da área do município, não em km², a comparação é pela proporção do território, não pela área total em quilômetros quadrados.

## R03 — ranking

**Pergunta:** Quais estados tinham a maior parte da área em seca pelo CDI em janeiro de 2026?

**Esperado:** CDI jan/2026, soma dos Estágios 1 a 3: Paraíba 99,9%, Rio Grande do Norte 98,2%, Pernambuco 97,6%, Goiás 96,1%, Piauí 95,5%.

**Tempo:** 9.2 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, t.uf, ROUND(SUM(CASE WHEN v.classe IN (2,3,4) THEN v.valor ELSE 0 END),1) AS area_seca, ROUND(SUM(CASE WHEN v.classe=4 THEN v.valor ELSE 0 END),1) AS estagio3 FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='CDI_Test' AND v.periodo='2026-01' AND t.tipo='estado' GROUP BY t.nome, t.uf ORDER BY area_seca DESC`

**Resposta do bot:**

> Em janeiro de 2026, 14 estados tinham mais da metade do território em algum estágio de seca pelo CDI (Índice Combinado de Seca). Os cinco com maior área em seca foram:
> 
> 1. **Paraíba (PB):** 99,9%
> 2. **Rio Grande do Norte (RN):** 98,2%
> 3. **Pernambuco (PE):** 97,6%
> 4. **Goiás (GO):** 96,1%
> 5. **Piauí (PI):** 95,5%
> 
> Logo depois vêm Maranhão (95,3%), Ceará (88,4%), Distrito Federal (85,8%), Tocantins (85,7%), Alagoas (78,2%), Mato Grosso do Sul (63,0%), São Paulo (56,0%), Mato Grosso (52,3%) e Pará (52,0%).
> 
> Os números são a soma dos estágios 1, 2 e 3 de seca, em % da área de cada estado. Entre os estados, o Ceará se destaca pela gravidade: 28,5% da área está no estágio 3, o mais grave, bem acima dos outros.
> 
> Fonte: CDI – Índice Combinado de Seca, janeiro de 2026, tabelão do SEDES (dados de 24/07/2026). O site usa agora uma versão recalculada a cada dez dias, então os valores podem diferir do que aparece lá.

## R04 — ranking

**Pergunta:** No bioma Caatinga, quais municípios tiveram mais registros de seca e estiagem em 2025?

**Esperado:** Coronel José Dias, Curral Novo do Piauí, Dirceu Arcoverde e São Lourenço do Piauí (todos no PI), com 7 registros cada em 2025; vários outros do PI com 6.

**Tempo:** 7.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT v.territorio, t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 's2id_secas_estiagens' AND v.periodo = '2025' AND t.bioma = 'Caatinga' AND t.tipo = 'municipio' ORDER BY v.valor DESC LIMIT 15`
1. `consultar_sql: SELECT COUNT(*) AS n, SUM(v.valor) AS total, AVG(v.valor) AS media FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 's2id_secas_estiagens' AND v.periodo = '2025' AND t.bioma = 'Caatinga' AND t.tipo = 'municipio'`

**Resposta do bot:**

> No bioma Caatinga, o município com mais registros de seca e estiagem em 2025 foi **Curral Novo do Piauí (PI), com 7 registros**. Também tiveram 7 registros:
> 
> - Coronel José Dias (PI)
> - São Lourenço do Piauí (PI)
> - Dirceu Arcoverde (PI)
> 
> Logo atrás, com 6 registros, aparecem outros 7 municípios, todos no Piauí: Itainópolis, Belém do Piauí, Alegrete do Piauí, Acauã, São Francisco de Assis do Piauí, Dom Inocêncio e Lagoa do Barro do Piauí. Em seguida vêm os municípios pernambucanos com 5 registros, como Santa Cruz do Capibaribe, Toritama, Taquaritinga do Norte e Águas Belas.
> 
> Para comparação, a média entre os 1.095 municípios da Caatinga com dado em 2025 foi de 1,7 registro por município (total de 1.813 registros).
> 
> O índice é a contagem de registros de seca ou estiagem no S2iD (Sistema Integrado de Informações sobre Desastres), não uma porcentagem de área. Os dados são do tabelão do SEDES, de 24/07/2026. O site recalculou essa contagem depois, então os números podem ser um pouco diferentes do que aparece lá.

## R05 — ranking

**Pergunta:** Qual estado do Nordeste tem a maior parte da área degradando, segundo o ODS 15.3.1?

**Esperado:** Sergipe, com 33,3% da área degradando (2021). Depois Bahia 18,4% e Alagoas 16,1%. Observação: os números de estado do tabelão diferem do site para este índice.

**Tempo:** 6.7 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.codigo, t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'ods' AND v.periodo = '2021' AND v.classe = 1 AND t.tipo = 'estado' AND t.regiao LIKE '%ordeste%' ORDER BY v.valor DESC`
1. `consultar_sql: SELECT t.codigo, t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'ods' AND v.periodo = '2021' AND v.classe = 1 AND t.tipo = 'estado' AND t.codigo IN ('ma','pi','ce','rn','pb','pe','al','se','ba') ORDER BY v.valor DESC`

**Resposta do bot:**

> **Sergipe** tem a maior parte da área em degradação, com **33,3%** do território classificado como "Degradando" pelo ODS 15.3.1 (dados de 2021, tabelão do SEDES de 24/07/2026).
> 
> Os demais estados do Nordeste, em ordem decrescente:
> 
> | Estado | Área degradando |
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
> O índice mede a porcentagem da área de cada território que está em processo de degradação da terra. A base tem só o ano de 2021. Para os estados, o SEDES indica que os valores podem diferir do relatório atual do site, então vale conferir lá se for usar o número em publicação.

## T01 — tendência

**Pergunta:** Como evoluiu a pobreza total em Campina Grande de 2012 a 2025?

**Esperado:** Caiu de 79,1% em 2012 para 36,9% em 2025, com queda forte até 2017 (45,2%), estabilidade perto de 40% e um pico em 2022 (45,5%).

**Tempo:** 6.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Campina Grande","uf":"PB"}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='pob_total' AND territorio='2504009' ORDER BY periodo`

**Resposta do bot:**

> Em Campina Grande (PB), a pobreza total caiu de 79,1% em 2012 para 36,9% em 2025, uma redução de cerca de 42 pontos percentuais. A queda não foi contínua: houve uma alta em 2022.
> 
> Série anual (% das famílias inscritas no CadÚnico em situação de pobreza):
> 
> - 2012: 79,1%
> - 2013: 72,3%
> - 2014: 62,8%
> - 2015: 50,8%
> - 2016: 47,1%
> - 2017: 45,2%
> - 2018: 42,3%
> - 2019: 40,9%
> - 2020: 41,0%
> - 2021: 39,3%
> - 2022: 45,5% (única alta da série)
> - 2023: 39,5%
> - 2024: 39,7%
> - 2025: 36,9%
> 
> A maior parte da queda ocorreu entre 2012 e 2015. Desde 2019 o indicador oscilou entre cerca de 37% e 46%.
> 
> Fonte: Pobreza total (CadÚnico), SEDES, dados do tabelão de 24/07/2026.

## T02 — tendência

**Pergunta:** A seca no Ceará piorou ou melhorou entre janeiro e abril de 2026, pelo Monitor de Secas?

**Esperado:** Melhorou: em janeiro havia 27,3% em seca extrema e 20,9% em grave; em abril não havia seca extrema, só 6,7% em grave, e a maior parte em seca fraca (52,1%) ou moderada (41,2%).

**Tempo:** 7.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Ceará","uf":"CE"}`
1. `consultar_sql: SELECT v.periodo, c.rotulo, v.valor FROM valores v LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.territorio = 'ce' AND v.periodo BETWEEN '2025-12' AND '2026-04' ORDER BY v.periodo, v.classe`

**Resposta do bot:**

> A seca no Ceará **melhorou** entre janeiro e abril de 2026, segundo o Monitor de Secas (ANA). Em abril, a área em seca grave, extrema ou excepcional caiu para 6,7%, contra 48,2% em janeiro.
> 
> | Mês | Seca moderada | Seca grave | Seca extrema | Seca fraca |
> |---|---|---|---|---|
> | Jan/2026 | 49,6% | 20,9% | 27,3% | 2,2% |
> | Abr/2026 | 41,2% | 6,7% | 0% | 52,1% |
> 
> O índice mostra a % da área do Ceará em cada faixa de severidade. Em abril, a seca extrema desapareceu e quase metade do estado passou para a faixa mais leve (fraca).
> 
> Fonte: Monitor de Secas (ANA), Ceará, janeiro a abril de 2026 (dados do SEDES de 24/07/2026).

## T03 — tendência

**Pergunta:** Em que ano o Brasil teve mais registros de seca e estiagem?

**Esperado:** 2013, com 3.275 registros. Depois vêm 2025 (2.780) e 2017 (2.760). Ressalva: faltam 2010–2012, 2014 e 2016 no tabelão.

**Tempo:** 7.3 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, valor FROM valores WHERE indice='s2id_secas_estiagens' AND territorio='br' ORDER BY valor DESC`

**Resposta do bot:**

> O ano com mais registros de seca e estiagem no tabelão do SEDES foi **2013, com 3.275 registros** no Brasil (Registros de secas e estiagens do S2iD, dados de 24/07/2026). Depois vêm 2025 (2.780) e 2017 (2.760).
> 
> Dois cuidados:
> 
> - Os anos 2010, 2011, 2012, 2014 e 2016 não estão no tabelão, então não consigo afirmar que 2013 foi o maior de toda a série. Esses anos podem ter tido mais registros.
> - O site hoje usa uma contagem refeita, que pode dar números diferentes. Se quiser o valor atualizado de algum ano, posso consultar o relatório do site.

## T04 — tendência

**Pergunta:** Em que mês de 2025 a Paraíba teve a maior área em seca pelo CDI?

**Esperado:** Dezembro de 2025, com 62,8% da área em algum estágio de seca; depois maio (36,4%) e junho (28,1%).

**Tempo:** 8.1 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT periodo, SUM(CASE WHEN classe IN (2,3,4) THEN valor ELSE 0 END) AS area_seca, SUM(CASE WHEN classe=2 THEN valor ELSE 0 END) AS est1, SUM(CASE WHEN classe=3 THEN valor ELSE 0 END) AS est2, SUM(CASE WHEN classe=4 THEN valor ELSE 0 END) AS est3 FROM valores WHERE indice='CDI_Test' AND territorio='pb' AND periodo BETWEEN '2025-01' AND '2025-12' GROUP BY periodo ORDER BY area_seca DESC`
1. `consultar_sql: SELECT periodo, classe, valor FROM valores WHERE indice='CDI_Test' AND territorio='pb' AND periodo BETWEEN '2025-01' AND '2025-12' ORDER BY periodo, classe`

**Resposta do bot:**

> Foi em **dezembro de 2025**. Nesse mês, **62,8% da área da Paraíba** estava em algum estágio de seca pelo CDI (Índice Combinado de Seca).
> 
> - Estágio 1: 55,7%
> - Estágio 2: 7,1%
> - Estágio 3 (o mais grave): 0%
> 
> Considerei "em seca" a soma dos três estágios de seca. O segundo maior valor foi maio de 2025, com 36,4%.
> 
> Fonte: CDI – Índice Combinado de Seca, estado da Paraíba, dados mensais do tabelão do SEDES de 24/07/2026. O site usa uma versão decendial recalculada, então os números podem diferir um pouco do que aparece lá.

## X01 — cruzamento

**Pergunta:** Quais municípios do Semiárido estavam com mais de 90% da área em seca grave ou pior em abril de 2026 e também têm pobreza total acima de 60% em 2025?

**Esperado:** Cinco municípios, todos no Piauí: Wall Ferraz (pobreza 68,8%), Aroeiras do Itaim (67,0%), Jaicós (64,9%), Santa Rosa do Piauí (61,5%) e Sussuapara (61,0%), todos com 100% da área em seca grave ou pior.

**Tempo:** 7.4 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH seca AS ( SELECT territorio, SUM(valor) AS pct_grave_ou_pior FROM valores WHERE indice = 'anaseca' AND periodo = '2026-04' AND classe IN (4,5,6) GROUP BY territorio ), pob AS ( SELECT territorio, valor AS pobreza_total FROM valores WHERE indice = 'pob_total' AND periodo = '2025' AND classe = 1 ) SELECT t.codigo, t.nome, t.uf, ROUND(s.pct_grave_ou_pior,1) AS seca_grave_ou_pior_pct, ROUND(p.pobreza_total,1) AS pobreza_total_pct FROM territorios t JOIN seca s ON s.territorio = t.codigo JOIN pob p ON p.territorio = t.codigo WHERE t.tipo = 'municipio' AND t.semiarido = 1 AND s.pct_grave_ou_pior > 90 AND p.pobreza_total > 60 ORDER BY s.pct_grave_ou_pior DESC, p.pobreza_total DESC`

**Resposta do bot:**

> Encontrei **5 municípios do Semiárido** que atendem aos dois critérios:
> 
> | Município | Área em seca grave ou pior (abril/2026) | Pobreza total (2025) |
> |---|---|---|
> | Wall Ferraz–PI | 100% | 68,8% |
> | Aroeiras do Itaim–PI | 100% | 67,0% |
> | Jaicós–PI | 100% | 64,9% |
> | Santa Rosa do Piauí–PI | 100% | 61,5% |
> | Sussuapara–PI | 100% | 61,0% |
> 
> **Fontes e significados:**
> - **Seca:** Monitor de Secas (ANA), abril de 2026. Soma das classes "seca grave", "extrema" e "excepcional", ou seja, a parte do território nessas condições.
> - **Pobreza:** CadÚnico, 2025. Percentual das famílias inscritas que estão em situação de pobreza.
> - Dados do tabelão do SEDES, de 24/07/2026.
> 
> Todos os cinco estão no Piauí.

## X02 — cruzamento

**Pergunta:** Entre os municípios com mais da metade da área nos níveis 3 a 5 de degradação em 2021, quais têm a maior pobreza rural em 2025?

**Esperado:** 2.268 municípios têm mais da metade da área nos níveis 3 a 5. Os de maior pobreza rural em 2025: Campo Grande–AL (81,0%), Potiraguá–BA (79,9%), Senador Elói de Souza–RN (79,7%), Colônia Leopoldina–AL (78,0%), Feira Nova–PE (77,9%). Atenção: o nível 5 é o mais degradado; as classes 1 a 3 do tabelão são os níveis 5, 4 e 3.

**Tempo:** 8.6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH deg AS ( SELECT v.territorio, SUM(v.valor) AS pct_nivel3_5 FROM valores v WHERE v.indice = 'deg' AND v.periodo = '2021' AND v.classe IN (1,2,3) GROUP BY v.territorio HAVING SUM(v.valor) > 50 ), pob AS ( SELECT territorio, valor AS pobreza_rural FROM valores WHERE indice = 'pob_rural' AND periodo = '2025' AND classe = 1 ) SELECT t.nome, t.uf, ROUND(d.pct_nivel3_5,1) AS pct_deg_niveis_3_5_2021, ROUND(p.pobreza_rural,1) AS pobreza_rural_2025 FROM deg d JOIN territorios t ON t.codigo = d.territorio AND t.tipo = 'municipio' LEFT JOIN pob p ON p.territorio = d.territorio ORDER BY p.pobreza_rural DESC LIMIT 15;`

**Resposta do bot:**

> Os três municípios com maior pobreza rural em 2025 entre os que tinham mais da metade da área nos níveis 3 a 5 de degradação em 2021 são:
> 
> 1. **Campo Grande (AL)**: 81,0% das famílias rurais do CadÚnico em pobreza; 89,1% da área em níveis 3 a 5 (2021)
> 2. **Potiraguá (BA)**: 79,9%; 69,5% da área
> 3. **Senador Elói de Souza (RN)**: 79,7%; 75,0% da área
> 
> Outros destaques da lista: Colônia Leopoldina (AL), com 78,0%, e Feira Nova (PE), com 77,9%.
> 
> Os dados são do tabelão do SEDES, de 24/07/2026. "Pobreza rural" é a % das famílias rurais inscritas no CadÚnico em situação de pobreza, em 2025. "Níveis 3 a 5" são as áreas mais degradadas do Índice de Degradação da Terra, em % do território, em 2021.

## X03 — cruzamento

**Pergunta:** Na Paraíba, os municípios com mais pobreza em 2025 tiveram mais registros de seca em 2025?

**Esperado:** Não: dividindo os 223 municípios da PB em quatro faixas de pobreza, a média de registros fica em ~1,2 em todas. Não há relação visível. Acerto = conclusão de "sem relação clara" baseada nos dados.

**Tempo:** 18.4 s · **turnos:** 6

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: WITH p AS ( SELECT v.territorio, t.nome, v.valor AS pobreza FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.uf='PB' AND t.tipo='municipio' ), s AS ( SELECT territorio, valor AS registros FROM valores WHERE indice='s2id_secas_estiagens' AND periodo='2025' ) SELECT p.nome, p.pobreza, s.registros FROM p LEFT JOIN s ON s.territorio=p.territorio ORDER BY p.pobreza DESC`
1. `consultar_sql: SELECT COUNT(*) AS n_pb_pobreza, (SELECT COUNT(*) FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='s2id_secas_estiagens' AND v.periodo='2025' AND t.uf='PB' AND t.tipo='municipio') AS n_pb_secas, (SELECT COUNT(DISTINCT classe) FROM valores WHERE indice='pob_total' AND periodo='2025') AS n_classes_pob FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.uf='PB' AND t.tipo='municipio'`
1. `consultar_sql: WITH p AS ( SELECT v.territorio, v.valor AS x FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.uf='PB' AND t.tipo='municipio' ), s AS ( SELECT t.territorio, v.valor AS y FROM valores v JOIN p t ON t.territorio=v.territorio WHERE v.indice='s2id_secas_estiagens' AND v.periodo='2025' ), j AS (SELECT p.territorio, p.x, s.y FROM p JOIN s ON s.territorio=p.territorio), r AS (SELECT x, y, NTILE(4) OVER (ORDER BY x DESC) AS quartil FROM j) SELECT 'Q' || quartil AS grupo_pobreza, COUNT(*) AS municipios, ROUND(MIN(x),1) AS pob_min, ROUND(MAX(x),1) AS pob_max, ROUND(AVG(y),2) AS media_registros, SUM(y) AS total_registros, SUM(CASE WHEN y=0 THEN 1 ELSE 0 END) AS sem_registro FROM r GROUP BY quartil ORDER BY quartil UNION ALL SELECT 'Correlação (r)', COUNT(*), NULL, NULL, ROUND((COUNT(*)*SUM(x*y)-SUM(x)*SUM(y)) / sqrt((COUNT(*)*SUM(x*x)-SUM(x)*SUM(x))*(COUNT(*)*SUM(y*y)-SUM(y)*SUM(y))),3), NULL, NULL FROM j`
1. `consultar_sql: WITH p AS ( SELECT v.territorio, v.valor AS x FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='pob_total' AND v.periodo='2025' AND t.uf='PB' AND t.tipo='municipio' ), j AS (SELECT p.territorio, p.x, v.valor AS y FROM p JOIN valores v ON v.territorio=p.territorio WHERE v.indice='s2id_secas_estiagens' AND v.periodo='2025'), r AS (SELECT x, y, NTILE(4) OVER (ORDER BY x DESC) AS quartil FROM j) SELECT 'Q' || quartil AS grupo_pobreza, COUNT(*) AS municipios, ROUND(MIN(x),1) AS pob_min, ROUND(MAX(x),1) AS pob_max, ROUND(AVG(y),2) AS media_registros, SUM(y) AS total_registros, SUM(CASE WHEN y=0 THEN 1 ELSE 0 END) AS sem_registro FROM r GROUP BY quartil UNION ALL SELECT 'correlacao_r', COUNT(*), NULL, NULL, ROUND((COUNT(*)*SUM(x*y)-SUM(x)*SUM(y)) / sqrt((COUNT(*)*SUM(x*x)-SUM(x)*SUM(x))*(COUNT(*)*SUM(y*y)-SUM(y)*SUM(y))),3), NULL, NULL FROM j`

**Resposta do bot:**

> **Não.** Em 2025, os municípios paraibanos com mais pobreza não tiveram mais registros de seca do que os demais. A relação entre as duas coisas é praticamente nula.
> 
> - **Pobreza:** % das famílias do CadÚnico em situação de pobreza, 2025 (dados do SEDES de 24/07/2026).
> - **Seca:** número de registros de seca e estiagem no S2iD, 2025 (contagem, não %).
> 
> Dividi os 223 municípios da Paraíba em quatro grupos de tamanho igual, do mais pobre ao menos pobre:
> 
> | Grupo de pobreza | Faixa de pobreza | Média de registros de seca |
> |---|---|---|
> | Mais pobres (Q1) | 62,8% a 74,2% | 1,16 |
> | Q2 | 58,6% a 62,7% | 1,16 |
> | Q3 | 52,9% a 58,6% | 1,21 |
> | Menos pobres (Q4) | 34,5% a 52,9% | 1,20 |
> 
> A correlação entre as duas variáveis é de −0,05, num intervalo de −1 a 1, então não há associação prática.
> 
> Alguns exemplos do topo do ranking de pobreza: Juarez Távora (74,2%) teve 0 registros de seca em 2025, Curral de Cima (73,9%) teve 1 e Cacimbas (73,1%) teve 2.
> 
> Observações:
> - O S2iD conta registros administrativos, que dependem de cada prefeitura declarar a situação. Ele não mede a seca em si. Para medir a seca, o índice mais adequado seria o Monitor de Secas (ANA), mas ele só tem dados até abril de 2026 e não foi usado aqui.
> - O site do SEDES recalculou a contagem do S2iD, então os números podem diferir do que aparece no relatório atual.

## A01 — recorte agregado

**Pergunta:** Como estava a seca no bioma Caatinga em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, bioma Caatinga: seca moderada 55,0%, seca fraca 34,8%, sem seca 5,3% e seca grave 4,9%.

**Tempo:** 6.3 s · **turnos:** 3

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT t.nome, v.periodo, c.rotulo, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND v.territorio = '3_bioma-caatinga' ORDER BY v.classe`

**Resposta do bot:**

> Em abril de 2026, cerca de 95% da Caatinga estava em algum grau de seca, e a maior parte (55%) em seca moderada.
> 
> Monitor de Secas (ANA), abril de 2026, bioma Caatinga (dados do SEDES de 24/07/2026). Percentual da área do bioma em cada nível:
> 
> - Sem seca: 5,3%
> - Seca fraca: 34,8%
> - Seca moderada: 55,0%
> - Seca grave: 4,9%
> - Seca extrema: 0%
> - Seca excepcional: 0%
> 
> Não houve seca extrema nem excepcional no bioma nesse mês.

## A02 — recorte agregado

**Pergunta:** Qual é o percentual de pobreza total na região Nordeste?

**Esperado:** O tabelão não tem valor próprio da região para pobreza. A média simples dos municípios do Nordeste em 2025 é 57,9% (o relatório do site dá o mesmo 57,9%). Por estado, vai de 52,9% (RN) a 64,6% (MA). Acerto = 57,9% com a ressalva da média, ou faixa por estado.

**Tempo:** 9.9 s · **turnos:** 5

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"2_regiao-nordeste","periodo":"2025","indice":"pob_total"}`
1. `consultar_sql: SELECT t.nome, v.periodo, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio WHERE v.indice = 'pob_total' AND v.periodo = '2025' AND t.tipo = 'estado' AND t.regiao = 'Nordeste' ORDER BY t.nome`
1. `relatorio_territorio: {"chave":"2_regiao-nordeste","periodo":"2025","indice":"percentual-de-pobreza-total-cadunico"}`

**Resposta do bot:**

> Em 2025, **57,9% das famílias inscritas no CadÚnico** da região Nordeste estavam em situação de pobreza (índice "Pobreza total – CadÚnico", dados do relatório atual do site, calculado em 12/11/2026).
> 
> Isso não é percentual da população. O índice mede a parcela das famílias cadastradas no CadÚnico que se enquadram como pobres. O valor regional é uma média simples dos estados e municípios, sem ponderar pelo número de famílias.
> 
> Pelos estados no tabelão do SEDES (dados de 24/07/2026), a média simples também dá 57,9%. Os extremos são Maranhão (64,6%) e Rio Grande do Norte (52,9%).

## A03 — recorte agregado

**Pergunta:** Qual parte do Brasil estava em seca em abril de 2026, pelo Monitor de Secas?

**Esperado:** Abr/2026, Brasil: 58,4% sem seca, 26,4% seca fraca, 14,4% moderada, 0,9% grave. Ou seja, ~41,6% da área com algum grau de seca.

**Tempo:** 9.2 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `consultar_sql: SELECT v.territorio, t.nome, v.classe, c.rotulo, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND v.territorio IN ('br', '2_regiao-nordeste') ORDER BY v.territorio, v.classe`
1. `consultar_sql: SELECT v.territorio, t.nome, v.classe, c.rotulo, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND t.tipo = 'estado' ORDER BY v.territorio, v.classe`

**Resposta do bot:**

> Em abril de 2026, cerca de **41,6% da área do Brasil estava em algum nível de seca**, segundo o Monitor de Secas (ANA). Os outros 58,4% estavam sem seca.
> 
> - Seca fraca: 26,4%
> - Seca moderada: 14,4%
> - Seca grave: 0,9%
> - Seca extrema e excepcional: 0%
> 
> No Nordeste, a seca atingiu 71,5% da área, com destaque para a seca moderada (38,3%). Entre os estados, Pernambuco (68,2% em seca moderada), Paraíba (59,3% em moderada) e Ceará (41,2% em moderada e 6,7% em grave) estavam entre os mais afetados.
> 
> Dados do SEDES de 24/07/2026. Os valores são percentuais da área de cada território.

## A04 — recorte agregado

**Pergunta:** Como está a degradação da terra no Semiárido?

**Esperado:** O tabelão não tem o Semiárido para degradação. O relatório do site (5_semiarido-semiarido-total, 2021) dá: Conservado 75,5%, Nível 3 12,7%, Nível 4 7,4%, Nível 2 3,9%, Nível 5 0,3%, Nível 1 0,2%; ODS: 7,9% degradando. Acerto = usar o relatório, ou dizer que não há o recorte e oferecer média dos municípios com ressalva.

**Tempo:** 10.8 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"5_semiarido-semiarido-total","periodo":"2021","indice":"degradacao"}`
1. `consultar_sql: SELECT i.id, v.periodo, v.classe, v.valor FROM valores v JOIN indices i ON i.id = v.indice WHERE v.territorio = 'br' AND i.id IN ('ods','deg') ORDER BY i.id, v.periodo, v.classe`

**Resposta do bot:**

> No Semiárido, a degradação da terra **avançou pouco entre 2001 e 2021, mas a área já degradada cresceu**. Em 2021, 75,5% da área está conservada, contra 81,8% em 2001.
> 
> **Índice de Degradação da Terra** (% da área do Semiárido, relatório atual do site, calculado em 12/11/2026):
> 
> | Situação | 2001 | 2021 |
> |---|---|---|
> | Conservado | 81,8% | 75,5% |
> | Níveis 1 e 2 (degradação leve) | 1,9% | 4,1% |
> | Níveis 3 a 5 (degradação mais forte) | 16,4% | 20,4% |
> 
> Os níveis 3 a 5 somam a área degradada em grau mais alto. O nível 5 é o mais grave e cobre só 0,3% nos dois anos.
> 
> **Dinâmica da degradação (ODS 15.3.1), 2021:** 91,6% da área está estável, 7,9% está degradando e 0,5% está melhorando. Esse índice só tem o ano de 2021.
> 
> Os dados do Semiárido vêm do relatório atual do site. No tabelão do SEDES (retrato de 24/07/2026), o Semiárido não tem valor próprio para esses índices.

## H01 — homônimo

**Pergunta:** Como está a seca em Santa Luzia?

**Esperado:** Perguntar qual Santa Luzia: há quatro (BA, MA, MG e PB). Não pode escolher uma sozinho.

**Tempo:** 4.5 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Santa Luzia"}`

**Resposta do bot:**

> Existem quatro municípios chamados Santa Luzia. Qual deles você quer consultar?
> 
> - **Santa Luzia–PB** (Semiárido e Caatinga)
> - **Santa Luzia–MA** (Maranhão)
> - **Santa Luzia–MG** (Minas Gerais)
> - **Santa Luzia–BA** (Bahia)
> 
> Assim que você escolher, eu consulto o Monitor de Secas e mostro a situação atual.

## H02 — homônimo

**Pergunta:** Qual é o percentual de pobreza em Bom Jesus em 2025?

**Esperado:** Perguntar qual Bom Jesus (PB, PI, RN, RS, SC) ou listar as cinco: PB 51,4%, PI 54,5%, RN 56,6%, RS 45,0%, SC 37,9%.

**Tempo:** 4.2 s · **turnos:** 2

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Bom Jesus"}`

**Resposta do bot:**

> Existem cinco municípios chamados Bom Jesus. Qual você quer?
> 
> - Bom Jesus (PB)
> - Bom Jesus (PI)
> - Bom Jesus (RN)
> - Bom Jesus (RS)
> - Bom Jesus (SC)
> 
> Assim que você escolher a UF, eu busco o percentual de pobreza de 2025 para esse município.

## H03 — homônimo

**Pergunta:** E o CDI de São Domingos da Paraíba em janeiro de 2026?

**Esperado:** O usuário já deu a UF. São Domingos–PB, CDI jan/2026: 97,7% da área no Estágio 3 e 2,3% no Estágio 2.

**Tempo:** 6.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"São Domingos","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, c.rotulo AS classe, v.valor FROM valores v LEFT JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'CDI_Test' AND v.territorio = '2513968' AND v.periodo = '2026-01' ORDER BY v.classe`

**Resposta do bot:**

> Em janeiro de 2026, São Domingos (PB) estava quase todo em seca forte. Segundo o CDI – Índice Combinado de Seca, mês de janeiro de 2026 (dados do SEDES de 24/07/2026):
> 
> - **Estágio 3 (o mais grave): 97,7% da área**
> - **Estágio 2: 2,3% da área**
> - Sem seca, Estágio 1 e as classes de recuperação: 0%
> 
> Ou seja, praticamente todo o município estava no nível mais grave do índice.
> 
> Observação: o tabelão tem o CDI mensal, mas o site hoje usa uma versão recalculada por décadas (dias 1, 11 e 21 de cada mês), então os números do site podem ser diferentes. Se quiser o valor mais atual, posso consultar o relatório do site.

## I01 — período inexistente

**Pergunta:** Qual era o CDI de Campina Grande em 1995?

**Esperado:** Não há: o CDI no tabelão começa em janeiro de 2001. Pode oferecer o primeiro ano disponível.

**Tempo:** 8.4 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, c.rotulo AS classe, v.valor FROM valores v JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'CDI_Test' AND v.territorio = '2504009' AND v.periodo = (SELECT MIN(periodo) FROM valores WHERE indice = 'CDI_Test' AND territorio = '2504009') ORDER BY v.classe`

**Resposta do bot:**

> O SEDES não tem o CDI de Campina Grande–PB para 1995. A série do CDI (Índice Combinado de Seca) no tabelão começa em janeiro de 2001 e vai até janeiro de 2026 (dados do SEDES de 24/07/2026).
> 
> O primeiro mês disponível, janeiro de 2001, está 100% da área de Campina Grande classificada como "Sem seca". Se quiser, posso mostrar a série de 2001 em diante ou um período específico.

## I02 — período inexistente

**Pergunta:** Como estava o Monitor de Secas em Patos (PB) em dezembro de 2026?

**Esperado:** Não existe dezembro de 2026 (ainda não aconteceu). O tabelão vai até abr/2026 (Patos: 100% seca moderada); o relatório do site tem até set/2026 (82,5% seca grave, 17,5% moderada). Errado = inventar o dado de dezembro.

**Tempo:** 8.3 s · **turnos:** 4

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Patos","uf":"PB"}`
1. `listar_indices: {}`
1. `consultar_sql: SELECT v.periodo, c.rotulo AS classe, v.valor FROM valores v JOIN classes c ON c.indice = v.indice AND c.ordem = v.classe WHERE v.indice = 'anaseca' AND v.territorio = '2510808' AND v.periodo >= '2026-01' ORDER BY v.periodo, v.classe`

**Resposta do bot:**

> Não tenho dados do Monitor de Secas para dezembro de 2026. Hoje é 12/11/2026, então esse mês ainda não aconteceu.
> 
> O último período que encontrei no tabelão do SEDES (dados de 24/07/2026) é **abril de 2026**, para Patos–PB (Monitor de Secas, ANA). Nesse mês, 100% da área do município estava em **seca moderada**. Nos meses anteriores a classificação foi:
> 
> - **Janeiro e fevereiro de 2026:** 100% em seca extrema
> - **Março de 2026:** 100% em seca grave
> - **Abril de 2026:** 100% em seca moderada
> 
> Posso consultar o relatório atual do site, que pode ter meses mais recentes que o tabelão, se você quiser ver o dado de outubro ou novembro de 2026.

## I03 — período inexistente

**Pergunta:** Quantos registros de seca Petrolina teve em 2011?

**Esperado:** O tabelão não tem 2011 para este índice (pula de 2009 para 2013). O relatório do site tem a série desde 1991 e mostra 0 registros em 2011 para Petrolina. Acerto = dizer que falta no tabelão e usar o relatório, ou só dizer que não há o ano.

**Tempo:** 7.2 s · **turnos:** 5

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Petrolina"}`
1. `listar_indices: {}`
1. `relatorio_territorio: {"chave":"2611101","periodo":"2011","indice":"s2id_secas_estiagens"}`
1. `relatorio_territorio: {"chave":"2611101","periodo":"2011","indice":"registros-de-secas-e-estiagens-do-s2id"}`

**Resposta do bot:**

> Petrolina teve **0 registros de seca ou estiagem em 2011**, segundo o relatório atual do site SEDES (calculado em 12/11/2026, índice "Registros de Secas e Estiagens do S2ID").
> 
> O tabelão não tem o ano de 2011 para esse índice, por isso usei o relatório do site. O número de 0 é da contagem refeita pelo site, que pode diferir de contagens antigas.

## F01 — fora do escopo

**Pergunta:** Qual é a população de Campina Grande?

**Esperado:** O SEDES não tem dado de população. Dizer isso, sem inventar número.

**Tempo:** 6 s · **turnos:** 3

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Campina Grande"}`
1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES não tem o dado de população de Campina Grande (PB). Nenhum dos índices da plataforma trata de contagem de habitantes. O que temos para o município é a pobreza no CadÚnico (% das famílias inscritas em situação de pobreza, 2012 a 2025), o Monitor de Secas da ANA e a cobertura da terra. Para população, a fonte mais indicada é o IBGE (Censo ou estimativas anuais).
> 
> Posso mostrar algum desses indicadores para Campina Grande.

## F02 — fora do escopo

**Pergunta:** Vai chover amanhã em Fortaleza?

**Esperado:** O SEDES não tem previsão diária do tempo. Tem previsões mensais e trimestrais de anomalia de chuva no site; no tabelão só uma previsão antiga (mai–out/2026). Não pode responder se chove amanhã.

**Tempo:** 6.9 s · **turnos:** 3

**Ferramentas chamadas:**

1. `buscar_territorio: {"nome":"Fortaleza","uf":"CE"}`
1. `listar_indices: {}`

**Resposta do bot:**

> O SEDES não tem previsão de chuva para amanhã em Fortaleza. A plataforma trabalha com secas e clima em escala mensal, não com previsão do tempo diária.
> 
> O que existe no SEDES é a previsão de anomalia de precipitação do CPTEC/INPE, mas ela cobre só maio a outubro de 2026, feita antes de 24/07/2026. Como hoje é 12/11/2026, ela já não vale para amanhã. Além disso, é uma previsão, não uma medição.
> 
> Se quiser, posso consultar o Monitor de Secas (ANA) de Fortaleza para ver a situação de seca mais recente do município.

## F03 — fora do escopo

**Pergunta:** Qual é a taxa de desemprego em Recife?

**Esperado:** O SEDES não tem desemprego. Dizer isso, sem inventar.

**Tempo:** 17.5 s · **turnos:** 4

**Ferramentas chamadas:**

1. `listar_indices: {}`
1. `buscar_territorio: {"nome":"Recife"}`
1. `relatorio_territorio: {"chave":"2611606","periodo":"2025","indice":"desemprego"}`

**Resposta do bot:**

> Não tenho a taxa de desemprego de Recife. O SEDES não trata desemprego: nem o banco de dados nem o relatório do site têm esse índice.
> 
> O que o SEDES tem para Recife (Recife–PE, Mata Atlântica, fora do Semiárido) inclui pobreza no CadÚnico, analfabetismo, PIB, IDH, seca e cobertura da terra. Se algum desses for útil, posso buscar. Para a taxa de desemprego, a fonte mais indicada é o IBGE (PNAD Contínua).
