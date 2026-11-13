# Rodada prio-v2

Modelo haiku, motor claude, juiz claude-sonnet-5-5. Gerado por `npm run avaliar` em 2026-11-13T02:17.

| Medida                                  | Valor                           |
| --------------------------------------- | ------------------------------- |
| Perguntas (turnos)                      | 11 (12)                         |
| Notas do juiz                           | 10 certo · 1 parcial · 0 errado |
| Com número esperado faltando            | 0                               |
| Turnos com erro                         | 0                               |
| Tempo por turno (média · mediana · p90) | 8,6 · 8,3 · 10,7 s              |
| Rodadas do modelo por turno             | 1,8                             |
| Ferramentas por turno                   | 0,8                             |
| Turnos que chamaram listar_indices      | 0%                              |
| Tokens de entrada por turno (com cache) | 52,4 mil                        |
| Tokens de saída por turno               | 922                             |
| Custo somado (preço de API)             | US$ 0.04                        |

| Id  | Categoria   | Nota    | Tempo (s) | Rodadas | Ferramentas |
| --- | ----------- | ------- | --------- | ------- | ----------- |
| N01 | priorização | certo   | 7,7       | 2       | 1           |
| N02 | priorização | certo   | 10,7      | 2       | 1           |
| N03 | priorização | certo   | 11,8      | 2       | 1           |
| N04 | priorização | parcial | 10,5      | 2       | 1           |
| N05 | priorização | certo   | 8,6       | 2       | 1           |
| N06 | priorização | certo   | 8,0       | 1       | 0           |
| N07 | priorização | certo   | 8,3 + 5,7 | 2 + 2   | 1 + 1       |
| N08 | priorização | certo   | 7,8       | 2       | 1           |
| N09 | priorização | certo   | 7,1       | 1       | 0           |
| N10 | priorização | certo   | 9,6       | 2       | 1           |
| N11 | priorização | certo   | 7,6       | 1       | 0           |

## N04 — priorização — parcial

**Juiz:** O nível "média" e a configuração (critérios padrão, pesos iguais, comparação por estado, pessimista) estão certos. Faltou dizer que mudar critérios, pesos ou comparação muda o nível. Na explicação, a pobreza rural (62,8%, "pior que 8,6%") está certa, mas o texto "área degradada entre as piores 10%" e "aridez e seca perto do meio" é aceitável.

**Esperado:** Campina Grande–PB, com os critérios padrão do site comparando dentro da Paraíba: prioridade média. Diz a configuração usada (e que mudando os critérios o nível muda).

**Pergunta:** Qual o nível de prioridade de Campina Grande?

10,5 s · 2 rodadas · 61,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["Campina Grande-PB"]}`

> Campina Grande–PB está no nível **média** de prioridade de intervenção, entre os 210 municípios paraibanos.
>
> Usei os critérios padrão do site, com pesos iguais: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. A comparação foi feita dentro de cada estado, no cenário pessimista. Os valores vêm da planilha da Priorização, não do tabelão.
>
> Pelos critérios, a área degradada de Campina Grande (43,2 km²) está entre as piores 10% do grupo, o que puxa a prioridade para cima. Já a pobreza rural (62,8%) está entre as menores do grupo, o que puxa para baixo. Aridez e seca ficam perto do meio.
>
> Se quiser, posso refazer a análise com outros critérios ou pesos, ou comparar Campina Grande com todos os municípios do Brasil juntos.

## N01 — priorização — certo

**Juiz:** Ok. Usa a Priorização com os critérios padrão (pesos iguais de 25%), Paraíba, cenário pessimista e limiares padrão. Os números batem com a ferramenta: 210 classificados, 13 de fora (cita João Pessoa e Cabedelo), 23 de prioridade muito alta listados em ordem alfabética, e a distribuição está correta. Não ordena dentro do nível e explica que o nível é relativo.

**Esperado:** Usa a Priorização com os critérios padrão do site (Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, pesos iguais), Paraíba, cenário pessimista, e diz essa configuração. 210 municípios classificados; 13 ficaram de fora por falta de dado (entre eles João Pessoa). 23 com prioridade muito alta (ex.: Assunção, Juazeirinho, Salgadinho, Tenório, Serra Branca, São Vicente do Seridó, Junco do Seridó...). Não ordena municípios dentro do nível.

**Pergunta:** Quais municípios da Paraíba deveriam ser priorizados para ações contra a seca e a desertificação?

7,7 s · 2 rodadas · 58,8 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"PB"}}`

> Pela Priorização do SEDES, **23 municípios da Paraíba estão no nível de prioridade muito alta**:
>
> Areial, Assunção, Baraúna, Camalaú, Caraúbas, Congo, Coxixola, Cubati, Curral de Cima, Ingá, Juazeirinho, Junco do Seridó, Lagoa de Dentro, Montadas, Parari, Pilar, Riacho de Santo Antônio, Salgadinho, Santo André, São Vicente do Seridó, Serra Branca, Sobrado e Tenório.
>
> **Configuração:** quatro critérios com peso igual (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Os municípios foram comparados entre si só dentro da Paraíba, com o cenário pessimista e os limiares padrão do site.
>
> **Distribuição dos 210 municípios classificados:** 23 muito alta, 78 alta, 71 média, 31 baixa e 7 muito baixa. Ficaram de fora 13 municípios por falta de dado, sobretudo no Índice de Seca (entre eles João Pessoa e Cabedelo).
>
> O nível é relativo aos outros municípios paraibanos nesses critérios, não um valor absoluto. Os dados vêm da planilha da Priorização, não do tabelão de índices. Se quiser, posso refazer a análise com outros critérios ou pesos, ou comparar todos os municípios do Semiárido juntos.

## N02 — priorização — certo

**Juiz:** ok. Critérios, pesos (66,7% e 33,3%), área e comparação conjunta batem com a ferramenta. Os 1.477 municípios e a distribuição 280/831/138/135/93 estão corretos. A resposta diz que nenhum município ficou de fora, cita 10 dos 280 e explica que o dado vem da planilha da Priorização.

**Esperado:** Critérios Pobreza Rural (67%) e Seca Registrada (33%), Semiárido, todos comparados juntos. 1.477 municípios classificados, nenhum de fora. Prioridade muito alta: 280; alta: 831; média: 138; baixa: 135; muito baixa: 93. Cita alguns dos 280 e diz que são 280, sem listar todos nem ordenar.

**Pergunta:** Faz uma priorização do Semiárido combinando pobreza rural e seca registrada, com a pobreza pesando o dobro. Quero uma lista única do Semiárido todo, não separada por estado.

10,7 s · 2 rodadas · 60,3 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"semiarido"},"comparar_dentro_de":"area","criterios":[{"nome":"pobreza_rural_2021","peso":2},{"nome":"seca_grave_6_meses","peso":1}]}`

> Com pobreza rural pesando o dobro da seca registrada, 280 dos 1.477 municípios do Semiárido ficaram com prioridade muito alta, em uma lista única.
>
> **Configuração:**
>
> - Critérios: Pobreza Rural (peso 2, cerca de 66,7%) e Seca Registrada (peso 1, cerca de 33,3%). Os dois são de "custo": valor maior significa situação pior.
> - Área: Semiárido, com todos os municípios comparados juntos.
> - Cenário pessimista e limiares padrão do site.
> - Nenhum município ficou de fora por falta de dado.
>
> **Distribuição por nível:** muito alta 280, alta 831, média 138, baixa 135, muito baixa 93.
>
> **Prioridade muito alta (10 de 280, em ordem alfabética):** Abaré–BA, Acarape–CE, Acaraú–CE, Afonso Bezerra–RN, Alagoinha do Piauí–PI, Alagoinha–PE, Algodão de Jandaíra–PB, Alto do Rodrigues–RN, Alto Longá–PI e Amarante–PI.
>
> Os dados são da planilha de Priorização do SEDES, não do tabelão. O nível é relativo a este grupo do Semiárido, nos dois critérios usados. "Pobreza rural" é a versão 2021 do critério da planilha, e "Seca registrada" é o percentual de seca grave ou pior nos últimos 6 meses (fev a jul de 2026) no Monitor de Secas da ANA.
>
> Posso rodar a mesma priorização separada por estado, ou trocar os pesos.

## N03 — priorização — certo

**Juiz:** ok. Os quatro números e percentuais (0,242/97,6%; 29,6/98,6%; 81,3/82,9%; 12,4/58,6%) batem com a ferramenta. Explica que o nível é relativo ao grupo, que o grupo é a PB, e dá a configuração. Não atribui a causa a um critério só.

**Esperado:** Com os critérios padrão do site, comparando dentro da Paraíba: Assunção está em situação pior que 97,6% dos municípios da PB no Índice de Aridez (0,242), 98,6% no Índice de Seca (29,6%), 82,9% na Pobreza Rural e 58,6% na Área Degradada. Diz que o nível é relativo aos municípios da Paraíba e aos critérios escolhidos, e não atribui causa a um critério só.

**Pergunta:** Por que Assunção, na Paraíba, aparece com prioridade muito alta na priorização?

11,8 s · 2 rodadas · 61,1 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["Assunção-PB"]}`

> Assunção–PB está em **prioridade muito alta** porque ficou entre as situações mais difíceis dos 210 municípios paraibanos nos critérios usados. Os números são da Priorização do SEDES (planilha da própria Priorização, não o tabelão).
>
> **Configuração usada:** os quatro critérios padrão do site, com pesos iguais (25% cada), área Brasil, comparação dentro de cada estado e cenário pessimista.
>
> **Por que pesou para cima:**
>
> - **Índice de Seca (29,6%):** pior que 98,6% dos municípios paraibanos.
> - **Índice de Aridez (0,242):** pior que 97,6% do grupo. Aqui, valor menor significa mais seco, então o município fica entre os mais áridos da Paraíba.
> - **Pobreza Rural (81,3):** pior que 82,9% do grupo.
> - **Área Degradada (12,4 km²):** pior que 58,6% do grupo. Foi o critério menos desfavorável.
>
> O nível é relativo: "muito alta" significa que a situação é pior que a da maioria dos municípios do grupo nesses critérios, não um valor absoluto. Se você usou outros critérios ou pesos, o resultado pode ser diferente. Me diga e eu refaço a conta.

## N05 — priorização — certo

**Juiz:** ok: diz que João Pessoa ficou de fora por falta de dado de Índice de Seca e não inventa nível. Configuração e totais (116 excluídos, 106 por Índice de Seca) batem com a ferramenta, e avisa que os dados vêm da planilha da Priorização.

**Esperado:** João Pessoa fica de fora da Priorização padrão por não ter valor no Índice de Seca na planilha da Priorização. Não inventa um nível.

**Pergunta:** E João Pessoa, qual a prioridade dela na priorização padrão?

8,6 s · 2 rodadas · 60,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"brasil"},"municipios":["João Pessoa-PB"]}`

> **João Pessoa–PB não recebeu nível de prioridade** na Priorização padrão. Ela ficou de fora porque não tem dado de Índice de Seca na planilha da Priorização.
>
> A configuração padrão do site usa quatro critérios com peso igual (25% cada): Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. A comparação é feita dentro de cada estado, no cenário pessimista. Ao todo, 116 municípios do Brasil ficaram de fora por falta de dado, e 106 deles foram excluídos por causa do Índice de Seca.
>
> Esses valores vêm da planilha da Priorização, não do tabelão. Se quiser, posso ver quais critérios de João Pessoa estão disponíveis e rodar a análise sem o Índice de Seca.

## N06 — priorização — certo

**Juiz:** ok. Diz que a Priorização não tem critério de desmatamento, lista os critérios reais, aponta Área Degradada como o mais próximo e oferece rodar com ele sem fingir que é desmatamento. A menção ao PRODES (2000 a 2024) bate com o catálogo.

**Esperado:** Não: a Priorização não tem um critério de desmatamento. Mostra os critérios mais próximos que existem (ex.: Área Degradada) e oferece rodar com eles. Não roda uma análise fingindo que é desmatamento.

**Pergunta:** Dá para fazer a priorização usando desmatamento como critério?

8,0 s · 1 rodadas · 28,9 mil tokens de entrada

> Não. A Priorização não tem critério de desmatamento. Os critérios disponíveis são: Índice de Aridez, Índice de Seca, Área Degradada, Pobreza Rural, Índice de Progresso Social, Índice de Vulnerabilidade Climática, Seca Registrada, Anomalia de Precipitação, Mulheres Produtoras, Produtores em Cooperativas, População Indígena, Pessoas não alfabetizadas, Domicílios com esgotamento sanitário e Cisternas (consumo, produção e escolar).
>
> Os critérios mais próximos do desmatamento são:
>
> - **Área Degradada (km²)**: área municipal em degradação nos níveis 4 e 5. Não é desmatamento, mas é o indicador de degradação da terra mais parecido.
> - **Índice de Vulnerabilidade Climática**: risco de os habitantes serem afetados por eventos climáticos em 2024 (estimativa do Instituto Votorantim).
>
> O SEDES tem dados de desmatamento no índice PRODES (INPE), com dados anuais de 2000 a 2024. Posso mostrar um ranking de municípios por desmatamento com uma consulta, mas ele não entra na Priorização. Se quiser, também posso fazer a Priorização com Área Degradada e Vulnerabilidade Climática, ou com outros critérios que você escolher.

## N07 — priorização — certo

**Juiz:** ok. A pergunta 2 refez a análise no Ceará com peso 2 para a pobreza rural (40% contra 20% dos outros) e disse o peso usado. O resultado de 33 municípios e a comparação com os 27 da primeira rodada batem com as ferramentas: 24 ficam, 9 entram e 3 saem (27−3+9=33). O peso diferente do exemplo esperado (3 contra 1) explica o número diferente, e a resposta esperada aceita isso.

**Esperado:** Roda de novo no Ceará com Pobreza Rural com peso maior que os outros (ex.: 3 contra 1, que dá 31 municípios de prioridade muito alta; com outro peso o número muda) e diz o peso que usou. Na primeira resposta, padrão: 27 de 184 com prioridade muito alta. Diz que a lista mudou (ex.: entram Acaraú, Itapipoca, Trairi; saem Banabuiú, Iguatu) só se tiver os dois resultados.

**Pergunta:** Quais municípios do Ceará têm prioridade muito alta na priorização padrão?

8,3 s · 2 rodadas · 58,7 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"}}`

> Na Priorização padrão do site, 27 dos 184 municípios do Ceará estão no nível **muito alta**. Os critérios foram Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural, todos com peso igual, comparando os municípios dentro do próprio estado, no cenário pessimista. Nenhum município ficou de fora por falta de dado.
>
> Mostro 10 dos 27, em ordem alfabética (dentro do nível não há ordem de prioridade): Aiuaba, Antonina do Norte, Assaré, Baixio, Banabuiú, Brejo Santo, Campos Sales, Icó, Iguatu e Independência.
>
> A distribuição completa foi: muito alta 27, alta 63, média 62, baixa 23 e muito baixa 9.
>
> Os dados são da planilha da Priorização, não do tabelão, e o nível é relativo aos outros municípios cearenses. Se quiser a lista completa, posso mostrar os 17 restantes.

**Pergunta:** E se a pobreza rural pesar mais que os outros critérios?

5,7 s · 2 rodadas · 61,9 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"CE"},"criterios":[{"nome":"ia_mean","peso":1},{"nome":"spe_mean_per","peso":1},{"nome":"area_deg54_mun","peso":1},{"nome":"pobreza_rural_2021","peso":2}]}`

> Com a pobreza rural pesando o dobro (40% do total, contra 20% para cada um dos outros três critérios), o número de municípios em prioridade muito alta sobe de 27 para 33. Continuam 24 dos anteriores; 9 entram e 3 saem.
>
> - **Entram:** Acaraú, Caridade, Irauçuba, Itarema, Martinópole, Pacatuba, Trairi, Umirim e Uruburetama.
> - **Saem:** Antonina do Norte, Banabuiú e São João do Jaguaribe.
>
> A distribuição completa ficou: muito alta 33, alta 67, média 61, baixa 15 e muito baixa 8. Nenhum município ficou de fora por falta de dado.
>
> Os dados são da planilha da Priorização, o nível é relativo aos outros municípios do Ceará, e a comparação foi feita dentro do estado. Se quiser, posso mostrar a lista completa dos 33.

## N08 — priorização — certo

**Juiz:** ok: diz que 1 município (Madre de Deus) fica de fora, 416 de 417 classificados, por falta de dado em Índice de Aridez e Área Degradada, e esclarece que os dados vêm da planilha da Priorização. Bate com a ferramenta e com a resposta esperada.

**Esperado:** 1 de 417: Madre de Deus, sem valor no Índice de Aridez e na Área Degradada na planilha da Priorização. Os outros 416 são classificados.

**Pergunta:** Na priorização padrão da Bahia, quantos municípios ficam de fora e por quê?

7,8 s · 2 rodadas · 59 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"estado","valor":"BA"}}`

> Na priorização padrão da Bahia, **1 município fica de fora: Madre de Deus**. Os outros 416 dos 417 foram classificados.
>
> Ele ficou fora por falta de dado em dois dos quatro critérios: Índice de Aridez e Área Degradada. A priorização usa esses critérios, com pesos iguais de 25% cada: Índice de Aridez, Índice de Seca, Área Degradada e Pobreza Rural. Cada estado foi comparado separadamente, no cenário pessimista e com os limiares padrão do site. Os valores vêm da planilha da Priorização, não do tabelão.

## N09 — priorização — certo

**Juiz:** ok. Explica corretamente que os cenários só divergem para municípios na fronteira entre duas classes, que o pessimista (padrão) usa a classe de maior prioridade e o otimista a de menor, em linha com os textos do site. Não mostra o exemplo da Paraíba, mas ele era opcional ("se rodar as duas").

**Esperado:** Com os textos do site: os dois só divergem quando um município está na fronteira entre dois níveis; o pessimista (padrão do site) põe o município no nível de maior prioridade, o otimista no de menor. Pode mostrar o efeito na Paraíba com os critérios padrão (muito alta: 23 no pessimista, 4 no otimista), se rodar as duas.

**Pergunta:** Qual a diferença entre o cenário otimista e o pessimista na priorização?

7,1 s · 1 rodadas · 28,9 mil tokens de entrada

> No cenário **pessimista**, um município que fica na fronteira entre duas classes de prioridade entra na **mais alta** delas. No **otimista**, entra na **mais baixa**.
>
> Os dois cenários só divergem nesses casos de fronteira. Municípios que não estão entre duas classes recebem o mesmo nível nos dois. O pessimista é o padrão do site, por ser mais cauteloso: evita subestimar a prioridade de um território. O otimista reserva as classes mais altas para os territórios em que a prioridade não deixa dúvida.
>
> Se quiser, posso rodar a priorização nos dois cenários para ver quantos municípios mudam de nível.

## N10 — priorização — certo

**Juiz:** Ok. Informa os critérios (benefício e custo), pesos iguais de 50%, região Nordeste e 445 de 1.794 em prioridade muito alta, que batem com a ferramenta. Explica que a comparação é por estado (padrão do site), que o nível é relativo ao estado e que dá para comparar o Nordeste todo. Não cita o 366 da comparação conjunta, mas oferece a alternativa, o que cumpre o essencial.

**Esperado:** Critérios Domicílios com esgotamento sanitário (benefício) e Pessoas não alfabetizadas (custo), pesos iguais, região Nordeste. Diz como comparou: com o padrão do site (cada estado separado) dá 445 de 1.794 com prioridade muito alta; comparando o Nordeste todo junto, 366. Diz que a comparação muda o resultado ou pergunta qual a pessoa quer.

**Pergunta:** Quero priorizar municípios do Nordeste com pouco esgotamento sanitário e muita gente não alfabetizada.

9,6 s · 2 rodadas · 60,6 mil tokens de entrada

1. priorizar_municipios: `{"area":{"tipo":"regiao","valor":"Nordeste"},"criterios":[{"nome":"pct_rede_2022","peso":1},{"nome":"pct_naoalf_2022","peso":1}]}`

> Com os dois critérios de peso igual (50% cada), o SEDES classificou os **1.794 municípios do Nordeste** (nenhum ficou de fora por falta de dado). Destes, **445 estão em prioridade muito alta**, 467 em alta, 380 em média, 308 em baixa e 194 em muito baixa.
>
> - **Critérios:** domicílios com esgotamento sanitário por rede geral ou pluvial (2022), em que quanto maior, menor a prioridade; e pessoas não alfabetizadas (2022), em que quanto maior, maior a prioridade.
> - **Comparação:** cada estado separado, que é o padrão do site. Assim, o nível é relativo aos municípios do mesmo estado. Posso comparar o Nordeste todo numa lista única, se preferir.
> - **Cenário:** pessimista (padrão do site).
>
> Os dados vêm da planilha da Priorização, não do tabelão, e podem diferir dos índices do tabelão.
>
> Dos 445 de prioridade muito alta, os 10 primeiros em ordem alfabética (não por prioridade) são: Abaiara–CE, Acopiara–CE, Adustina–BA, Afonso Cunha–MA, Água Doce do Maranhão–MA, Água Fria–BA, Águas Belas–PE, Aguiar–PB, Aiuaba–CE e Alagoinha do Piauí–PI. Posso listar os demais por estado.

## N11 — priorização — certo

**Juiz:** Ok: explica que é o nível mais alto de 5, relativo ao grupo de comparação e aos critérios escolhidos, e que mudar critérios, pesos ou área muda o resultado. Os pontos extras (sem ordem dentro do nível, níveis desiguais, cenário pessimista) batem com o texto do site. A oferta final de rodar a análise é opcional e não atrapalha.

**Esperado:** É o nível mais alto dos 5 da Priorização: o município está em situação pior que a maioria dos municípios do mesmo grupo de comparação nos critérios escolhidos, com os pesos dados. É relativo (ao grupo e aos critérios), não um valor absoluto; mudando critérios, pesos ou área, muda. Não precisa rodar uma análise.

**Pergunta:** O que quer dizer um município estar com prioridade muito alta?

7,6 s · 1 rodadas · 28,9 mil tokens de entrada

> "Prioridade muito alta" é o nível mais urgente de intervenção numa escala de cinco (muito alta, alta, média, baixa e muito baixa). Na Priorização do SEDES, um município nesse nível está, de forma geral, em situação pior que a maioria dos municípios com os quais ele é comparado, considerando os critérios escolhidos.
>
> Alguns pontos ajudam a ler esse resultado:
>
> - **É relativo.** Não mede um valor absoluto de seca ou pobreza. Por padrão, os municípios são comparados dentro de cada estado, então um município de prioridade muito alta em um estado pode ter condições melhores que um município de prioridade média em outro.
> - **Depende da configuração.** Os critérios, os pesos, a área e a forma de comparação mudam o resultado. Por isso, é preciso informar a configuração usada ao apresentar um nível.
> - **Não há ordem dentro do nível.** Dois municípios de prioridade muito alta não têm um "primeiro" definido.
> - **Os níveis não têm tamanhos iguais.** Eles dependem de como os critérios se combinam.
> - **No cenário pessimista (o padrão do site),** um município na fronteira entre dois níveis vai para o de maior prioridade.
>
> Se quiser, posso rodar a Priorização para um estado ou para o Semiárido e mostrar quais municípios ficaram nesse nível.
