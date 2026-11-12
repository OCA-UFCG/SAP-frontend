# Perguntas de teste do chatbot do SEDES

Lista para avaliar o protótipo. Cada pergunta tem a resposta esperada e a
consulta SQL feita à mão que a produz no tabelão (`data/sedes.sqlite`). Para
rodar todas as consultas e conferir: `npm run consultas` (ou
`npm run consultas -- R02` para uma só).

Os dados do tabelão são de **24/07/2026**. Toda resposta do bot deve dizer
isso. Quando a resposta esperada cita "o relatório do site", o valor veio da
rota `/api/municipal-report` em 12/11/2026 e pode mudar.

Códigos de categoria: C conceitual, P valor pontual, R ranking, T tendência,
X cruzamento, A recorte agregado, H homônimo, I período inexistente, F fora do
escopo.

### C01 — conceitual

**Pergunta:** O que é o CDI?

**Resposta esperada:** Índice Combinado de Seca: monitora mês a mês os estágios da seca (Sem seca, Estágios 1 a 3, Recuperação total e parcial), implementado pelo OCA seguindo Cammalleri et al. (2021). Valor = % da área em cada estágio. No tabelão vai de jan/2001 a jan/2026.

```sql
SELECT nome, descricao, significado_valor, primeiro_periodo, ultimo_periodo FROM indices WHERE id = 'CDI_Test';
```

### C02 — conceitual

**Pergunta:** Quais são as classes do Monitor de Secas da ANA?

**Resposta esperada:** Seis classes, da menos à mais grave: Sem seca, Seca fraca, Seca moderada, Seca grave, Seca extrema, Seca excepcional. Valor = % da área em cada classe.

```sql
SELECT ordem, rotulo FROM classes WHERE indice = 'anaseca' ORDER BY ordem;
```

### C03 — conceitual

**Pergunta:** O que mede o percentual de pobreza do CadÚnico no SEDES?

**Resposta esperada:** % das famílias inscritas no CadÚnico em situação de pobreza (total, urbana e rural), anual de 2012 a 2025. Não é % da população. Estado e Brasil são média simples dos municípios.

```sql
SELECT id, nome, significado_valor, primeiro_periodo, ultimo_periodo FROM indices WHERE id LIKE 'pob_%';
```

### C04 — conceitual

**Pergunta:** Quais índices sobre degradação da terra o SEDES tem?

**Resposta esperada:** Dois: Índice de Degradação da Terra (2001 e 2021; níveis 1 a 5 e Conservado) e Dinâmica da Degradação da Terra – ODS 15.3.1 (2021; Degradando, Estável, Melhorando).

```sql
SELECT id, nome, primeiro_periodo, ultimo_periodo FROM indices WHERE nome LIKE '%degrada%';
```

### P01 — valor pontual

**Pergunta:** Como estava a seca em Campina Grande (PB) em abril de 2026, segundo o Monitor de Secas?

**Resposta esperada:** Abr/2026, Monitor de Secas: 71,7% da área em seca moderada e 28,3% em seca fraca. Citar a data dos dados (24/07/2026).

```sql
SELECT rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'anaseca' AND periodo = '2026-04' AND territorio = '2504009' AND valor > 0 ORDER BY valor DESC;
```

### P02 — valor pontual

**Pergunta:** Qual era o percentual de pobreza rural em Juazeiro do Norte em 2025?

**Resposta esperada:** 47,3% das famílias rurais do CadÚnico em situação de pobreza (Juazeiro do Norte–CE, 2025).

```sql
SELECT valor FROM valores WHERE indice = 'pob_rural' AND periodo = '2025' AND territorio = '2307304';
```

### P03 — valor pontual

**Pergunta:** Quantos registros de seca e estiagem Petrolina teve em 2024?

**Resposta esperada:** 2 registros em 2024 pelo tabelão. Observação: o relatório atual do site mostra 1 (a contagem foi refeita depois). Acerto = 2 com a fonte citada; mencionar a divergência é bônus.

```sql
SELECT valor FROM valores WHERE indice = 's2id_secas_estiagens' AND periodo = '2024' AND territorio = '2611101';
```

### P04 — valor pontual

**Pergunta:** Qual é a cobertura da terra predominante em Sobral, no Ceará?

**Resposta esperada:** Vegetação campestre, com 85,9% da área em 2020 (depois vegetação florestal 4,9% e mosaico florestal 4,3%).

```sql
SELECT periodo, rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'terraibge' AND periodo = '2020' AND territorio = '2312908' ORDER BY valor DESC LIMIT 3;
```

### P05 — valor pontual

**Pergunta:** Qual era a situação do CDI na Paraíba em janeiro de 2026?

**Resposta esperada:** Jan/2026: Estágio 2 49,5%, Estágio 1 27,1%, Estágio 3 23,3%, Sem seca 0,1%. Ou seja, ~99,9% da área em algum estágio de seca.

```sql
SELECT rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'CDI_Test' AND periodo = '2026-01' AND territorio = 'pb' ORDER BY classe;
```

### P06 — valor pontual

**Pergunta:** Qual é o PIB de Campina Grande?

**Resposta esperada:** O tabelão não tem PIB. O relatório do site tem (índice produto-interno-bruto): cerca de R$ 12,9 bilhões em 2023. Acerto = buscar no relatório; também vale dizer que o tabelão não tem e oferecer o relatório. Errado = inventar um número.

```sql
SELECT COUNT(*) AS indices_de_pib FROM indices WHERE nome LIKE '%PIB%' OR nome LIKE '%Produto Interno%';
```

### R01 — ranking

**Pergunta:** Quais os 5 municípios da Paraíba com maior percentual de pobreza total em 2025?

**Resposta esperada:** Juarez Távora 74,2%, Curral de Cima 73,9%, Santa Inês 73,2%, Cacimbas 73,1%, Pedro Régis 72,8%.

```sql
SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'pob_total' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.uf = 'PB'
ORDER BY v.valor DESC LIMIT 5;
```

### R02 — ranking

**Pergunta:** Quais municípios do Semiárido tinham mais área em seca grave ou pior no Monitor de Secas em abril de 2026?

**Resposta esperada:** 41 municípios do Semiárido estavam com 100% da área em seca grave ou pior em abr/2026 (33 no PI, 6 no CE, 2 no RN), por exemplo Tibau e Baraúna (RN), Russas e Limoeiro do Norte (CE), Wall Ferraz (PI). Acerto = dizer que há empate em 100% e dar exemplos.

```sql
SELECT t.nome, t.uf, ROUND(SUM(v.valor), 1) AS pct FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND v.classe >= 4 AND t.tipo = 'municipio' AND t.semiarido = 1
GROUP BY t.codigo HAVING pct > 0 ORDER BY pct DESC LIMIT 10;
```

```sql
SELECT COUNT(*) AS municipios_com_100pct FROM (
  SELECT v.territorio, SUM(v.valor) AS pct FROM valores v JOIN territorios t ON t.codigo = v.territorio
  WHERE v.indice = 'anaseca' AND v.periodo = '2026-04' AND v.classe >= 4 AND t.tipo = 'municipio' AND t.semiarido = 1
  GROUP BY v.territorio HAVING pct >= 99.9);
```

### R03 — ranking

**Pergunta:** Quais estados tinham a maior parte da área em seca pelo CDI em janeiro de 2026?

**Resposta esperada:** CDI jan/2026, soma dos Estágios 1 a 3: Paraíba 99,9%, Rio Grande do Norte 98,2%, Pernambuco 97,6%, Goiás 96,1%, Piauí 95,5%.

```sql
SELECT t.nome, ROUND(SUM(v.valor), 1) AS pct_em_seca FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'CDI_Test' AND v.periodo = '2026-01' AND v.classe IN (2, 3, 4) AND t.tipo = 'estado'
GROUP BY t.codigo ORDER BY pct_em_seca DESC LIMIT 5;
```

### R04 — ranking

**Pergunta:** No bioma Caatinga, quais municípios tiveram mais registros de seca e estiagem em 2025?

**Resposta esperada:** Coronel José Dias, Curral Novo do Piauí, Dirceu Arcoverde e São Lourenço do Piauí (todos no PI), com 7 registros cada em 2025; vários outros do PI com 6.

```sql
SELECT t.nome, t.uf, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 's2id_secas_estiagens' AND v.periodo = '2025' AND t.bioma = 'Caatinga'
ORDER BY v.valor DESC, t.nome LIMIT 10;
```

### R05 — ranking

**Pergunta:** Qual estado do Nordeste tem a maior parte da área degradando, segundo o ODS 15.3.1?

**Resposta esperada:** Sergipe, com 33,3% da área degradando (2021). Depois Bahia 18,4% e Alagoas 16,1%. Observação: os números de estado do tabelão diferem do site para este índice.

```sql
SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'ods' AND v.periodo = '2021' AND v.classe = 1 AND t.tipo = 'estado' AND t.regiao = 'Nordeste'
ORDER BY v.valor DESC;
```

### T01 — tendência

**Pergunta:** Como evoluiu a pobreza total em Campina Grande de 2012 a 2025?

**Resposta esperada:** Caiu de 79,1% em 2012 para 36,9% em 2025, com queda forte até 2017 (45,2%), estabilidade perto de 40% e um pico em 2022 (45,5%).

```sql
SELECT periodo, valor FROM valores WHERE indice = 'pob_total' AND territorio = '2504009' ORDER BY periodo;
```

### T02 — tendência

**Pergunta:** A seca no Ceará piorou ou melhorou entre janeiro e abril de 2026, pelo Monitor de Secas?

**Resposta esperada:** Melhorou: em janeiro havia 27,3% em seca extrema e 20,9% em grave; em abril não havia seca extrema, só 6,7% em grave, e a maior parte em seca fraca (52,1%) ou moderada (41,2%).

```sql
SELECT periodo, rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'anaseca' AND territorio = 'ce' AND periodo BETWEEN '2026-01' AND '2026-04' AND valor > 0
ORDER BY periodo, classe;
```

### T03 — tendência

**Pergunta:** Em que ano o Brasil teve mais registros de seca e estiagem?

**Resposta esperada:** 2013, com 3.275 registros. Depois vêm 2025 (2.780) e 2017 (2.760). Ressalva: faltam 2010–2012, 2014 e 2016 no tabelão.

```sql
SELECT periodo, valor FROM valores WHERE indice = 's2id_secas_estiagens' AND territorio = 'br' ORDER BY valor DESC LIMIT 5;
```

### T04 — tendência

**Pergunta:** Em que mês de 2025 a Paraíba teve a maior área em seca pelo CDI?

**Resposta esperada:** Dezembro de 2025, com 62,8% da área em algum estágio de seca; depois maio (36,4%) e junho (28,1%).

```sql
SELECT periodo, ROUND(SUM(valor), 1) AS pct_em_seca FROM valores
WHERE indice = 'CDI_Test' AND territorio = 'pb' AND periodo BETWEEN '2025-01' AND '2025-12' AND classe IN (2, 3, 4)
GROUP BY periodo ORDER BY pct_em_seca DESC;
```

### X01 — cruzamento

**Pergunta:** Quais municípios do Semiárido estavam com mais de 90% da área em seca grave ou pior em abril de 2026 e também têm pobreza total acima de 60% em 2025?

**Resposta esperada:** Cinco municípios, todos no Piauí: Wall Ferraz (pobreza 68,8%), Aroeiras do Itaim (67,0%), Jaicós (64,9%), Santa Rosa do Piauí (61,5%) e Sussuapara (61,0%), todos com 100% da área em seca grave ou pior.

```sql
WITH seca AS (
  SELECT territorio, SUM(valor) AS pct FROM valores
  WHERE indice = 'anaseca' AND periodo = '2026-04' AND classe >= 4 GROUP BY territorio)
SELECT t.nome, t.uf, ROUND(s.pct, 1) AS seca_grave_ou_pior, ROUND(p.valor, 1) AS pobreza
FROM seca s JOIN territorios t ON t.codigo = s.territorio
JOIN valores p ON p.territorio = s.territorio AND p.indice = 'pob_total' AND p.periodo = '2025'
WHERE t.tipo = 'municipio' AND t.semiarido = 1 AND s.pct > 90 AND p.valor > 60
ORDER BY p.valor DESC;
```

### X02 — cruzamento

**Pergunta:** Entre os municípios com mais da metade da área nos níveis 3 a 5 de degradação em 2021, quais têm a maior pobreza rural em 2025?

**Resposta esperada:** 2.268 municípios têm mais da metade da área nos níveis 3 a 5. Os de maior pobreza rural em 2025: Campo Grande–AL (81,0%), Potiraguá–BA (79,9%), Senador Elói de Souza–RN (79,7%), Colônia Leopoldina–AL (78,0%), Feira Nova–PE (77,9%). Atenção: o nível 5 é o mais degradado; as classes 1 a 3 do tabelão são os níveis 5, 4 e 3.

```sql
WITH deg AS (
  SELECT territorio, SUM(valor) AS pct FROM valores
  WHERE indice = 'deg' AND periodo = '2021' AND classe IN (1, 2, 3) GROUP BY territorio)
SELECT t.nome, t.uf, ROUND(d.pct, 1) AS niveis_3_a_5, ROUND(p.valor, 1) AS pobreza_rural
FROM deg d JOIN territorios t ON t.codigo = d.territorio
JOIN valores p ON p.territorio = d.territorio AND p.indice = 'pob_rural' AND p.periodo = '2025'
WHERE t.tipo = 'municipio' AND d.pct > 50
ORDER BY p.valor DESC LIMIT 5;
```

```sql
SELECT COUNT(*) FROM (SELECT territorio, SUM(valor) AS pct FROM valores v JOIN territorios t ON t.codigo = v.territorio
  WHERE indice = 'deg' AND periodo = '2021' AND classe IN (1, 2, 3) AND t.tipo = 'municipio' GROUP BY territorio HAVING pct > 50);
```

### X03 — cruzamento

**Pergunta:** Na Paraíba, os municípios com mais pobreza em 2025 tiveram mais registros de seca em 2025?

**Resposta esperada:** Não: dividindo os 223 municípios da PB em quatro faixas de pobreza, a média de registros fica em ~1,2 em todas. Não há relação visível. Acerto = conclusão de "sem relação clara" baseada nos dados.

```sql
WITH base AS (
  SELECT t.codigo, p.valor AS pobreza, COALESCE(s.valor, 0) AS registros
  FROM territorios t
  JOIN valores p ON p.territorio = t.codigo AND p.indice = 'pob_total' AND p.periodo = '2025'
  LEFT JOIN valores s ON s.territorio = t.codigo AND s.indice = 's2id_secas_estiagens' AND s.periodo = '2025'
  WHERE t.tipo = 'municipio' AND t.uf = 'PB'),
q AS (SELECT *, NTILE(4) OVER (ORDER BY pobreza) AS quartil FROM base)
SELECT quartil, COUNT(*) AS municipios, ROUND(MIN(pobreza), 1) AS pobreza_min, ROUND(MAX(pobreza), 1) AS pobreza_max,
       ROUND(AVG(registros), 2) AS media_registros
FROM q GROUP BY quartil ORDER BY quartil;
```

### A01 — recorte agregado

**Pergunta:** Como estava a seca no bioma Caatinga em abril de 2026, pelo Monitor de Secas?

**Resposta esperada:** Abr/2026, bioma Caatinga: seca moderada 55,0%, seca fraca 34,8%, sem seca 5,3% e seca grave 4,9%.

```sql
SELECT rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'anaseca' AND periodo = '2026-04' AND territorio = '3_bioma-caatinga' AND valor > 0 ORDER BY classe;
```

### A02 — recorte agregado

**Pergunta:** Qual é o percentual de pobreza total na região Nordeste?

**Resposta esperada:** O tabelão não tem valor próprio da região para pobreza. A média simples dos municípios do Nordeste em 2025 é 57,9% (o relatório do site dá o mesmo 57,9%). Por estado, vai de 52,9% (RN) a 64,6% (MA). Acerto = 57,9% com a ressalva da média, ou faixa por estado.

```sql
SELECT COUNT(*) AS linhas_da_regiao FROM valores WHERE indice = 'pob_total' AND territorio = '2_regiao-nordeste';
```

```sql
SELECT t.nome, v.valor FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'pob_total' AND v.periodo = '2025' AND t.tipo = 'estado' AND t.regiao = 'Nordeste' ORDER BY v.valor DESC;
```

```sql
SELECT ROUND(AVG(v.valor), 1) AS media_simples_municipios FROM valores v JOIN territorios t ON t.codigo = v.territorio
WHERE v.indice = 'pob_total' AND v.periodo = '2025' AND t.tipo = 'municipio' AND t.regiao = 'Nordeste';
```

### A03 — recorte agregado

**Pergunta:** Qual parte do Brasil estava em seca em abril de 2026, pelo Monitor de Secas?

**Resposta esperada:** Abr/2026, Brasil: 58,4% sem seca, 26,4% seca fraca, 14,4% moderada, 0,9% grave. Ou seja, ~41,6% da área com algum grau de seca.

```sql
SELECT rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'anaseca' AND periodo = '2026-04' AND territorio = 'br' ORDER BY classe;
```

### A04 — recorte agregado

**Pergunta:** Como está a degradação da terra no Semiárido?

**Resposta esperada:** O tabelão não tem o Semiárido para degradação. O relatório do site (5_semiarido-semiarido-total, 2021) dá: Conservado 75,5%, Nível 3 12,7%, Nível 4 7,4%, Nível 2 3,9%, Nível 5 0,3%, Nível 1 0,2%; ODS: 7,9% degradando. Acerto = usar o relatório, ou dizer que não há o recorte e oferecer média dos municípios com ressalva.

```sql
SELECT COUNT(*) AS linhas_do_semiarido FROM valores WHERE indice = 'deg' AND territorio = '5_semiarido-semiarido-total';
```

### H01 — homônimo

**Pergunta:** Como está a seca em Santa Luzia?

**Resposta esperada:** Perguntar qual Santa Luzia: há quatro (BA, MA, MG e PB). Não pode escolher uma sozinho.

```sql
SELECT codigo, nome, uf FROM territorios WHERE nome_sem_acento = 'santa luzia' ORDER BY uf;
```

### H02 — homônimo

**Pergunta:** Qual é o percentual de pobreza em Bom Jesus em 2025?

**Resposta esperada:** Perguntar qual Bom Jesus (PB, PI, RN, RS, SC) ou listar as cinco: PB 51,4%, PI 54,5%, RN 56,6%, RS 45,0%, SC 37,9%.

```sql
SELECT t.codigo, t.uf, v.valor FROM territorios t
LEFT JOIN valores v ON v.territorio = t.codigo AND v.indice = 'pob_total' AND v.periodo = '2025'
WHERE t.nome_sem_acento = 'bom jesus' ORDER BY t.uf;
```

### H03 — homônimo

**Pergunta:** E o CDI de São Domingos da Paraíba em janeiro de 2026?

**Resposta esperada:** O usuário já deu a UF. São Domingos–PB, CDI jan/2026: 97,7% da área no Estágio 3 e 2,3% no Estágio 2.

```sql
SELECT rotulo_classe, valor FROM valores_com_nomes
WHERE indice = 'CDI_Test' AND periodo = '2026-01' AND territorio = '2513968' AND valor > 0 ORDER BY classe;
```

### I01 — período inexistente

**Pergunta:** Qual era o CDI de Campina Grande em 1995?

**Resposta esperada:** Não há: o CDI no tabelão começa em janeiro de 2001. Pode oferecer o primeiro ano disponível.

```sql
SELECT primeiro_periodo, ultimo_periodo FROM indices WHERE id = 'CDI_Test';
```

### I02 — período inexistente

**Pergunta:** Como estava o Monitor de Secas em Patos (PB) em dezembro de 2026?

**Resposta esperada:** Não existe dezembro de 2026 (ainda não aconteceu). O tabelão vai até abr/2026 (Patos: 100% seca moderada); o relatório do site tem até set/2026 (82,5% seca grave, 17,5% moderada). Errado = inventar o dado de dezembro.

```sql
SELECT ultimo_periodo FROM indices WHERE id = 'anaseca';
```

### I03 — período inexistente

**Pergunta:** Quantos registros de seca Petrolina teve em 2011?

**Resposta esperada:** O tabelão não tem 2011 para este índice (pula de 2009 para 2013). O relatório do site tem a série desde 1991 e mostra 0 registros em 2011 para Petrolina. Acerto = dizer que falta no tabelão e usar o relatório, ou só dizer que não há o ano.

```sql
SELECT periodo FROM valores WHERE indice = 's2id_secas_estiagens' AND territorio = 'br' AND periodo BETWEEN '2009' AND '2014' ORDER BY periodo;
```

### F01 — fora do escopo

**Pergunta:** Qual é a população de Campina Grande?

**Resposta esperada:** O SEDES não tem dado de população. Dizer isso, sem inventar número.

```sql
SELECT COUNT(*) FROM indices WHERE nome LIKE '%popula%';
```

### F02 — fora do escopo

**Pergunta:** Vai chover amanhã em Fortaleza?

**Resposta esperada:** O SEDES não tem previsão diária do tempo. Tem previsões mensais e trimestrais de anomalia de chuva no site; no tabelão só uma previsão antiga (mai–out/2026). Não pode responder se chove amanhã.

```sql
SELECT id, nome, primeiro_periodo, ultimo_periodo FROM indices WHERE id = 'prev_anomalia_precipitacao';
```

### F03 — fora do escopo

**Pergunta:** Qual é a taxa de desemprego em Recife?

**Resposta esperada:** O SEDES não tem desemprego. Dizer isso, sem inventar.

```sql
SELECT COUNT(*) FROM indices WHERE nome LIKE '%emprego%';
```
