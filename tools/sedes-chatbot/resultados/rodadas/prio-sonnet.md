# Rodada prio-sonnet

Modelo sonnet, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T02:23.

| Medida                                  | Valor                          |
| --------------------------------------- | ------------------------------ |
| Perguntas (turnos)                      | 11 (12)                        |
| Notas do juiz                           | 9 certo · 2 parcial · 0 errado |
| Com número esperado faltando            | 0                              |
| Turnos com erro                         | 0                              |
| Tempo por turno (média · mediana · p90) | 13,1 · 10,8 · 22,1 s           |
| Rodadas do modelo por turno             | 2,0                            |
| Ferramentas por turno                   | 1,0                            |
| Turnos que chamaram listar_indices      | 0%                             |
| Tokens de entrada por turno (com cache) | 56,8 mil                       |
| Tokens de saída por turno               | 680                            |
| Custo somado (preço de API)             | US$ 0.58                       |

| Id  | Categoria   | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ----------- | ------- | --------- | ------- | ----------- |
| N01 | priorização | certo   | 22,1      | 2       | 1           |
| N02 | priorização | certo   | 24,8      | 3       | 2           |
| N03 | priorização | certo   | 21,7      | 2       | 1           |
| N04 | priorização | certo   | 12,7      | 3       | 2           |
| N05 | priorização | certo   | 15,0      | 3       | 2           |
| N06 | priorização | certo   | 10,8      | 1       | 0           |
| N07 | priorização | parcial | 8,9 + 7,3 | 2 + 2   | 1 + 1       |
| N08 | priorização | certo   | 8,8       | 2       | 1           |
| N09 | priorização | certo   | 6,7       | 1       | 0           |
| N10 | priorização | parcial | 9,3       | 2       | 1           |
| N11 | priorização | certo   | 8,4       | 1       | 0           |

## N07 — priorização — parcial

**Juiz:** Os números e listas batem com as ferramentas: peso 2 (40% contra 20%) dado, 33 de 184 com prioridade muito alta e 27 na análise padrão. A comparação final também está certa (entram 9, saem 3, 27+9−3=33). Porém o texto traz uma autocorreção confusa ("Entraram 8 municípios" com 9 nomes, "4 saíram e a lista cresceu em 6") que atrapalha a leitura.

**Esperado:** Roda de novo no Ceará com Pobreza Rural com peso maior que os outros (ex.: 3 contra 1, que dá 31 municípios de prioridade muito alta; com outro peso o número muda) e diz o peso que usou. Na primeira resposta, padrão: 27 de 184 com prioridade muito alta. Diz que a lista mudou (ex.: entram Acaraú, Itapipoca, Trairi; saem Banabuiú, Iguatu) só se tiver os dois resultados.

**Pergunta:** Quais municípios do Ceará têm prioridade muito alta na priorização padrão?

8,9 s · 2 rodadas · 58,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"listar":["Muito alta"]}`

> Na priorização padrão do site, 27 dos 184 municípios do Ceará ficaram com prioridade muito alta:
>
> Aiuaba, Antonina do Norte, Assaré, Baixio, Banabuiú, Brejo Santo, Campos Sales, Icó, Iguatu, Independência, Jaguaretama, Jaguaruana, Limoeiro do Norte, Milhã, Monsenhor Tabosa, Morada Nova, Moraújo, Novo Oriente, Orós, Parambu, Penaforte, Quixelô, Saboeiro, Salitre, São João do Jaguaribe, Senador Sá e Tabuleiro do Norte.
>
> **Configuração:** usei os critérios padrão do site, com pesos iguais (25% cada): Índice de Aridez (benefício), Índice de Seca (custo), Área Degradada (custo) e Pobreza Rural (custo). A área foi o Ceará, no cenário pessimista e com os limiares padrão. A lista está em ordem alfabética, porque dentro de um nível não há ordem.
>
> **Distribuição por nível:** Muito alta 27, Alta 63, Média 62, Baixa 23, Muito baixa 9. Todos os 184 municípios foram classificados, e nenhum ficou de fora por falta de dado.
>
> **Como ler:** o nível é relativo. "Muito alta" quer dizer que o município está em situação pior que a maioria dos outros municípios do Ceará nesses critérios. Os valores vêm da planilha da Priorização, não do tabelão de índices.
>
> Posso mostrar por que um município específico ficou nesse nível, ou refazer a análise com outros critérios ou pesos.

**Pergunta:** E se a pobreza rural pesar mais que os outros critérios?

7,3 s · 2 rodadas · 61,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"criterios":[{"nome":"ia_mean","peso":1},{"nome":"spe_mean_per","peso":1},{"nome":"area_deg54_mun","peso":1},{"nome":"pobreza_rural_2021","peso":2}],"listar":["Muito alta"]}`

> Com a pobreza rural pesando o dobro, 33 municípios do Ceará ficam com prioridade muito alta, contra 27 na análise padrão.
>
> **Configuração:** "pesar mais" não tem um valor definido, então usei o dobro. A pobreza rural ficou com 40% e os outros três critérios (Índice de Aridez, Índice de Seca e Área Degradada) com 20% cada. A área foi o Ceará, no cenário pessimista e com os limiares padrão do site.
>
> **Distribuição por nível:** Muito alta 33, Alta 67, Média 61, Baixa 15, Muito baixa 8. Todos os 184 municípios foram classificados.
>
> **Prioridade muito alta (em ordem alfabética):** Acaraú, Aiuaba, Assaré, Baixio, Brejo Santo, Campos Sales, Caridade, Icó, Iguatu, Independência, Irauçuba, Itarema, Jaguaretama, Jaguaruana, Limoeiro do Norte, Martinópole, Milhã, Monsenhor Tabosa, Morada Nova, Moraújo, Novo Oriente, Orós, Pacatuba, Parambu, Penaforte, Quixelô, Saboeiro, Salitre, Senador Sá, Tabuleiro do Norte, Trairi, Umirim e Uruburetama.
>
> **Diferenças em relação à análise padrão:**
>
> - Entraram 8 municípios: Acaraú, Caridade, Irauçuba, Itarema, Martinópole, Pacatuba, Trairi, Umirim e Uruburetama. Contando de novo, são 9, porque 4 saíram e a lista cresceu em 6.
> - Saíram 3 municípios: Antonina do Norte, Banabuiú e São João do Jaguaribe.
>
> Corrijo a contagem acima: entraram 9 e saíram 3, o que dá 27 + 9 − 3 = 33. Esse saldo bate com o total.
>
> Como na análise anterior, o nível é relativo aos outros municípios do Ceará, e os valores vêm da planilha da Priorização, não do tabelão. Posso testar outro peso, como 3 para a pobreza rural, ou explicar por que um município específico mudou de nível.

## N10 — priorização — parcial

**Juiz:** Os critérios, os pesos iguais, a região e o 445 de 1.794 com o padrão do site (cada estado separado) estão corretos, e o assistente avisa a comparação usada. Faltam o valor comparando o Nordeste todo junto (366) e a ressalva de que a comparação muda o resultado. Ele só oferece rodar de outra forma no fim, sem dizer que o resultado muda.

**Esperado:** Critérios Domicílios com esgotamento sanitário (benefício) e Pessoas não alfabetizadas (custo), pesos iguais, região Nordeste. Diz como comparou: com o padrão do site (cada estado separado) dá 445 de 1.794 com prioridade muito alta; comparando o Nordeste todo junto, 366. Diz que a comparação muda o resultado ou pergunta qual a pessoa quer.

**Pergunta:** Quero priorizar municípios do Nordeste com pouco esgotamento sanitário e muita gente não alfabetizada.

9,3 s · 2 rodadas · 60,3 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"},"criterios":[{"nome":"pct_rede_2022","peso":1},{"nome":"pct_naoalf_2022","peso":1}]}`

> **Configuração:** Nordeste, com dois critérios de peso igual (50% cada): domicílios com esgotamento sanitário por rede (quanto menos, maior a prioridade) e pessoas não alfabetizadas (quanto mais, maior a prioridade). Usei o cenário pessimista e os limiares padrão do site. Cada estado foi comparado só com ele mesmo, que é o padrão do site.
>
> **Resultado:** dos 1.794 municípios classificados, nenhum ficou de fora por falta de dado. Distribuição por nível:
>
> - Muito alta: 445
> - Alta: 467
> - Média: 380
> - Baixa: 308
> - Muito baixa: 194
>
> **Prioridade muito alta por estado:** BA 85, PI 64, PB 61, MA 59, PE 51, CE 42, RN 33, AL 28, SE 22.
>
> **Exemplos de prioridade muito alta:** Abaiara–CE, Acopiara–CE, Adustina–BA, Afonso Cunha–MA, Águas Belas–PE, Aguiar–PB, Alagoinha do Piauí–PI, Araci–BA, Belo Monte–AL, Boquim–SE. A lista completa tem 445 municípios, em ordem alfabética. Dentro de um nível não há ordem.
>
> **Como ler:** o nível é relativo ao estado. "Muito alta" quer dizer pior que a maioria dos municípios do mesmo estado nesses dois critérios, não um valor absoluto. Os dados vêm da planilha da Priorização, não do tabelão de índices.
>
> Posso rodar para um estado específico, para ver a lista completa dele. Também posso comparar o Nordeste inteiro numa lista única ou dar peso maior a um dos critérios.

## N01 — priorização — certo

**Juiz:** ok. Informa a configuração (4 critérios padrão com 25% cada, Paraíba, cenário pessimista). Traz os números da ferramenta: 210 classificados, 13 fora, entre eles João Pessoa, e 23 de prioridade muito alta com a lista completa. Avisa que não há ordem dentro do nível e que o nível é relativo.

**Esperado:** Usa a Priorização com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), Paraíba, cenário pessimista, e diz essa configuração. 210 municípios classificados; 13 ficaram de fora por falta de dado (entre eles João Pessoa). 23 com prioridade muito alta (ex.: Assunção, Juazeirinho, Salgadinho, Tenório, Serra Branca, São Vicente do Seridó, Junco do Seridó...). Não ordena municípios dentro do nível.

**Pergunta:** Quais municípios da Paraíba deveriam ser priorizados para ações contra a seca e a desertificação?

22,1 s · 2 rodadas · 58,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"}}`

> Rodei a Priorização do SEDES para a Paraíba, com os critérios padrão do site e pesos iguais (25% cada):
>
> - Índice de Aridez (benefício);
> - Índice de Seca (custo);
> - Área Degradada (custo);
> - Pobreza Rural (custo).
>
> Cada município foi comparado com os outros da Paraíba, no cenário pessimista (que, na dúvida entre dois níveis, põe o município no de maior prioridade). Os valores vêm da planilha da Priorização, não do tabelão de índices.
>
> **Prioridade muito alta (23 municípios):** Areial, Assunção, Baraúna, Camalaú, Caraúbas, Congo, Coxixola, Cubati, Curral de Cima, Ingá, Juazeirinho, Junco do Seridó, Lagoa de Dentro, Montadas, Parari, Pilar, Riacho de Santo Antônio, Salgadinho, Santo André, São Vicente do Seridó, Serra Branca, Sobrado e Tenório.
>
> Dentro de um nível não há ordem: nenhum desses municípios é "o primeiro".
>
> **Distribuição dos 210 municípios classificados:** muito alta 23, alta 78, média 71, baixa 31, muito baixa 7.
>
> **Como ler:** o nível é relativo. "Muito alta" quer dizer pior que a maioria dos outros municípios paraibanos nesses quatro critérios, não um valor absoluto.
>
> **Ficaram de fora (13), por falta de dado:** Alhandra, Baía da Traição, Bayeux, Caaporã, Cabedelo, Caldas Brandão, Conde, Cruz do Espírito Santo, João Pessoa, Marcação, Olivedos, Pitimbu e Riachão do Poço.
>
> Posso refazer com outros critérios, como seca grave nos últimos 6 meses, analfabetismo ou cisternas, ou com pesos diferentes, por exemplo pobreza valendo o dobro.

## N02 — priorização — certo

**Juiz:** ok: critérios e pesos (66,7%/33,3%), Semiárido, comparação conjunta, 1.477 classificados e a distribuição (280/831/138/135/93) batem com a ferramenta. Cita exemplos, diz que são 280 sem listar todos nem ordenar, e acrescenta ressalvas corretas sobre a planilha e o período dos critérios.

**Esperado:** Critérios Pobreza Rural (67%) e Seca Registrada (33%), Semiárido, todos comparados juntos. 1.477 municípios classificados, nenhum de fora. Prioridade muito alta: 280; alta: 831; média: 138; baixa: 135; muito baixa: 93. Cita alguns dos 280 e diz que são 280, sem listar todos nem ordenar.

**Pergunta:** Faz uma priorização do Semiárido combinando pobreza rural e seca registrada, com a pobreza pesando o dobro. Quero uma lista única do Semiárido todo, não separada por estado.

24,8 s · 3 rodadas · 91,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"semiarido"},"criterios":[{"nome":"pobreza_rural_2021","peso":2},{"nome":"seca_grave_6_meses","peso":1}],"comparar_dentro_de":"area"}`
1. link_no_sedes: `{"indices":["percentual-de-pobreza-rural-cadunico"],"territorio":"5_semiarido-semiarido-total"}`

> Rodei a Priorização do Semiárido com todos os municípios numa lista única, sem separar por estado.
>
> **Configuração:**
>
> - **Critérios:** Pobreza Rural (peso 2, ou 66,7%) e Seca Registrada (peso 1, ou 33,3%). Os dois são de custo: quanto maior o valor, maior a prioridade.
> - **Área e comparação:** Semiárido, todos os municípios comparados juntos.
> - **Cenário e limiares:** pessimista, com os limiares padrão do site (0,02 / 0,1 / 0,5).
> - **Municípios classificados:** 1.477 de 1.477. Nenhum ficou de fora por falta de dado.
>
> **Distribuição por nível:**
>
> - Muito alta: 280
> - Alta: 831
> - Média: 138
> - Baixa: 135
> - Muito baixa: 93
>
> **Prioridade muito alta (280 municípios):** a ferramenta listou só parte deles. São 150 nomes, em ordem alfabética, de Abaré–BA a Mata Verde–MG. Dentro do nível não há ordem. Alguns exemplos: Acaraú–CE, Apodi–RN, Arcoverde–PE, Cajazeiras–PB, Catolé do Rocha–PB, Irauçuba–CE e Jaicós–PI. Os outros 130 não vieram na resposta.
>
> **Como ler:**
>
> - O nível é relativo. "Muito alta" quer dizer pior que a maioria dos outros municípios do Semiárido nesses dois critérios. Não é um valor absoluto.
> - Os valores vêm da planilha da Priorização, não do tabelão. Por isso podem diferir dos índices do Monitor de Secas e do CadÚnico.
> - Segundo a descrição do critério, "Seca Registrada" é o percentual de seca grave, extrema e excepcional nos últimos 6 meses (fev–jul/2026), no Monitor de Secas da ANA. "Pobreza Rural" é o indicador municipal de pobreza rural em 2025.
>
> Posso rodar de novo por estado, para obter a lista completa dos municípios de prioridade muito alta de cada um.

## N03 — priorização — certo

**Juiz:** Ok. Os quatro valores e percentuais batem com a ferramenta (0,242/97,6%; 29,6/98,6%; 81,3/82,9%; 12,4/58,6%). Diz que o nível é relativo à Paraíba e aos critérios, e não atribui a causa a um só critério. Informa a configuração (pesos de 25%, comparação por estado, cenário pessimista) e que os dados vêm da planilha da Priorização.

**Esperado:** Com os critérios padrão do site, comparando dentro da Paraíba: Assunção está em situação pior que 97,6% dos municípios da PB no Índice de Aridez (0,242), 98,6% no Índice de Seca (29,6%), 82,9% na Pobreza Rural e 58,6% na Área Degradada. Diz que o nível é relativo aos municípios da Paraíba e aos critérios escolhidos, e não atribui causa a um critério só.

**Pergunta:** Por que Assunção, na Paraíba, aparece com prioridade muito alta na priorização?

21,7 s · 2 rodadas · 58,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"municipios":["Assunção-PB"]}`

> Assunção–PB ficou em **prioridade muito alta** porque está em situação ruim na maioria dos critérios, em comparação com os outros municípios da Paraíba.
>
> Usei os critérios padrão do site, com peso igual (25% cada), só nos 210 municípios paraibanos com dado completo. A comparação é só dentro da Paraíba, no cenário pessimista. Os valores vêm da planilha da Priorização, não do tabelão de índices.
>
> A coluna "pior que" diz em qual % dos municípios do grupo Assunção está em situação pior:
>
> | Critério             | Valor de Assunção | Pior que (% dos municípios da PB) |
> | -------------------- | ----------------- | --------------------------------- |
> | Índice de Aridez     | 0,242             | 97,6%                             |
> | Índice de Seca (%)   | 29,6              | 98,6%                             |
> | Pobreza Rural        | 81,3              | 82,9%                             |
> | Área Degradada (km²) | 12,4              | 58,6%                             |
>
> - **Aridez e seca** pesaram mais para cima. Assunção é mais árida e tem mais seca que quase todos os municípios do estado. No índice de aridez, valor menor significa mais seco.
> - **Pobreza rural** também puxou para cima, com 81,3.
> - **Área degradada** foi o critério mais neutro, perto da metade do grupo.
>
> Esse nível é relativo: "muito alta" quer dizer pior que a maioria dos outros municípios da Paraíba nesses critérios. Outros critérios ou pesos podem mudar o resultado. Na Paraíba, 23 municípios ficaram nesse nível. Se quiser, posso refazer a análise com outros critérios.

## N04 — priorização — certo

**Juiz:** ok: diz prioridade média para Campina Grande-PB, com a configuração (4 critérios padrão, 25% cada, área Paraíba, comparação dentro da PB, cenário pessimista). Números batem com a ferramenta e avisa que o nível é relativo e vem da planilha da Priorização. Só não diz explicitamente que mudar os critérios muda o nível, mas oferece refazer com outros critérios ou pesos.

**Esperado:** Campina Grande–PB, com os critérios padrão do site comparando dentro da Paraíba: prioridade média. Diz a configuração usada (e que mudando os critérios o nível muda).

**Pergunta:** Qual o nível de prioridade de Campina Grande?

12,7 s · 3 rodadas · 88 mil tokens de entrada

1. buscar_territorio: `{"nome":"Campina Grande"}`
1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"municipios":["Campina Grande-PB"]}`

> Campina Grande–PB ficou com **prioridade média** na Priorização do SEDES.
>
> **Configuração:** usei os critérios padrão do site, com pesos iguais (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. A área foi a Paraíba e o cenário foi o pessimista, que é o padrão do site. O município foi comparado com os outros 210 municípios paraibanos classificados. Esse nível é relativo: vale só em comparação com os demais da Paraíba, nesses critérios.
>
> **O que pesou:**
>
> - **Área Degradada (43,2 km²):** pesou para cima. O município está pior que 90% do grupo.
> - **Índice de Aridez (0,394):** ficou no meio. Está pior que 49% do grupo.
> - **Índice de Seca (8,96%):** ficou no meio. Está pior que 43,3% do grupo.
> - **Pobreza Rural (62,8):** pesou para baixo. Está pior que só 8,6% do grupo.
>
> **Distribuição na Paraíba:** 23 municípios ficaram em prioridade muito alta, 78 em alta, 71 em média, 31 em baixa e 7 em muito baixa. Outros 13 municípios ficaram de fora por falta de dado.
>
> Esses valores vêm da planilha da Priorização, não dos índices do tabelão. Se quiser, posso refazer a análise com outros critérios ou pesos, ou comparando todos os municípios do Semiárido juntos.

## N05 — priorização — certo

**Juiz:** ok. Diz que João Pessoa ficou de fora por falta de dado no Índice de Seca e não inventa nível. Os números (13 de 223 excluídos, 210 classificados) e a configuração batem com a ferramenta. Cita Cabedelo, Bayeux e Conde, que estão na lista.

**Esperado:** João Pessoa fica de fora da Priorização padrão por não ter valor no Índice de Seca na planilha da Priorização. Não inventa um nível.

**Pergunta:** E João Pessoa, qual a prioridade dela na priorização padrão?

15,0 s · 3 rodadas · 58,9 mil tokens de entrada

1. buscar_territorio: `{"nome":"João Pessoa"}`
1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"municipios":["João Pessoa-PB"]}`

> João Pessoa–PB não recebeu nível de prioridade na priorização padrão do site, porque não tem dado em um dos critérios.
>
> - **Configuração:** usei os critérios padrão com pesos iguais (25% cada). São Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. A área foi a Paraíba, com cada estado comparado separadamente e no cenário pessimista.
> - **Motivo da exclusão:** a planilha da Priorização não traz o Índice de Seca para João Pessoa. O método só classifica municípios que têm valor em todos os critérios escolhidos.
> - **Resultado geral:** 13 dos 223 municípios da Paraíba ficaram de fora pela mesma razão. Entre eles estão Cabedelo, Bayeux e Conde. Os outros 210 foram classificados.
>
> Se quiser, posso rodar a priorização sem o Índice de Seca, com os outros três critérios, para ver onde João Pessoa fica. Nesse caso, a configuração seria diferente da padrão.

## N06 — priorização — certo

**Juiz:** Ok: diz que a Priorização não tem critério de desmatamento, aponta Área Degradada (níveis 4 e 5) como o mais próximo e oferece rodar com ele, sem fingir que é desmatamento. Menciona o PRODES (2000 a 2024) só no Monitoramento, o que bate com o catálogo, e não apresenta números inventados.

**Esperado:** Não: a Priorização não tem um critério de desmatamento. Mostra os critérios mais próximos que existem (ex.: Área Degradada) e oferece rodar com eles. Não roda uma análise fingindo que é desmatamento.

**Pergunta:** Dá para fazer a priorização usando desmatamento como critério?

10,8 s · 1 rodadas · 28,9 mil tokens de entrada

> Não diretamente. A Priorização do SEDES não tem um critério de desmatamento na lista.
>
> Os critérios mais próximos são estes:
>
> - **Área Degradada (km²)** (`area_deg54_mun`): área do município em degradação de níveis 4 e 5. Quanto maior, mais prioridade.
> - **Índice de Aridez** (`ia_mean`) e **Índice de Seca (%)** (`spe_mean_per`): tratam de clima, não de perda de vegetação.
>
> O SEDES tem o desmatamento no **PRODES | INPE**, que mostra a % da área com desmatamento acumulado e com vegetação nativa (2000 a 2024). Esse dado está no Monitoramento, mas não entra na Priorização.
>
> Posso fazer de duas formas:
>
> 1. Rodar a Priorização com Área Degradada no lugar do desmatamento, junto com outros critérios que você escolher.
> 2. Fazer um ranking dos municípios por desmatamento acumulado no PRODES, para um estado ou recorte à sua escolha.
>
> Qual você prefere? Se for a primeira, diga também a área (um estado, o Semiárido, o Brasil etc.).

## N08 — priorização — certo

**Juiz:** ok. Diz que 1 município (Madre de Deus) fica de fora, de 417, com 416 classificados. Explica que faltam dados no Índice de Aridez e na Área Degradada, como na ferramenta. Também informa que os valores vêm da planilha da Priorização.

**Esperado:** 1 de 417: Madre de Deus, sem valor no Índice de Aridez e na Área Degradada na planilha da Priorização. Os outros 416 são classificados.

**Pergunta:** Na priorização padrão da Bahia, quantos municípios ficam de fora e por quê?

8,8 s · 2 rodadas · 59 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"}}`

> Só **1 município** fica de fora na priorização padrão da Bahia: **Madre de Deus**. Foram classificados 416 dos 417.
>
> **Por quê:** o município não tem dado em dois dos critérios escolhidos, o Índice de Aridez e a Área Degradada. A Priorização exclui quem não tem valor em algum critério.
>
> **Configuração usada:**
>
> - Critérios padrão do site, com pesos iguais (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural.
> - Área: Bahia. Cenário: pessimista.
> - Limiares: os padrões do site.
>
> Os valores vêm da planilha da Priorização, não do tabelão de índices.

## N09 — priorização — certo

**Juiz:** ok. Explica corretamente que os dois cenários só divergem para municípios na fronteira entre duas classes, que o pessimista (padrão) escolhe a classe de maior prioridade e o otimista a de menor, como nos textos do site. A frase de que o otimista tende a ter menos municípios nos níveis altos é uma consequência lógica e vem com ressalva de que não foi calculada. O exemplo da Paraíba era opcional.

**Esperado:** Com os textos do site: os dois só divergem quando um município está na fronteira entre dois níveis; o pessimista (padrão do site) põe o município no nível de maior prioridade, o otimista no de menor. Pode mostrar o efeito na Paraíba com os critérios padrão (muito alta: 23 no pessimista, 4 no otimista), se rodar as duas.

**Pergunta:** Qual a diferença entre o cenário otimista e o pessimista na priorização?

6,7 s · 1 rodadas · 28,9 mil tokens de entrada

> A Priorização usa o método ELECTRE TRI-B, que gera dois resultados (procedimentos de atribuição). Eles só diferem quando um município fica na fronteira entre duas classes.
>
> - **Pessimista (padrão do site):** o município de fronteira vai para a classe de **maior prioridade** das duas. É a opção mais conservadora, indicada para política pública, quando é melhor não subestimar a prioridade de um território.
> - **Otimista:** o município de fronteira vai para a classe de **menor prioridade**. Isso reserva os níveis mais altos para os territórios em que a prioridade não deixa dúvida.
>
> Na prática, o cenário otimista tende a colocar menos municípios nos níveis mais altos. Isso decorre da regra de atribuição, e não de um resultado que eu tenha calculado nesta conversa.
>
> Se quiser, posso rodar a Priorização nos dois cenários para uma área e comparar o resultado.

## N11 — priorização — certo

**Juiz:** ok. Explica que é o nível mais alto, relativo ao grupo e aos critérios, e que muda com critérios, pesos e área, como esperado. Não rodou análise e os detalhes extras (custo/benefício, cenário pessimista, sem ordem) batem com o texto do site.

**Esperado:** É o nível mais alto dos 5 da Priorização: o município está em situação pior que a maioria dos municípios do mesmo grupo de comparação nos critérios escolhidos, com os pesos dados. É relativo (ao grupo e aos critérios), não um valor absoluto; mudando critérios, pesos ou área, muda. Não precisa rodar uma análise.

**Pergunta:** O que quer dizer um município estar com prioridade muito alta?

8,4 s · 1 rodadas · 28,9 mil tokens de entrada

> **Prioridade muito alta** é o nível mais alto de prioridade de intervenção na aba Priorização do SEDES. Ela mostra que o município está em situação pior que a maioria dos outros municípios do mesmo grupo, nos critérios escolhidos.
>
> Alguns pontos para ler esse resultado:
>
> - **É um nível relativo, não absoluto.** Ele compara o município com os outros do grupo. Por padrão, cada estado é comparado só consigo mesmo. Um município de prioridade alta em um estado pode estar melhor que um de prioridade baixa em outro.
> - **Depende dos critérios e dos pesos.** Se você mudar os indicadores (seca, pobreza, degradação da terra, aridez etc.), os pesos, a área ou a forma de comparação, o resultado muda.
> - **Cada critério conta de um jeito.** Nos critérios de "custo", como pobreza rural ou seca, valor maior significa pior situação e mais prioridade. Nos de "benefício", como esgotamento sanitário ou cisternas entregues, valor maior significa melhor situação e menos prioridade.
> - **Não há ordem dentro do nível.** O método (ELECTRE TRI-B) não diz qual município de prioridade muito alta é o "primeiro".
> - **O cenário também influencia.** No cenário pessimista, que é o padrão, um município que fica na fronteira entre dois níveis vai para o de maior prioridade. A ideia é não subestimar o território.
> - **Ficam de fora os municípios sem dado** em algum dos critérios escolhidos.
>
> Se quiser, posso rodar a Priorização para um estado ou uma área e mostrar quais municípios ficaram em prioridade muito alta.
