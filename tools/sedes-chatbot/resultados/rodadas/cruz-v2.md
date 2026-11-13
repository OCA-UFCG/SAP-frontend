# Rodada cruz-v2

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T13:41.

| Medida                                  | Valor                           |
| --------------------------------------- | ------------------------------- |
| Perguntas (turnos)                      | 21 (23)                         |
| Notas do juiz                           | 18 certo · 3 parcial · 0 errado |
| Com número esperado faltando            | 0                               |
| Turnos com erro                         | 0                               |
| Tempo por turno (média · mediana · p90) | 9,0 · 8,0 · 13,7 s              |
| Rodadas do modelo por turno             | 2,9                             |
| Ferramentas por turno                   | 1,9                             |
| Turnos que chamaram listar_indices      | 0%                              |
| Tokens de entrada por turno (com cache) | 76,8 mil                        |
| Tokens de saída por turno               | 1513                            |
| Custo somado (preço de API)             | US$ 0.06                        |

| Id  | Categoria                   | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | --------------------------- | ------- | --------- | ------- | ----------- |
| N01 | priorização                 | parcial | 8,0       | 2       | 1           |
| N02 | priorização                 | certo   | 9,0       | 2       | 1           |
| N03 | priorização                 | parcial | 7,4       | 2       | 1           |
| N04 | priorização                 | parcial | 7,5       | 2       | 1           |
| N05 | priorização                 | certo   | 7,3       | 2       | 1           |
| N06 | priorização                 | certo   | 4,6       | 1       | 0           |
| N07 | priorização                 | certo   | 5,2 + 6,0 | 2 + 2   | 1 + 1       |
| N08 | priorização                 | certo   | 3,9       | 2       | 1           |
| N09 | priorização                 | certo   | 3,9       | 1       | 0           |
| N10 | priorização                 | certo   | 7,7       | 2       | 1           |
| N11 | priorização                 | certo   | 4,6       | 1       | 0           |
| W01 | priorização e monitoramento | certo   | 9,2       | 4       | 3           |
| W02 | priorização e monitoramento | certo   | 10,7      | 6       | 5           |
| W03 | priorização e monitoramento | certo   | 12,3      | 4       | 3           |
| W04 | priorização e monitoramento | certo   | 9,0       | 4       | 3           |
| W05 | priorização e monitoramento | certo   | 8,1 + 7,3 | 2 + 3   | 1 + 2       |
| W06 | priorização e monitoramento | certo   | 13,2      | 4       | 3           |
| W07 | priorização e monitoramento | certo   | 17,7      | 4       | 3           |
| W08 | priorização e monitoramento | certo   | 12,7      | 5       | 4           |
| W09 | priorização e monitoramento | certo   | 13,7      | 5       | 4           |
| W10 | priorização e monitoramento | certo   | 17,7      | 4       | 3           |

## N01 — priorização — parcial

**Juiz:** A lista de 23 municípios, a configuração (critérios padrão, pesos iguais, pessimista, PB), a distribuição e os 13 excluídos batem com a ferramenta. Faltou dizer que 210 municípios foram classificados, que a resposta esperada pede. Também afirmou que os 13 ficaram de fora por falta de dado "no Índice de Seca", mas a ferramenta diz que um deles (Índice de Aridez) também teve falta de dado. É problema menor.

**Esperado:** Usa a Priorização com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), Paraíba, cenário pessimista, e diz essa configuração. 210 municípios classificados; 13 ficaram de fora por falta de dado (entre eles João Pessoa). 23 com prioridade muito alta (ex.: Assunção, Juazeirinho, Salgadinho, Tenório, Serra Branca, São Vicente do Seridó, Junco do Seridó...). Não ordena municípios dentro do nível.

**Pergunta:** Quais municípios da Paraíba deveriam ser priorizados para ações contra a seca e a desertificação?

8,0 s · 2 rodadas · 61,2 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta"]}`

> Na Paraíba, 23 municípios ficaram no nível de prioridade **muito alta** para ações contra a seca e a desertificação:
>
> Areial, Assunção, Baraúna, Camalaú, Caraúbas, Congo, Coxixola, Cubati, Curral de Cima, Ingá, Juazeirinho, Junco do Seridó, Lagoa de Dentro, Montadas, Parari, Pilar, Riacho de Santo Antônio, Salgadinho, Santo André, São Vicente do Seridó, Serra Branca, Sobrado e Tenório.
>
> **Como foi calculado:** usei os critérios padrão do site, com pesos iguais (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. O cenário foi o pessimista, e os municípios foram comparados dentro do próprio estado. Os valores vêm da planilha da Priorização, não do tabelão, e a planilha não informa a data de cada critério. O nível é relativo: "muito alta" significa situação pior que a maioria dos municípios paraibanos nesses critérios.
>
> **Distribuição:** 23 muito alta, 78 alta, 71 média, 31 baixa e 7 muito baixa.
>
> **Fora da análise:** 13 municípios ficaram sem classificação por falta de dado no Índice de Seca, entre eles João Pessoa, Cabedelo, Bayeux e Conde.
>
> Se quiser, posso refazer a análise com outros critérios ou pesos, por exemplo dando peso dobro à pobreza, ou cruzar esses níveis com índices como o Monitor de Secas.

## N03 — priorização — parcial

**Juiz:** Os quatro números e os percentuais batem com a ferramenta, e a resposta explica que o nível é relativo à Paraíba. Mas diz que Índice de Seca é "o principal fator para cima", o que atribui causa a um critério só, e a resposta esperada pede para não fazer isso. Também afirma que Assunção está pior que a maioria em "todos os quatro critérios", o que é verdade, mas ressalta pouco que a pobreza rural pesa bastante.

**Esperado:** Com os critérios padrão do site, comparando dentro da Paraíba: Assunção está em situação pior que 97,6% dos municípios da PB no Índice de Aridez (0,242), 98,6% no Índice de Seca (29,6%), 82,9% na Pobreza Rural e 58,6% na Área Degradada. Diz que o nível é relativo aos municípios da Paraíba e aos critérios escolhidos, e não atribui causa a um critério só.

**Pergunta:** Por que Assunção, na Paraíba, aparece com prioridade muito alta na priorização?

7,4 s · 2 rodadas · 61,2 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"municipios":["Assunção-PB"]}`

> Assunção (PB) ficou em **prioridade muito alta** porque está em situação pior que a maioria dos municípios paraibanos em todos os quatro critérios usados. O nível é relativo: compara Assunção com os 210 municípios da Paraíba classificados.
>
> Critérios e pesos (iguais, 25% cada), comparação dentro da Paraíba, cenário pessimista (padrão do site):
>
> - **Índice de Seca (%)**: 29,6, pior que 98,6% dos municípios. É o principal fator para cima. Esse índice é o indicador SPE, não o Monitor de Secas.
> - **Índice de Aridez**: 0,242, pior que 97,6%. Quanto menor o valor, mais seco o clima, e Assunção está entre os mais secos do estado.
> - **Pobreza Rural**: 81,3, pior que 82,9%.
> - **Área Degradada (km²)**: 12,4, pior que 58,6%. É o critério menos desfavorável.
>
> Os dados são da planilha da Priorização, não do tabelão, e o período de cada critério está na descrição da planilha.

## N04 — priorização — parcial

**Juiz:** O nível (média), a comparação com os 210 municípios da PB e a configuração padrão batem com a ferramenta e com a resposta esperada. Falta avisar que mudar critérios, pesos ou comparação muda o nível, o que a resposta esperada exige. Há também um erro: diz que a área degradada "é o critério que mais pesa para cima", mas os critérios têm pesos iguais de 25%. Além disso, "puxa para cima" para 90% e "puxa para baixo" para 8,6% são interpretações razoáveis, mas Índice de Aridez 49% é neutro.

**Esperado:** Campina Grande–PB, com os critérios padrão do site comparando dentro da Paraíba: prioridade média. Diz a configuração usada (e que mudando os critérios o nível muda).

**Pergunta:** Qual o nível de prioridade de Campina Grande?

7,5 s · 2 rodadas · 61,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["Campina Grande-PB"]}`

> Campina Grande–PB está em **prioridade média**, na comparação com os 210 municípios da Paraíba.
>
> A análise usou os quatro critérios padrão do site, com pesos iguais (25% cada), área Brasil e comparação dentro de cada estado, no cenário pessimista. Os valores vêm da planilha da Priorização, não do tabelão.
>
> | Critério         | Valor de Campina Grande | Situação pior que (% dos municípios da PB) |
> | ---------------- | ----------------------- | ------------------------------------------ |
> | Área Degradada   | 43,2 km²                | 90% (puxa para cima)                       |
> | Índice de Seca   | 8,96%                   | 43,3%                                      |
> | Índice de Aridez | 0,394                   | 49%                                        |
> | Pobreza Rural    | 62,8                    | 8,6% (puxa para baixo)                     |
>
> A área degradada é o critério que mais pesa para cima. A pobreza rural é o que mais puxa para baixo. O nível é relativo ao grupo: "média" significa que Campina Grande está numa posição intermediária entre os municípios paraibanos, nesses critérios.

## N02 — priorização — certo

**Juiz:** Ok. Critérios e pesos (66,7% e 33,3%), Semiárido, comparação conjunta, 1.477 classificados e a distribuição (280/831/138/135/93) batem com a ferramenta. Cita 10 dos 280 em ordem alfabética, diz que são 280 e que não há ordem dentro do nível.

**Esperado:** Critérios Pobreza Rural (67%) e Seca Registrada (33%), Semiárido, todos comparados juntos. 1.477 municípios classificados, nenhum de fora. Prioridade muito alta: 280; alta: 831; média: 138; baixa: 135; muito baixa: 93. Cita alguns dos 280 e diz que são 280, sem listar todos nem ordenar.

**Pergunta:** Faz uma priorização do Semiárido combinando pobreza rural e seca registrada, com a pobreza pesando o dobro. Quero uma lista única do Semiárido todo, não separada por estado.

9,0 s · 2 rodadas · 62,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"semiarido"},"criterios":[{"nome":"pobreza_rural_2021","peso":2},{"nome":"seca_grave_6_meses","peso":1}],"comparar_dentro_de":"area"}`

> Priorizei os **1.477 municípios do Semiárido** numa lista única, sem separar por estado. Todos ficaram classificados, sem falta de dado.
>
> - **Critérios e pesos:** Pobreza Rural 66,7% (peso 2) e Seca Registrada 33,3% (peso 1). Ambos são critérios de custo: quanto maior o valor, maior a prioridade.
> - **Comparação:** todos os municípios do Semiárido juntos. Cenário pessimista e limiares padrão do site.
> - **Distribuição:** muito alta 280; alta 831; média 138; baixa 135; muito baixa 93.
>
> Municípios de prioridade muito alta (280 no total). Mostro 10, em ordem alfabética, porque a lista tem mais de 25:
>
> 1. Abaré–BA
> 2. Acarape–CE
> 3. Acaraú–CE
> 4. Afonso Bezerra–RN
> 5. Alagoinha do Piauí–PI
> 6. Alagoinha–PE
> 7. Algodão de Jandaíra–PB
> 8. Alto do Rodrigues–RN
> 9. Alto Longá–PI
> 10. Amarante–PI
>
> Os dados vêm da planilha da Priorização, não do tabelão. Pobreza Rural é o indicador municipal da planilha, e Seca Registrada é o percentual de seca grave ou pior no Monitor de Secas da ANA entre fevereiro e julho de 2026. Dentro de um nível, a ordem não indica qual município é "o primeiro".
>
> Posso cruzar esses níveis com algum índice do tabelão, como o Monitor de Secas ou o CadÚnico, ou listar os municípios de outro nível.

## N05 — priorização — certo

**Juiz:** ok. Diz que João Pessoa ficou de fora por falta de dado no Índice de Seca e não inventa nível, como na resposta esperada. Os números (116 de fora, 106 pelo Índice de Seca) e a configuração batem com a saída da ferramenta.

**Esperado:** João Pessoa fica de fora da Priorização padrão por não ter valor no Índice de Seca na planilha da Priorização. Não inventa um nível.

**Pergunta:** E João Pessoa, qual a prioridade dela na priorização padrão?

7,3 s · 2 rodadas · 61,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["João Pessoa-PB"]}`

> João Pessoa-PB **não tem nível de prioridade** na Priorização padrão. Ela ficou de fora da classificação porque não tem dado no **Índice de Seca**, um dos quatro critérios padrão.
>
> A configuração usada foi: Brasil como área, cada estado comparado separadamente, cenário pessimista e os quatro critérios padrão com pesos iguais (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural). Os dados são da planilha da Priorização, não do tabelão.
>
> Dos 5.571 municípios, 116 ficaram de fora por falta de dado, sendo 106 pelo Índice de Seca.

## N06 — priorização — certo

**Juiz:** Ok. Diz que não há critério de desmatamento na Priorização, lista os critérios reais, indica Área Degradada como o mais próximo (níveis 4 e 5) e oferece rodar com ele, sem fingir que seja desmatamento. A menção ao PRODES como cruzamento separado é correta e não inventa números.

**Esperado:** Não: a Priorização não tem um critério de desmatamento. Mostra os critérios mais próximos que existem (ex.: Área Degradada) e oferece rodar com eles. Não roda uma análise fingindo que é desmatamento.

**Pergunta:** Dá para fazer a priorização usando desmatamento como critério?

4,6 s · 1 rodadas · 30 mil tokens de entrada

> Não. A Priorização não tem um critério de desmatamento. Os critérios disponíveis são Índice de Aridez, Índice de Seca, Área Degradada, Pobreza Rural, Índice de Progresso Social, Vulnerabilidade Climática, Seca Registrada, Anomalia de Precipitação, Mulheres Produtoras, Produtores em Cooperativas, População Indígena, Não Alfabetizados, Esgotamento Sanitário e as três categorias de Cisternas.
>
> O mais próximo é **Área Degradada** (área municipal classificada como degradada nos níveis 4 e 5 do Índice de Degradação da Terra). Ele mede degradação da terra, não desmatamento. Se você quiser, posso rodar a priorização com ele, indicando os outros critérios e pesos.
>
> O desmatamento aparece no tabelão, no índice PRODES (INPE), com a área de vegetação nativa e de desmatamento acumulado por município. Mas esse dado não entra na Priorização. Posso usá-lo de outra forma: priorizo os municípios com a Priorização e depois cruzo o PRODES com o nível de cada município, para ver se os de prioridade muito alta também têm mais desmatamento. Essa é uma associação, não um critério.

## N07 — priorização — certo

**Juiz:** ok. Pobreza Rural com peso 2 contra 1 (40% contra 20%) dá 33 municípios de prioridade muito alta, como na saída da ferramenta. A comparação com a lista da pergunta 1 está correta: 9 entraram, 3 saíram (Antonina do Norte, Banabuiú, São João do Jaguaribe) e 24 permaneceram. O peso usado foi dito, e a divergência de peso e de lista em relação à resposta esperada (Iguatu aparece nos dois resultados) é coerente com as ferramentas.

**Esperado:** Roda de novo no Ceará com Pobreza Rural com peso maior que os outros (ex.: 3 contra 1, que dá 31 municípios de prioridade muito alta; com outro peso o número muda) e diz o peso que usou. Na primeira resposta, padrão: 27 de 184 com prioridade muito alta. Diz que a lista mudou (ex.: entram Acaraú, Itapipoca, Trairi; saem Banabuiú, Iguatu) só se tiver os dois resultados.

**Pergunta:** Quais municípios do Ceará têm prioridade muito alta na priorização padrão?

5,2 s · 2 rodadas · 61 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"}}`

> No Ceará, **27 municípios** ficaram com prioridade muito alta na Priorização padrão do site. Alguns deles: Aiuaba, Antonina do Norte, Assaré, Baixio, Banabuiú, Brejo Santo, Campos Sales, Icó, Iguatu e Independência. Posso listar os outros 17 se quiser.
>
> - **Configuração:** Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com pesos iguais (25% cada). Os municípios são comparados só dentro do Ceará, no cenário pessimista e com os limiares padrão.
> - **Dados:** os 184 municípios do estado foram classificados. A distribuição foi de 27 muito alta, 63 alta, 62 média, 23 baixa e 9 muito baixa.
> - **Como ler:** "muito alta" significa pior situação que a maioria dos municípios cearenses nesses critérios. Não é um valor absoluto.

**Pergunta:** E se a pobreza rural pesar mais que os outros critérios?

6,0 s · 2 rodadas · 64,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"criterios":[{"nome":"ia_mean","peso":1},{"nome":"spe_mean_per","peso":1},{"nome":"area_deg54_mun","peso":1},{"nome":"pobreza_rural_2021","peso":2}],"listar":["Muito alta"]}`

> Com a pobreza rural com peso dobro (40%, e os outros três com 20% cada), a lista de prioridade muito alta muda e passa de 27 para **33 municípios**.
>
> - **Entraram 9:** Acaraú, Caridade, Irauçuba, Itarema, Martinópole, Pacatuba, Trairi, Umirim e Uruburetama.
> - **Saíram 3:** Antonina do Norte, Banabuiú e São João do Jaguaribe.
> - **Continuam nos dois casos:** 24 municípios.
>
> Dos 33, alguns são: Aiuaba, Assaré, Baixio, Brejo Santo, Campos Sales, Icó, Iguatu, Independência, Itarema e Jaguaretama. Posso listar os demais se quiser.
>
> Essa priorização usa os dados da planilha da Priorização, não os do tabelão, e o nível é relativo aos municípios do Ceará.

## N08 — priorização — certo

**Juiz:** ok: diz 1 município fora (Madre de Deus), sem dado em Índice de Aridez e Área Degradada, e que 416 de 417 foram classificados. Bate com a ferramenta e com a resposta esperada, e informa que os dados vêm da planilha da Priorização.

**Esperado:** 1 de 417: Madre de Deus, sem valor no Índice de Aridez e na Área Degradada na planilha da Priorização. Os outros 416 são classificados.

**Pergunta:** Na priorização padrão da Bahia, quantos municípios ficam de fora e por quê?

3,9 s · 2 rodadas · 61,4 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"}}`

> Na priorização padrão da Bahia, **1 município ficou de fora: Madre de Deus**. Ele não tem dado de Índice de Aridez nem de Área Degradada, dois dos quatro critérios. Sem esses dados, o método não consegue classificá-lo. Os outros 416 dos 417 municípios do estado foram classificados.
>
> A análise usou os quatro critérios padrão do site, com pesos iguais de 25% cada: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Cada estado foi comparado separadamente, no cenário pessimista. Os valores vêm da planilha da Priorização, não do tabelão.

## N09 — priorização — certo

**Juiz:** Ok: explica que os cenários só divergem na fronteira entre dois níveis, pessimista (padrão) vai ao nível de maior prioridade e otimista ao de menor, batendo com os textos do site. Não traz os números da Paraíba, mas a resposta esperada os trata como opcionais, e a oferta de rodar os dois cenários cobre isso.

**Esperado:** Com os textos do site: os dois só divergem quando um município está na fronteira entre dois níveis; o pessimista (padrão do site) põe o município no nível de maior prioridade, o otimista no de menor. Pode mostrar o efeito na Paraíba com os critérios padrão (muito alta: 23 no pessimista, 4 no otimista), se rodar as duas.

**Pergunta:** Qual a diferença entre o cenário otimista e o pessimista na priorização?

3,9 s · 1 rodadas · 30 mil tokens de entrada

> No método ELECTRE TRI-B, os dois cenários só mudam a classificação dos municípios que ficam na fronteira entre dois níveis de prioridade, quando o método não consegue decidir com clareza para qual nível o município vai.
>
> - **Pessimista** (padrão do site): o município vai para o nível de **maior prioridade** entre os dois. É a opção mais conservadora, para não subestimar a necessidade de um território em políticas públicas.
> - **Otimista**: o município vai para o nível de **menor prioridade**. Assim, os níveis mais altos ficam reservados aos territórios em que a prioridade não deixa dúvida.
>
> Por isso, o cenário pessimista tende a deixar mais municípios em prioridade alta ou muito alta, e o otimista, menos. Os municípios que não estão na fronteira ficam iguais nos dois cenários.
>
> Se quiser, posso rodar a priorização nos dois cenários para mostrar quantos municípios mudam de nível em um estado ou no Brasil.

## N10 — priorização — certo

**Juiz:** Ok. Disse os critérios (esgotamento como benefício, não alfabetizados como custo), os pesos iguais, a região Nordeste e que comparou por estado, o padrão do site. Deu 445 de 1.794 em prioridade muito alta e ofereceu comparar o Nordeste inteiro numa lista única. Não deu o número 366 da comparação única, mas a resposta esperada aceita perguntar qual a pessoa prefere. Os números batem com a ferramenta.

**Esperado:** Critérios Domicílios com esgotamento sanitário (benefício) e Pessoas não alfabetizadas (custo), pesos iguais, região Nordeste. Diz como comparou: com o padrão do site (cada estado separado) dá 445 de 1.794 com prioridade muito alta; comparando o Nordeste todo junto, 366. Diz que a comparação muda o resultado ou pergunta qual a pessoa quer.

**Pergunta:** Quero priorizar municípios do Nordeste com pouco esgotamento sanitário e muita gente não alfabetizada.

7,7 s · 2 rodadas · 62,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"},"criterios":[{"nome":"pct_rede_2022","peso":1},{"nome":"pct_naoalf_2022","peso":1}]}`

> Usei os dois critérios que você pediu, com peso igual (50% cada): **domicílios com esgotamento sanitário** (quanto menor, maior a prioridade) e **pessoas não alfabetizadas** (quanto maior, maior a prioridade). A área é o Nordeste, e os municípios foram comparados dentro de cada estado, que é o padrão do site. Os dados são da planilha da Priorização, de 2022.
>
> Todos os 1.794 municípios do Nordeste entraram na análise. Distribuição por nível:
>
> - **Muito alta:** 445
> - **Alta:** 467
> - **Média:** 380
> - **Baixa:** 308
> - **Muito baixa:** 194
>
> Entre os de prioridade muito alta, os 10 primeiros em ordem alfabética são: Abaiara–CE, Acopiara–CE, Adustina–BA, Afonso Cunha–MA, Água Doce do Maranhão–MA, Água Fria–BA, Águas Belas–PE, Aguiar–PB, Aiuaba–CE e Alagoinha do Piauí–PI. Dentro de um nível não há ordem de prioridade; a lista completa tem 445 municípios e pode ser vista por estado.
>
> Se quiser, posso comparar a região inteira numa lista única, em vez de separar por estado, ou cruzar esses níveis com algum índice do SEDES, como pobreza ou seca.

## N11 — priorização — certo

**Juiz:** ok. Explica que é o nível mais urgente, que significa situação pior que a maioria do grupo nos critérios escolhidos, e que é relativo e depende de critérios, pesos, área e comparação. Não inventa números. A oferta final de rodar a análise é opcional e não atrapalha.

**Esperado:** É o nível mais alto dos 5 da Priorização: o município está em situação pior que a maioria dos municípios do mesmo grupo de comparação nos critérios escolhidos, com os pesos dados. É relativo (ao grupo e aos critérios), não um valor absoluto; mudando critérios, pesos ou área, muda. Não precisa rodar uma análise.

**Pergunta:** O que quer dizer um município estar com prioridade muito alta?

4,6 s · 1 rodadas · 30 mil tokens de entrada

> "Prioridade muito alta" é o nível mais urgente de intervenção numa análise de Priorização do SEDES. Ele significa que o município está em situação pior que a maioria dos outros municípios do grupo comparado, considerando os critérios escolhidos.
>
> Alguns pontos ajudam a ler esse nível:
>
> - **É relativo, não absoluto.** Não mede um valor fixo de seca ou pobreza. Um município pode ser "muito alta" num grupo e não ser num outro, dependendo de quem ele é comparado.
> - **Depende da configuração.** Os critérios, os pesos, a área e o modo de comparação (por estado, por região, ou todos juntos) mudam o resultado.
> - **Não há ordem dentro do nível.** Os municípios de prioridade muito alta estão todos no mesmo grupo. O método não diz qual é "o primeiro".
> - **Os níveis não têm tamanhos iguais.** O número de municípios em cada nível depende de como os critérios se combinam.
>
> Para entender por que um município ficou nesse nível, a análise mostra, para cada critério, a "situação pior que (% do grupo)". Um valor perto de 100% puxou a prioridade para cima; perto de 0%, puxou para baixo. É uma explicação aproximada, não uma soma de notas.
>
> Se quiser, posso rodar a Priorização para um estado ou para o Brasil e mostrar quais municípios aparecem como muito alta prioridade e em quais critérios eles pesam mais.

## W01 — priorização e monitoramento — certo

**Juiz:** ok. A resposta traz 23 municípios, 13 com seca grave ou pior em setembro de 2026, 11 com 100% e Tenório (76,9%) e Juazeirinho (75,7%), e lista os 10 sem seca grave. Tudo bate com as saídas das ferramentas. Informa a configuração, a data de atualização e que a Priorização e o Monitor vêm de fontes diferentes.

**Esperado:** Priorização padrão da Paraíba: 23 municípios de prioridade muito alta. No Monitor de Secas de setembro de 2026, 13 deles têm área em seca grave ou pior: 11 com 100% da área (Assunção, Camalaú, Caraúbas, Congo, Coxixola, Junco do Seridó, Parari, Riacho de Santo Antônio, Salgadinho, Santo André, Serra Branca), Tenório (76,9%) e Juazeirinho (75,7%). Os outros 10 não têm seca grave. Diz que a Priorização usa a planilha dela e o Monitor vem do tabelão.

**Pergunta:** Dos municípios da Paraíba com prioridade muito alta na Priorização, quantos estão em seca grave ou pior no Monitor de Secas?

9,2 s · 4 rodadas · 126,3 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"SELECT p.nome, p.codigo, ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END), 1) AS seca_grave_ou_pior, ROUND(SUM(v.valor), 1) AS total FROM priorizacao p LEFT JOIN valores v ON v.territorio = p.codigo AND v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09' WHERE p.nivel = 'Muito alta' GROUP BY p.codigo, p.nome ORDER BY seca_grave_ou_pior DESC","priorizacao":"px4lw"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pb"}`

> Dos 23 municípios da Paraíba com prioridade muito alta na Priorização, **13 têm alguma área em seca grave ou pior**, e **11 deles estão com 100% da área nessa condição**.
>
> - **Priorização:** critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), comparando os municípios dentro de cada estado, cenário pessimista.
> - **Monitor de Secas (ANA), setembro de 2026:** "seca grave ou pior" soma as classes 4, 5 e 6 (seca grave, extrema e excepcional). Dado atualizado no SEDES em 19/10/2026.
> - **Os 11 com 100%:** Assunção, Camalaú, Caraúbas, Congo, Coxixola, Junco do Seridó, Parari, Riacho de Santo Antônio, Salgadinho, Santo André e Serra Branca.
> - **Os outros 2 com parte da área:** Tenório (76,9%) e Juazeirinho (75,7%).
> - **Os outros 10 sem seca grave ou pior** em setembro: Areial, Baraúna, Cubati, Curral de Cima, Ingá, Lagoa de Dentro, Montadas, Pilar, São Vicente do Seridó e Sobrado.
>
> Os níveis de prioridade vêm da planilha da Priorização, e os dados de seca, do tabelão. São fontes diferentes, e o cruzamento mostra associação, não causa.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=pb&period=2026&layers=monitor-de-seca-ana)

## W02 — priorização e monitoramento — certo

**Juiz:** ok: prioridade muito alta (grupo PB, 210 municípios, critérios padrão) e a série do Monitor de Secas de 2026 batem com as ferramentas: extrema jan-fev, grave em março, moderada abr-ago, grave em setembro (último mês). Diz a fonte dos dados e a data.

**Esperado:** Prioridade muito alta na Priorização padrão da Paraíba. No Monitor de Secas de 2026: seca extrema em 100% da área em janeiro e fevereiro, seca grave em março, seca moderada em 100% de abril a agosto, e seca grave de novo em 100% em setembro (o último mês disponível).

**Pergunta:** Assunção-PB está em que nível de prioridade? E como está a seca lá no Monitor de Secas este ano?

10,7 s · 6 rodadas · 129,7 mil tokens de entrada

1. buscar_territorio: `{"nome":"Assunção","uf":"PB"}`
1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["Assunção-PB"]}`
1. consultar_sql: `{"sql":"SELECT periodo, rotulo_classe, valor FROM valores_com_nomes WHERE indice='monitor-de-seca-ana' AND territorio='2501351' AND periodo BETWEEN '2026-01' AND '2026-09' AND classe BETWEEN 1 AND 6 ORDER BY periodo, classe;"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana","priorizacao"],"territorio":"2501351"}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"2501351"}`

> **Prioridade:** Assunção–PB (2501351) está no nível **muito alta**, o mais alto dos cinco. A comparação foi feita com os 210 municípios da Paraíba, nos critérios padrão do site com pesos iguais (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural). Nesses critérios, o município está pior que a maioria dos outros da PB, sobretudo em aridez (97,6% do grupo), seca (98,6%) e pobreza rural (82,9%). Os dados vêm da planilha da Priorização, não do tabelão.
>
> **Seca em 2026 (Monitor de Secas da ANA, janeiro a setembro):** o município ficou em seca o tempo todo, mas a intensidade mudou:
>
> - Janeiro e fevereiro: seca extrema (100% da área).
> - Março: seca grave.
> - De abril a agosto: seca moderada (100% da área).
> - Setembro: seca grave.
>
> Em nenhum mês de 2026 houve área sem seca ou só com seca fraca. Setembro é o último mês disponível no Monitor. O tabelão foi gerado em 12/11/2026, e o índice foi atualizado no site em 19/10/2026.
>
> [Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=2501351&period=2026&layers=monitor-de-seca-ana)

## W03 — priorização e monitoramento — certo

**Juiz:** ok. Os números batem com as ferramentas (91,8%, 76,8%, 37,9%, 2,2%, 0%; 33 de 34, 46 de 53, 22 de 44, 3 de 45, 0 de 6). Informa período (setembro de 2026), território, data de atualização e configuração da Priorização. Diz que é associação, não causa, e lembra que a Priorização já usa o Índice de Seca.

**Esperado:** Sim, há associação. Média da % da área em seca grave ou pior em setembro de 2026, por nível da Priorização padrão: 91,8% (muito alta, 34 municípios), 76,8% (alta), 37,9% (média), 2,2% (baixa), 0% (muito baixa). Outra medida equivalente (ex.: quantos de cada nível têm seca grave: 33 de 34, 46 de 53, 22 de 44, 3 de 45, 0 de 6) também vale. Diz que é associação, não causa, e de preferência lembra que a Priorização padrão já tem um critério de seca (Índice de Seca).

**Pergunta:** Em Pernambuco, os municípios com prioridade mais alta na Priorização são também os que estão mais em seca no Monitor de Secas?

12,3 s · 4 rodadas · 126,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PE"},"listar":["Muito alta"]}`
1. consultar_sql: `{"sql":"WITH seca AS (\n  SELECT v.territorio, SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END) AS seca_qualquer,\n         SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END) AS seca_grave_mais\n  FROM valores v\n  WHERE v.indice = 'monitor-de-seca-ana' AND v.periodo = '2026-09'\n  GROUP BY v.territorio\n)\nSELECT p.nivel AS rotulo, p.nivel_ordem AS ordem, COUNT(*) AS municipios,\n       ROU`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pe"}`

> Sim, em grande parte. Os municípios de prioridade muito alta são, em média, os mais atingidos por seca grave ou pior no Monitor de Secas.
>
> Comparei a Priorização de Pernambuco (padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, comparando cada estado separadamente) com o Monitor de Secas da ANA de setembro de 2026. Média simples por nível, em % da área do município em seca grave, extrema ou excepcional:
>
> - **Muito alta** (34 municípios): 91,8%; 33 deles têm alguma área nessas classes.
> - **Alta** (53): 76,8%; 46 com alguma área.
> - **Média** (44): 37,9%; 22 com alguma área.
> - **Baixa** (45): 2,2%; 3 com alguma área.
> - **Muito baixa** (6): 0%.
>
> Se considerarmos qualquer seca (fraca ou pior), quase todos os municípios de Pernambuco estavam em seca em setembro, inclusive os de prioridade muito baixa. Por isso, a diferença aparece no nível de gravidade, não na presença de seca.
>
> Ressalvas:
>
> - A Priorização não usa o Monitor de Secas nos critérios padrão. Ela usa o Índice de Seca (SPE), que mede algo parecido. Por isso a associação está em parte embutida na própria conta.
> - Os valores da Priorização vêm da planilha da ferramenta, e o Monitor de Secas vem do tabelão, com dados de setembro de 2026 (atualizado no SEDES em 19/10/2026). A análise é de associação, não de causa.
> - Ficaram de fora 3 municípios por falta de dado: Fernando de Noronha, Ilha de Itamaracá e Olinda.
>
> Para ver o Monitor de Secas de Pernambuco no site: https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=pe&period=2026&layers=monitor-de-seca-ana

## W04 — priorização e monitoramento — certo

**Juiz:** Ok: Equador, 33,7% da área em seca grave ou pior (setembro de 2026, atualizado em 19/10/2026) e prioridade muito alta batem com as ferramentas e com a resposta esperada. A configuração da Priorização e o nível relativo ao grupo foram explicados, e os 2 municípios excluídos foram citados corretamente.

**Esperado:** Só um: Equador, com 33,7% da área em seca grave ou pior em setembro de 2026, e prioridade muito alta na Priorização padrão do Rio Grande do Norte.

**Pergunta:** Quais municípios do Rio Grande do Norte estão com seca grave ou pior no Monitor de Secas, e qual a prioridade deles?

9,0 s · 4 rodadas · 94,2 mil tokens de entrada

1. consultar_sql: `{"sql":"SELECT t.codigo, t.nome, SUM(v.valor) AS seca_grave_ou_pior FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe >= 4 AND t.tipo='municipio' AND t.uf='RN' GROUP BY t.codigo HAVING SUM(v.valor) > 0 ORDER BY seca_grave_ou_pior DESC"}`
1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"RN"}}`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"2403400"}`

> Só um município do Rio Grande do Norte aparece com seca grave ou pior no Monitor de Secas: **Equador**, com 33,7% da área em seca grave, extrema ou excepcional (Monitor de Secas, setembro de 2026; atualizado no SEDES em 19/10/2026). Os outros municípios do estado estão sem essas classes nesse mês.
>
> Na Priorização do SEDES, Equador está no nível **muito alta** prioridade. A análise usou os padrões do site: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, com pesos iguais, comparando os municípios de cada estado separadamente. O nível é relativo aos outros municípios do Rio Grande do Norte nesses critérios. Dos 167 municípios do estado, 165 entraram na análise; Senador Georgino Avelino e Tibau do Sul ficaram de fora por falta de dado.
>
> Para ver o dado no site, use o botão "Ver no SEDES".

## W05 — priorização e monitoramento — certo

**Juiz:** ok. Os 54 de 84 com área em seca grave ou pior em setembro de 2026 batem com a ferramenta e com a resposta esperada. O dado de 48 com mais da metade da área também vem da consulta, e o período e a fonte estão corretos.

**Esperado:** Primeira resposta: Priorização padrão da Bahia, 84 municípios de prioridade muito alta (416 classificados). Segunda: dos 84, 54 têm área em seca grave ou pior no Monitor de Secas de setembro de 2026 (42 deles com 100% da área); os outros 30 não têm. Diz que é setembro de 2026, o último mês do Monitor.

**Pergunta:** Quais municípios a Bahia deveria priorizar?

8,1 s · 2 rodadas · 61,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"},"listar":["Muito alta"]}`

> Com os critérios padrão do site, **84 dos 416 municípios da Bahia** classificados ficaram como **prioridade muito alta**. Os primeiros 10 em ordem alfabética são: Abaré, Andorinha, Araci, Barrocas, Caém, Caetanos, Caldeirão Grande, Campo Formoso, Candeal e Candiba. Dentro do nível não há ordem entre eles.
>
> - **Configuração:** quatro critérios com peso igual (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Só a Bahia foi comparada, então todos os municípios entram numa mesma lista. Cenário pessimista e limiares padrão.
> - **Distribuição:** muito alta 84; alta 120; média 104; baixa 77; muito baixa 31.
> - **Fora da análise:** Madre de Deus, por falta de dado em dois critérios.
> - **Fonte:** os valores vêm da planilha da Priorização, não dos índices do tabelão. O Índice de Seca dessa planilha é o indicador SPE, diferente do Monitor de Secas.
>
> Posso cruzar esses níveis com algum índice do tabelão, como seca no Monitor de Secas ou pobreza do CadÚnico, ou repetir a análise com outros critérios.

**Pergunta:** E desses, quantos estão em seca grave ou pior no Monitor de Secas agora?

7,3 s · 3 rodadas · 99,9 mil tokens de entrada

1. consultar_sql: `{"sql":"WITH s AS (SELECT territorio, SUM(valor) AS v FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio) SELECT COUNT(*) AS total_muito_alta, SUM(CASE WHEN s.v>0 THEN 1 ELSE 0 END) AS com_alguma_area_seca_grave_ou_pior, SUM(CASE WHEN s.v>=50 THEN 1 ELSE 0 END) AS com_mais_da_metade_da_area, SUM(CASE WHEN s.v IS NULL THEN 1 ELSE 0 END) AS sem_da`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"ba"}`

> Dos 84 municípios de prioridade muito alta, **54 têm alguma área em seca grave ou pior** no Monitor de Secas da ANA, em setembro de 2026, o último mês disponível no SEDES. Em **48** deles, mais da metade da área está nessa condição.
>
> Seca grave ou pior são as classes 4 (grave), 5 (extrema) e 6 (excepcional) do Monitor de Secas, somadas. Os 84 municípios têm dado do Monitor.
>
> Os níveis de prioridade vêm da planilha da Priorização, e o Monitor de Secas vem do tabelão do SEDES (atualizado em 19/10/2026).

## W06 — priorização e monitoramento — certo

**Juiz:** ok. 59,7% nos 23 de prioridade muito alta e cerca de 57,7% nos outros 187 batem com a ferramenta (média ponderada recalculada: 10793,5/187 ≈ 57,7). Informa o ano (2025), a data de atualização, que é média simples por nível e que a Pobreza Rural da Priorização não é independente do índice do tabelão. Falta só a média do estado (57,9%), um detalhe a mais da resposta esperada.

**Esperado:** Quase a mesma: média de 59,7% das famílias do CadÚnico em pobreza (2025) nos 23 de prioridade muito alta, contra 57,7% nos outros 187 classificados (o estado tem 57,9%). Diz que é média simples dos municípios e que a Priorização usa outro dado (Pobreza Rural, da planilha da Priorização), não este índice do SEDES.

**Pergunta:** Os municípios de prioridade muito alta na Paraíba têm mais pobreza no CadÚnico do que os outros?

13,2 s · 4 rodadas · 93,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"}}`
1. consultar_sql: `{"sql":"SELECT p.nivel AS nivel, p.nivel_ordem AS ordem, COUNT(v.valor) AS municipios_com_dado, ROUND(AVG(v.valor),1) AS media_pobreza_total_pct, ROUND(MIN(v.valor),1) AS minimo, ROUND(MAX(v.valor),1) AS maximo FROM priorizacao p JOIN valores v ON v.territorio = p.codigo WHERE v.indice = 'percentual-de-pobreza-total-cadunico' AND v.periodo = '2025' AND p.nivel IS NOT NULL GROUP BY p.nivel, p.nivel`
1. link_no_sedes: `{"indices":["percentual-de-pobreza-total-cadunico"],"territorio":"pb"}`

> Um pouco, mas a diferença é pequena. Os 23 municípios de prioridade muito alta da Paraíba têm, em média, 59,7% das famílias do CadÚnico em situação de pobreza. Os 187 demais classificados ficam em torno de 57,7% (média ponderada que calculei a partir das médias por nível). São cerca de 2 pontos percentuais, e as faixas de cada nível se sobrepõem bastante.
>
> Média simples por nível de prioridade:
>
> | Nível       | Municípios | Média (%) |
> | ----------- | ---------- | --------- |
> | Muito alta  | 23         | 59,7      |
> | Alta        | 78         | 58,9      |
> | Média       | 71         | 57,5      |
> | Baixa       | 31         | 55,3      |
> | Muito baixa | 7          | 57,5      |
>
> Não há uma escada clara: o nível "Muito baixa" tem média maior que o "Baixa".
>
> - **Priorização:** análise do SEDES com critérios padrão do site, pesos iguais, cada estado comparado separadamente, cenário pessimista. Os níveis vêm da planilha da Priorização, não do tabelão. 13 municípios da Paraíba ficaram de fora por falta de dado.
> - **Pobreza:** Percentual de pobreza total do CadÚnico, 2025 (atualizado no SEDES em 06/10/2026). É % das famílias inscritas no CadÚnico, não da população toda.
> - **Ressalva:** um dos critérios da própria Priorização é a Pobreza Rural. Ela entra na classificação, então a comparação não é independente. Isso pode explicar parte da proximidade entre os níveis. É uma associação, não uma causa.
>
> Dá para ver os dados no SEDES pelo botão abaixo.

## W07 — priorização e monitoramento — certo

**Juiz:** ok. Os números batem com as ferramentas: 24 municípios com 100% da área em seca, Icó com 73,1% e Iguatu com 79,8%, 18 municípios só em seca fraca, Penaforte com 23,2% de seca grave ou pior e Salitre em seca moderada. A resposta diz que a seca é leve na maioria dos casos, como a esperada, e informa índice, mês, território, data de atualização e a configuração da Priorização. Não cita os outros municípios com parte da área em seca moderada (Assaré, Brejo Santo, Campos Sales, Tabuleiro do Norte), mas isso é um detalhe menor.

**Esperado:** Sim, mas quase toda seca fraca: no Monitor de Secas de setembro de 2026, os 27 de prioridade muito alta da Priorização padrão do Ceará têm, em média, 97,4% da área em seca fraca ou pior; só 6 têm alguma área em seca moderada ou pior (Penaforte e Salitre com 100%) e só Penaforte tem seca grave (23,2%). Não diz que estão em seca forte.

**Pergunta:** Os municípios do Ceará com prioridade muito alta estão em seca agora?

17,7 s · 4 rodadas · 94,5 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"}}`
1. consultar_sql: `{"sql":"SELECT p.nome AS municipio, p.uf,\n ROUND(SUM(CASE WHEN v.classe = 1 THEN v.valor ELSE 0 END),1) AS sem_seca,\n ROUND(SUM(CASE WHEN v.classe >= 2 THEN v.valor ELSE 0 END),1) AS seca_qualquer,\n ROUND(SUM(CASE WHEN v.classe = 2 THEN v.valor ELSE 0 END),1) AS seca_fraca,\n ROUND(SUM(CASE WHEN v.classe >= 4 THEN v.valor ELSE 0 END),1) AS seca_grave_ou_pior\nFROM priorizacao p\nLEFT JOIN valor`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"ce"}`

> **Sim, quase todos estão em seca.** Em setembro de 2026, 24 dos 27 municípios de prioridade muito alta do Ceará tinham 100% da área em algum nível de seca. Os outros três tinham entre 73,1% (Icó) e 79,8% (Iguatu).
>
> A seca é leve na maioria dos casos. Em 18 municípios, toda a área estava em seca fraca. Só Penaforte tinha seca grave ou pior, em 23,2% da área. Salitre estava com toda a área em seca moderada.
>
> - **Monitor de Secas da ANA, setembro de 2026** (dado atualizado no SEDES em 19/10/2026). O tabelão está atualizado até esse mês, mas hoje é 13/11/2026; se o site já tiver um mês mais recente, o quadro pode ter mudado.
> - **Prioridade muito alta:** vem da Priorização, com os quatro critérios padrão do site e pesos iguais (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural), comparando os municípios dentro do próprio estado. Os valores dos critérios vêm da planilha da Priorização, não do tabelão.

## W08 — priorização e monitoramento — certo

**Juiz:** ok. Bate com a resposta esperada: 50 municípios em setembro de 2026, sendo 11 de prioridade muito alta, 29 alta e 10 média. Informa o corte (99,9% ou mais), o período, a data de atualização e a configuração da Priorização (critérios padrão, comparação dentro da Paraíba, cenário pessimista).

**Esperado:** 50 municípios em setembro de 2026. Na Priorização padrão da Paraíba: 11 de prioridade muito alta, 29 alta e 10 média. Não precisa listar os 50. Também vale contar quem arredonda para 100% (Alcantil 99,5% e Catingueira 99,6%): 52, com 31 de prioridade alta, desde que diga o corte usado.

**Pergunta:** Quantos municípios da Paraíba estão com 100% da área em seca grave ou pior no Monitor de Secas, e em que nível de prioridade eles ficam?

12,7 s · 5 rodadas · 95,4 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"}}`
1. consultar_sql: `{"sql":"SELECT COUNT(*) AS municipios_100_seca_grave_ou_pior, (SELECT COUNT(DISTINCT v.territorio) FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe>=4 AND t.tipo='municipio' AND t.uf='PB') AS com_alguma_area_grave_ou_pior, (SELECT COUNT(DISTINCT t.codigo) FROM territorios t WHERE t.tipo='municipio' AND t.uf='PB') A`
1. consultar_sql: `{"sql":"WITH seca AS (SELECT v.territorio, SUM(v.valor) AS soma FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' AND v.periodo='2026-09' AND v.classe>=4 AND t.tipo='municipio' AND t.uf='PB' GROUP BY v.territorio HAVING soma>=99.9) SELECT COALESCE(p.nivel,'Fora da priorização') AS rotulo, COUNT(*) AS valor FROM seca s LEFT JOIN priorizacao p ON p.codig`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"pb"}`

> **50 dos 223 municípios da Paraíba** estão com praticamente toda a área (99,9% ou mais) em seca grave, extrema ou excepcional no Monitor de Secas, em setembro de 2026 (dado atualizado no SEDES em 19/10/2026). Esse valor é a soma das três classes mais graves, em % da área do município.
>
> Nível de prioridade desses 50 (Priorização, critérios padrão do site com pesos iguais, comparação dentro da Paraíba, cenário pessimista):
>
> - **Muito alta:** 11
> - **Alta:** 29
> - **Média:** 10
>
> Nenhum deles ficou de fora da Priorização por falta de dado. A Priorização vem de outra planilha, não do tabelão, e o nível é relativo aos outros municípios paraibanos. Se quiser, posso listar os 11 de prioridade muito alta.

## W09 — priorização e monitoramento — certo

**Juiz:** Ok. Responde "sim" com 43,3% de área em seca grave ou pior e 144 dos 298 municípios com alguma área nessas classes, usando todos os 298. Dá a média de cada nível (27,6%, 11,4%, 1,1% e 0%) em vez de uma média única dos outros, que daria 14,5%, mas a comparação fica clara. Informa a configuração da priorização, o período e a data do dado, e diz que é associação e que as fontes são diferentes, embora a frase sobre o Índice de Seca esteja um pouco truncada.

**Esperado:** Sim. Priorização padrão do Nordeste (cada estado comparado separadamente): 298 municípios de prioridade muito alta (1.773 classificados, 21 de fora). No Monitor de Secas de setembro de 2026, eles têm em média 43,3% da área em seca grave ou pior, contra 14,5% nos outros 1.475 (média simples dos municípios); 144 dos 298 têm alguma área em seca grave ou pior. Usa os 298, não uma parte da lista. Diz que é associação e que as fontes são diferentes.

**Pergunta:** No Nordeste, os municípios de prioridade muito alta estão mais em seca grave do que os outros, segundo o Monitor de Secas?

13,7 s · 5 rodadas · 98,2 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"}}`
1. consultar_sql: `{"sql":"WITH s AS (SELECT territorio, SUM(valor) AS grave FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio) SELECT p.nivel AS rotulo, ROUND(AVG(s.grave),1) AS valor FROM priorizacao p JOIN s ON s.territorio=p.codigo WHERE p.nivel IS NOT NULL GROUP BY p.nivel, p.nivel_ordem ORDER BY p.nivel_ordem DESC","priorizacao":"p75fg","grafico":{"tipo":"r`
1. consultar_sql: `{"sql":"WITH s AS (SELECT territorio, SUM(valor) AS grave FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND classe>=4 GROUP BY territorio) SELECT p.nivel, COUNT(*) AS municipios, SUM(CASE WHEN s.grave>0 THEN 1 ELSE 0 END) AS com_alguma_area_em_grave_ou_pior, SUM(CASE WHEN s.grave>=50 THEN 1 ELSE 0 END) AS com_metade_ou_mais FROM priorizacao p JOIN s ON s.territorio=p.codigo`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"2_regiao-nordeste"}`

> Sim. No Nordeste, os municípios de prioridade muito alta estavam bem mais em seca grave ou pior em setembro de 2026 (Monitor de Secas, ANA).
>
> - **Muito alta:** em média, 43,3% da área em seca grave, extrema ou excepcional. Dos 298 municípios, 144 tinham alguma área nessas classes e 131 tinham metade ou mais.
> - **Alta:** em média, 27,6% da área. Dos 536 municípios, 180 tinham alguma área nessas classes.
> - **Média:** em média, 11,4%.
> - **Baixa:** em média, 1,1%.
> - **Muito baixa:** nenhum município tinha seca grave ou pior.
>
> A priorização usou os critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Ela comparou cada estado separadamente. Esses critérios não incluem o Monitor de Secas, então a associação não vem do próprio cálculo. Ainda assim, o Índice de Seca mede outra coisa (indicador SPE, não o Monitor), e isso é uma associação, não causa.
>
> Fontes: níveis de prioridade da planilha da Priorização (1773 municípios classificados; 21 ficaram de fora por falta de dado). Seca do tabelão do SEDES, Monitor de Secas, setembro de 2026, atualizado no SEDES em 19/10/2026. Considerei seca grave, extrema e excepcional.

## W10 — priorização e monitoramento — certo

**Juiz:** ok. Os números por nível batem com a ferramenta e com a resposta esperada: 43,3%, 27,6%, 11,4%, 1,1% e 0%, com 298, 536, 549, 311 e 79 municípios. Informa o período (setembro de 2026) e a data de atualização (19/10/2026). Também diz que a priorização padrão não usa o Monitor, que o Índice de Seca (SPE) entra na conta e que é associação, não causa.

**Esperado:** Média da % da área em seca grave ou pior em setembro de 2026, por nível (cada estado comparado separadamente): muito alta 43,3% (298 municípios), alta 27,6% (536), média 11,4% (549), baixa 1,1% (311), muito baixa 0% (79). Cai de um nível para o outro. Diz que é associação, não causa, e que a Priorização padrão já tem um critério de seca (o Índice de Seca), então parte da associação é esperada.

**Pergunta:** Na priorização padrão do Nordeste, como a seca do Monitor de Secas muda de um nível de prioridade para outro?

17,7 s · 4 rodadas · 98,3 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"}}`
1. consultar_sql: `{"sql":"WITH s AS (\n  SELECT territorio,\n         SUM(CASE WHEN classe >= 4 THEN valor ELSE 0 END) AS grave_ou_pior,\n         SUM(CASE WHEN classe >= 2 THEN valor ELSE 0 END) AS alguma_seca\n  FROM valores\n  WHERE indice = 'monitor-de-seca-ana' AND periodo = '2026-09'\n  GROUP BY territorio\n)\nSELECT p.nivel, p.nivel_ordem, COUNT(*) AS municipios,\n       ROUND(AVG(s.alguma_seca), 1) AS media`
1. link_no_sedes: `{"indices":["monitor-de-seca-ana"],"territorio":"2_regiao-nordeste"}`

> Nos níveis mais altos de prioridade, a seca grave ou pior do Monitor de Secas é bem mais presente. Ela cai em cada nível até quase zerar no nível "Muito baixa".
>
> A priorização padrão do Nordeste não usa o Monitor de Secas. Os quatro critérios são Índice de Aridez, Índice de Seca (SPE), Área Degradada e Pobreza Rural, com pesos iguais, comparando cada estado separadamente. O cruzamento abaixo é feito depois, só para ver como a seca do Monitor acompanha os níveis.
>
> | Nível       | Municípios | Média da área em seca grave ou pior | Média da área em alguma seca | Com alguma área em seca grave ou pior |
> | ----------- | ---------- | ----------------------------------- | ---------------------------- | ------------------------------------- |
> | Muito alta  | 298        | 43,3%                               | 97,6%                        | 144                                   |
> | Alta        | 536        | 27,6%                               | 96,8%                        | 180                                   |
> | Média       | 549        | 11,4%                               | 95,8%                        | 84                                    |
> | Baixa       | 311        | 1,1%                                | 86,4%                        | 7                                     |
> | Muito baixa | 79         | 0%                                  | 57,0%                        | 0                                     |
>
> - **Monitor de Secas**, setembro de 2026 (último mês no SEDES; atualizado em 19/10/2026). "Seca grave ou pior" soma as classes grave, extrema e excepcional. "Alguma seca" soma seca fraca e tudo acima. Os valores são % da área de cada município, com média simples por nível.
> - **Priorização**: 1.773 municípios classificados (21 ficaram de fora por falta de dado). Dados da planilha da Priorização, não do tabelão.
> - A associação é clara, mas parte dela é esperada: o Índice de Seca (SPE) é um indicador de seca e entra na conta. Não é causa.
>
> Para ver o mapa e a série do Monitor de Secas no Nordeste, use o botão "Ver no SEDES".
