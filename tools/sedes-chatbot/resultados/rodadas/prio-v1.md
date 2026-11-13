# Rodada prio-v1

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T02:15.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 11 (12)                        |
| Notas do juiz                           | 8 certo · 2 parcial · 1 errado |
| Com número esperado faltando            | 0                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 10,5 · 10,8 · 14,6 s           |
| Rodadas do modelo por turno             | 2,0                            |
| Ferramentas por turno                   | 1,0                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 59,5 mil                       |
| Tokens de saída por turno               | 946                            |
| Custo somado (preço de API)             | US$ 0.04                       |

| Id  | Categoria   | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ----------- | ------- | --------- | ------- | ----------- |
| N01 | priorização | certo   | 13,0      | 2       | 1           |
| N02 | priorização | parcial | 14,6      | 2       | 1           |
| N03 | priorização | errado  | 17,2      | 3       | 2           |
| N04 | priorização | certo   | 13,6      | 2       | 1           |
| N05 | priorização | certo   | 10,8      | 3       | 2           |
| N06 | priorização | certo   | 6,5       | 1       | 0           |
| N07 | priorização | certo   | 7,6 + 5,4 | 2 + 2   | 1 + 1       |
| N08 | priorização | certo   | 7,9       | 2       | 1           |
| N09 | priorização | certo   | 7,0       | 1       | 0           |
| N10 | priorização | parcial | 14,4      | 3       | 2           |
| N11 | priorização | certo   | 8,5       | 1       | 0           |

## N03 — priorização — errado

**Juiz:** A Área Degradada de Assunção foi escrita como "12.406 km²", mas a ferramenta devolveu 12,406 (vírgula decimal, como em 0,242 e 29,585). Em português "12.406" significa doze mil, então o valor ficou 1000 vezes maior que o real, cerca de 12,4 km². Os percentuais (97,6%, 98,6%, 82,9%, 58,6%), a configuração e a ressalva de que o nível é relativo estão corretos.

**Esperado:** Com os critérios padrão do site, comparando dentro da Paraíba: Assunção está em situação pior que 97,6% dos municípios da PB no Índice de Aridez (0,242), 98,6% no Índice de Seca (29,6%), 82,9% na Pobreza Rural e 58,6% na Área Degradada. Diz que o nível é relativo aos municípios da Paraíba e aos critérios escolhidos, e não atribui causa a um critério só.

**Pergunta:** Por que Assunção, na Paraíba, aparece com prioridade muito alta na priorização?

17,2 s · 3 rodadas · 90 mil tokens de entrada

1. buscar_territorio: `{"nome":"Assunção","uf":"PB"}`
1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["2501351"]}`

> Assunção (PB) ficou em **prioridade muito alta** porque está em situação pior que a maioria dos municípios paraibanos nos quatro critérios usados. A comparação é feita dentro da Paraíba, com 210 municípios do estado.
>
> Configuração usada: critérios padrão do site, com pesos iguais (25% cada), área Brasil, comparação separada por estado e cenário pessimista.
>
> | Critério             | Valor de Assunção | Pior que quantos municípios da PB |
> | -------------------- | ----------------- | --------------------------------- |
> | Índice de Seca (%)   | 29,6              | 98,6%                             |
> | Índice de Aridez     | 0,242             | 97,6%                             |
> | Pobreza Rural        | 81,3              | 82,9%                             |
> | Área Degradada (km²) | 12.406            | 58,6%                             |
>
> No Índice de Aridez, quanto menor o valor, mais seco o município, e Assunção está entre os mais secos do estado. Os três primeiros critérios puxaram o nível para cima. A área degradada ficou um pouco acima da mediana.
>
> O nível é relativo: "muito alta" significa pior que a maioria dos municípios do grupo nesses critérios, não um valor absoluto. Os dados vêm da planilha da Priorização, não do tabelão. Se você usou outros critérios ou pesos, me diga e refaço a análise.

## N02 — priorização — parcial

**Juiz:** Os números e a configuração batem com a ferramenta: pesos 66,7% e 33,3%, 1.477 classificados, nenhum de fora, e a distribuição 280/831/138/135/93. Faltou citar alguns dos 280 municípios de prioridade muito alta, que a ferramenta devolveu (150 nomes, de Abaré–BA a Mata Verde–MG). A pessoa pediu uma lista e a resposta não traz nenhum nome, só oferece mostrar por estado.

**Esperado:** Critérios Pobreza Rural (67%) e Seca Registrada (33%), Semiárido, todos comparados juntos. 1.477 municípios classificados, nenhum de fora. Prioridade muito alta: 280; alta: 831; média: 138; baixa: 135; muito baixa: 93. Cita alguns dos 280 e diz que são 280, sem listar todos nem ordenar.

**Pergunta:** Faz uma priorização do Semiárido combinando pobreza rural e seca registrada, com a pobreza pesando o dobro. Quero uma lista única do Semiárido todo, não separada por estado.

14,6 s · 2 rodadas · 60 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"semiarido"},"comparar_dentro_de":"area","criterios":[{"nome":"pobreza_rural_2021","peso":2},{"nome":"seca_grave_6_meses","peso":1}],"listar":["Muito alta"]}`

> Com pobreza rural pesando o dobro e seca registrada pesando 1, a lista única do Semiárido tem **280 municípios de prioridade muito alta**, de um total de 1.477 classificados. Nenhum município ficou de fora por falta de dado.
>
> - **Critérios e pesos:** Pobreza Rural (66,7%) e Seca Registrada (33,3%). Ambos são critérios de custo: quanto maior o valor, maior a prioridade.
> - **Área e comparação:** Semiárido inteiro, com todos os municípios comparados juntos, em um único ranking.
> - **Cenário:** pessimista, com os limiares padrão do site.
> - **Distribuição por nível:** muito alta 280; alta 831; média 138; baixa 135; muito baixa 93.
>
> A ferramenta devolveu só 150 dos 280 nomes de prioridade muito alta, em ordem alfabética, e não dá para listar todos aqui. Posso mostrar os municípios de prioridade muito alta de um estado específico, ou os de um dos outros níveis, se quiser.
>
> Os valores vêm da planilha da Priorização, não do tabelão, e a seca registrada é o percentual de seca grave, extrema ou excepcional nos últimos 6 meses (fevereiro a julho de 2026) no Monitor de Secas da ANA.

## N10 — priorização — parcial

**Juiz:** Os números (1.794 municípios, 366 com prioridade muito alta), os critérios e os pesos batem com a ferramenta, e a resposta diz que usou comparação única do Nordeste e que o padrão do site é por estado. Mas não diz o resultado do padrão do site (445 de 1.794 em prioridade muito alta), que a resposta esperada traz, e só oferece repetir a conta. Também não diz com clareza que a comparação muda o resultado. Por fim, escolheu sozinho a comparação, sem avisar nem perguntar à pessoa.

**Esperado:** Critérios Domicílios com esgotamento sanitário (benefício) e Pessoas não alfabetizadas (custo), pesos iguais, região Nordeste. Diz como comparou: com o padrão do site (cada estado separado) dá 445 de 1.794 com prioridade muito alta; comparando o Nordeste todo junto, 366. Diz que a comparação muda o resultado ou pergunta qual a pessoa quer.

**Pergunta:** Quero priorizar municípios do Nordeste com pouco esgotamento sanitário e muita gente não alfabetizada.

14,4 s · 3 rodadas · 90,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"},"criterios":[{"nome":"pct_naoalf_2022","peso":1},{"nome":"pct_rede_2022","peso":1}],"comparar_dentro_de":"area"}`
1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"},"criterios":[{"nome":"pct_naoalf_2022","peso":1},{"nome":"pct_rede_2022","peso":1}],"comparar_dentro_de":"regiao"}`

> Na área do Nordeste, a Priorização classificou os 1.794 municípios da região. Nenhum ficou de fora por falta de dado.
>
> **Configuração:** pessoas não alfabetizadas (2022) e domicílios com esgotamento sanitário pela rede geral ou pluvial (2022), com pesos iguais (50% cada). Os dois critérios vêm da planilha da Priorização, não do tabelão. Usei uma comparação única para a região inteira, com os padrões do site (cenário pessimista).
>
> **Distribuição por nível:**
>
> - Muito alta: 366 municípios
> - Alta: 449
> - Média: 521
> - Baixa: 270
> - Muito baixa: 188
>
> **Prioridade muito alta:** 366 municípios. Alguns exemplos, em ordem alfabética: Abaiara–CE, Acopiara–CE, Adustina–BA, Afonso Cunha–MA, Água Doce do Maranhão–MA, Águas Belas–PE, Aguiar–PB, Aiuaba–CE, Alagoa Grande–PB, Alagoinha do Piauí–PI, Aldeias Altas–MA, Alegrete do Piauí–PI, Algodão de Jandaíra–PB, Altamira do Maranhão–MA, Alto Alegre do Maranhão–MA.
>
> O nível é relativo aos outros municípios do Nordeste nesses dois critérios. A lista não tem ordem de prioridade dentro do nível.
>
> Se quiser, posso listar só um estado, ou repetir a conta comparando cada estado separadamente, que é o padrão do site.

## N01 — priorização — certo

**Juiz:** ok: a resposta traz os 23 municípios de prioridade muito alta, iguais aos da ferramenta. Informa os critérios padrão com pesos iguais, o cenário pessimista, os 210 classificados e os 13 de fora (cita João Pessoa). Avisa que o nível é relativo e que não há ordem dentro do nível. Diz que os dados vêm da planilha da Priorização. A comparação é feita só na Paraíba, o que é natural para um único estado.

**Esperado:** Usa a Priorização com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), Paraíba, cenário pessimista, e diz essa configuração. 210 municípios classificados; 13 ficaram de fora por falta de dado (entre eles João Pessoa). 23 com prioridade muito alta (ex.: Assunção, Juazeirinho, Salgadinho, Tenório, Serra Branca, São Vicente do Seridó, Junco do Seridó...). Não ordena municípios dentro do nível.

**Pergunta:** Quais municípios da Paraíba deveriam ser priorizados para ações contra a seca e a desertificação?

13,0 s · 2 rodadas · 58,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta"]}`

> Na Priorização do SEDES, 23 municípios da Paraíba ficaram no nível de **prioridade muito alta** para ações contra a seca e a desertificação:
>
> Areial, Assunção, Baraúna, Camalaú, Caraúbas, Congo, Coxixola, Cubati, Curral de Cima, Ingá, Juazeirinho, Junco do Seridó, Lagoa de Dentro, Montadas, Parari, Pilar, Riacho de Santo Antônio, Salgadinho, Santo André, São Vicente do Seridó, Serra Branca, Sobrado e Tenório.
>
> **Como foi feita a análise:** usei os critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. O cenário foi o pessimista, que na dúvida entre dois níveis escolhe o de maior prioridade. Os dados vêm da planilha da Priorização, não do tabelão, e podem diferir dos índices do mesmo nome no monitoramento.
>
> **Ressalvas:**
>
> - Dos 223 municípios, 210 foram classificados. Os outros 13 ficaram de fora por falta de dado, entre eles João Pessoa, Cabedelo e Bayeux.
> - O nível é relativo. "Muito alta" quer dizer pior situação que a maioria dos municípios paraibanos nesses quatro critérios, não um valor absoluto.
> - Dentro do nível não há ordem de prioridade.
>
> Se quiser, posso refazer a análise com outros critérios, como o Monitor de Secas ou a pobreza urbana, ou com pesos diferentes.

## N04 — priorização — certo

**Juiz:** ok: Campina Grande–PB aparece como prioridade média, comparada com os 210 municípios da PB. A resposta diz a configuração (4 critérios com 25% cada, comparação por estado) e oferece refazer com outros critérios. As leituras dos critérios batem com a ferramenta: área degradada em 90% e os outros três abaixo ou perto de 50%.

**Esperado:** Campina Grande–PB, com os critérios padrão do site comparando dentro da Paraíba: prioridade média. Diz a configuração usada (e que mudando os critérios o nível muda).

**Pergunta:** Qual o nível de prioridade de Campina Grande?

13,6 s · 2 rodadas · 60,8 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["2504009"]}`

> Campina Grande–PB está em **prioridade média**. Essa é a classificação com a configuração padrão do site, que compara os municípios de cada estado separadamente. Campina Grande fica entre os 210 municípios da Paraíba.
>
> A análise usou quatro critérios, todos com o mesmo peso (25%): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Em três deles, Campina Grande está em situação melhor que a maioria dos municípios paraibanos, o que puxa a prioridade para baixo. A exceção é a área degradada, em que o município está pior que 90% do grupo, o que puxa para cima.
>
> Os dados da Priorização vêm da planilha da própria ferramenta, não do tabelão. Por isso, o resultado pode não bater com os índices consultados diretamente no SEDES. Se quiser que eu refaça a análise com outros critérios, pesos ou uma comparação de todos os municípios juntos, é só dizer.

## N05 — priorização — certo

**Juiz:** ok: diz que João Pessoa ficou de fora da Priorização padrão por falta de Índice de Seca, sem inventar nível. Os números (116 de fora, 5.571 municípios) e a configuração batem com a ferramenta. A oferta de rodar sem o Índice de Seca é opcional e não prejudica.

**Esperado:** João Pessoa fica de fora da Priorização padrão por não ter valor no Índice de Seca na planilha da Priorização. Não inventa um nível.

**Pergunta:** E João Pessoa, qual a prioridade dela na priorização padrão?

10,8 s · 3 rodadas · 89,7 mil tokens de entrada

1. buscar_territorio: `{"nome":"João Pessoa"}`
1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["2507507"]}`

> João Pessoa **não recebeu nível de prioridade** na Priorização padrão: ela ficou de fora da análise porque a planilha não tem o Índice de Seca para o município.
>
> A configuração padrão foi: Brasil, com os quatro critérios de peso igual (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural), cada estado comparado separadamente e cenário pessimista. Dos 5.571 municípios, 116 ficaram de fora por falta de dado, e João Pessoa é um deles.
>
> Se quiser, posso rodar a priorização sem o Índice de Seca, para ver em que nível João Pessoa cairia com os outros três critérios.

## N06 — priorização — certo

**Juiz:** ok: diz que a Priorização não tem critério de desmatamento, lista corretamente os critérios disponíveis e sugere Área Degradada (níveis 4 e 5) como o mais próximo. Oferece rodar com ele e não finge que é desmatamento. A menção a um ranking separado do PRODES no tabelão é plausível, pois o índice existe no catálogo, e deixa claro que não entra na Priorização.

**Esperado:** Não: a Priorização não tem um critério de desmatamento. Mostra os critérios mais próximos que existem (ex.: Área Degradada) e oferece rodar com eles. Não roda uma análise fingindo que é desmatamento.

**Pergunta:** Dá para fazer a priorização usando desmatamento como critério?

6,5 s · 1 rodadas · 28,7 mil tokens de entrada

> Não. O critério de desmatamento (PRODES) não está na Priorização. Os critérios disponíveis são: Índice de Aridez, Índice de Seca, Área Degradada, Pobreza Rural, Índice de Progresso Social, Vulnerabilidade Climática, Seca Registrada, Anomalia de Precipitação, Mulheres Produtoras, Produtores em Cooperativas, População Indígena, Não Alfabetizados, Esgotamento Sanitário e três tipos de Cisternas.
>
> O mais próximo é **Área Degradada (km²)**, que mede a área municipal em níveis 4 e 5 de degradação da terra. Ele não é desmatamento, mas trata de perda de vegetação e solo. Também posso usar a Seca Registrada ou o Índice de Aridez, se o seu interesse for outro aspecto ambiental.
>
> Se quiser, rodo a Priorização com a Área Degradada e os critérios que você escolher, por exemplo com a Pobreza Rural.
>
> Para ver o desmatamento municipal (PRODES), consigo fazer um ranking separado no tabelão, mas ele não entra na Priorização.

## N07 — priorização — certo

**Juiz:** ok. Reexecutou a priorização no Ceará com pobreza rural em peso 2 contra 1 (40% contra 20% cada) e disse o peso usado. A primeira resposta (27 de 184) bate com a ferramenta, e a comparação entre as listas está certa: 9 entraram, 3 saíram, 24 ficaram (27−3=24; 24+9=33). A resposta esperada dá 3 contra 1 só como exemplo, e o número muda conforme o peso.

**Esperado:** Roda de novo no Ceará com Pobreza Rural com peso maior que os outros (ex.: 3 contra 1, que dá 31 municípios de prioridade muito alta; com outro peso o número muda) e diz o peso que usou. Na primeira resposta, padrão: 27 de 184 com prioridade muito alta. Diz que a lista mudou (ex.: entram Acaraú, Itapipoca, Trairi; saem Banabuiú, Iguatu) só se tiver os dois resultados.

**Pergunta:** Quais municípios do Ceará têm prioridade muito alta na priorização padrão?

7,6 s · 2 rodadas · 58,4 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`

> No Ceará, **27 municípios** ficaram com prioridade muito alta na Priorização padrão do site:
>
> Aiuaba, Antonina do Norte, Assaré, Baixio, Banabuiú, Brejo Santo, Campos Sales, Icó, Iguatu, Independência, Jaguaretama, Jaguaruana, Limoeiro do Norte, Milhã, Monsenhor Tabosa, Morada Nova, Moraújo, Novo Oriente, Orós, Parambu, Penaforte, Quixelô, Saboeiro, Salitre, São João do Jaguaribe, Senador Sá e Tabuleiro do Norte.
>
> Configuração usada:
>
> - **Critérios e pesos iguais (25% cada):** Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural.
> - **Comparação:** cada estado separadamente, como no padrão do site. Assim, "muito alta" quer dizer pior que a maioria dos municípios cearenses nesses critérios.
> - **Cenário pessimista**, com os limiares padrão.
>
> Todos os 184 municípios do Ceará foram classificados, sem ficar de fora por falta de dado. Os dados vêm da planilha da Priorização, não do tabelão de índices, e a ordem alfabética não indica prioridade dentro do nível.

**Pergunta:** E se a pobreza rural pesar mais que os outros critérios?

5,4 s · 2 rodadas · 61,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"criterios":[{"nome":"ia_mean","peso":1},{"nome":"spe_mean_per","peso":1},{"nome":"area_deg54_mun","peso":1},{"nome":"pobreza_rural_2021","peso":2}],"listar":["Muito alta"]}`

> Com a pobreza rural pesando o dobro dos outros critérios (40% contra 20% cada), **33 municípios** ficam com prioridade muito alta, contra 27 na configuração anterior.
>
> Eu usei peso 2 para a pobreza rural e peso 1 para os outros três. Se você quiser outro peso, me diga.
>
> - **Entraram (9):** Acaraú, Caridade, Irauçuba, Itarema, Martinópole, Pacatuba, Trairi, Umirim e Uruburetama.
> - **Saíram (3):** Antonina do Norte, Banabuiú e São João do Jaguaribe.
>
> Os outros 24 continuam na lista. Como antes, todos os 184 municípios do Ceará foram classificados, e os dados vêm da planilha da Priorização.

## N08 — priorização — certo

**Juiz:** ok. Diz 1 município de fora (Madre de Deus), de 417, sem dado em Índice de Aridez e Área Degradada, e 416 classificados, como na ferramenta. Cita a planilha da Priorização. A menção a um "gráfico de distribuição" é só detalhe de apresentação.

**Esperado:** 1 de 417: Madre de Deus, sem valor no Índice de Aridez e na Área Degradada na planilha da Priorização. Os outros 416 são classificados.

**Pergunta:** Na priorização padrão da Bahia, quantos municípios ficam de fora e por quê?

7,9 s · 2 rodadas · 58,7 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"}}`

> Na priorização padrão da Bahia, **1 município fica de fora: Madre de Deus**. Dos 417 municípios do estado, 416 foram classificados.
>
> Ele ficou sem dado em dois dos quatro critérios: **Índice de Aridez** e **Área Degradada**. A priorização só classifica municípios que têm valor em todos os critérios escolhidos.
>
> A configuração foi a padrão do site: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com pesos iguais (25% cada), cenário pessimista e comparação feita dentro do próprio estado. Os valores vêm da planilha da Priorização, não do tabelão.
>
> Entre os 416 classificados, 84 estão em prioridade muito alta, incluindo Juazeiro, Irecê e Xique-Xique. O resultado completo está no gráfico de distribuição por nível.

## N09 — priorização — certo

**Juiz:** ok. Explica corretamente, conforme os textos do site, que os cenários só divergem para municípios na fronteira entre dois níveis. O pessimista (padrão) vai para a maior prioridade e o otimista para a menor. Os números da Paraíba eram opcionais e a resposta não os inventou. A frase "a diferença costuma ser pequena" é uma suposição leve, mas não contradiz as fontes.

**Esperado:** Com os textos do site: os dois só divergem quando um município está na fronteira entre dois níveis; o pessimista (padrão do site) põe o município no nível de maior prioridade, o otimista no de menor. Pode mostrar o efeito na Paraíba com os critérios padrão (muito alta: 23 no pessimista, 4 no otimista), se rodar as duas.

**Pergunta:** Qual a diferença entre o cenário otimista e o pessimista na priorização?

7,0 s · 1 rodadas · 28,7 mil tokens de entrada

> Os dois cenários só fazem diferença para o município que fica **na fronteira entre dois níveis** de prioridade. Nesse caso, o método não consegue decidir com segurança entre as duas classes:
>
> - **Pessimista** (padrão do site): o município entra na classe de **maior prioridade** entre as duas. É a opção mais conservadora, indicada quando é melhor não subestimar a necessidade de um território.
> - **Otimista**: o município entra na classe de **menor prioridade**. Assim, os níveis mais altos ficam reservados aos territórios em que a prioridade não deixa dúvida.
>
> Para os municípios que não estão na fronteira, os dois cenários dão o mesmo nível. Por isso, a diferença entre eles costuma ser pequena. Se quiser, posso rodar a priorização nos dois cenários e mostrar quais municípios mudam de nível.

## N11 — priorização — certo

**Juiz:** ok. A resposta explica que é o nível mais alto dos 5 e que é relativo ao grupo e aos critérios. Diz também que mudar critérios, pesos ou área altera o resultado. Os detalhes extras (sem ordem dentro do nível, níveis de tamanhos diferentes, cenário pessimista) batem com o texto da Priorização. Não rodou análise, como esperado.

**Esperado:** É o nível mais alto dos 5 da Priorização: o município está em situação pior que a maioria dos municípios do mesmo grupo de comparação nos critérios escolhidos, com os pesos dados. É relativo (ao grupo e aos critérios), não um valor absoluto; mudando critérios, pesos ou área, muda. Não precisa rodar uma análise.

**Pergunta:** O que quer dizer um município estar com prioridade muito alta?

8,5 s · 1 rodadas · 28,7 mil tokens de entrada

> Significa que o município está entre os que mais precisam de ação, segundo os critérios escolhidos. É o nível mais alto dos cinco da Priorização (muito alta, alta, média, baixa e muito baixa).
>
> - **É relativo.** Não mede uma situação absoluta. Quer dizer que o município está em situação pior que a maioria dos outros do mesmo grupo de comparação, nos critérios e pesos usados. Por padrão, o site compara cada estado separadamente.
> - **Depende da configuração.** Trocar os critérios, os pesos, a área ou a forma de comparação pode mudar o nível.
> - **Não há ordem dentro do nível.** Dois municípios de prioridade muito alta não são classificados entre si como "primeiro" e "segundo".
> - **Os níveis não têm o mesmo tamanho.** Eles são definidos por faixas de cada critério, então a quantidade de municípios em cada nível varia.
> - **Pode depender do cenário.** No cenário pessimista, que é o padrão, um município na fronteira entre dois níveis fica com o mais alto.
>
> Se quiser saber por que um município específico ficou nesse nível, eu consulto os valores dele em cada critério.
