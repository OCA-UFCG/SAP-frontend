# Perguntas para mostrar o chat do SEDES

"Como está a seca na Paraíba?" funciona, e é o que todo mundo espera de um
chat. As perguntas abaixo mostram o que ele faz além disso: junta os módulos
do site (Monitoramento, Priorização e previsões), refaz uma análise no meio da
conversa, calcula relações entre índices, responde em outras línguas e
reconhece quando não dá para responder.

Cada pergunta aqui é também um teste automático. O código entre colchetes
(ex.: [W01]) é o da pergunta em `perguntas.md`, onde está a resposta certa,
calculada à mão no tabelão ou no backend da Priorização. O resultado dos
testes está no fim.

## Juntar a Priorização com a seca de agora

O chat roda a Priorização (a mesma análise da aba do site) e cruza o resultado
com o Monitor de Secas numa consulta só, para um estado ou para o Nordeste
inteiro.

- Dos municípios da Paraíba com prioridade muito alta, quantos estão em seca
  grave ou pior no Monitor de Secas? [W01]
- No Nordeste, os municípios de prioridade muito alta estão mais em seca grave
  do que os outros? [W09]
- Na priorização padrão do Nordeste, como a seca muda de um nível de
  prioridade para outro? [W10] (responde com um gráfico por nível)
- Os municípios de prioridade muito alta na Paraíba têm mais pobreza no
  CadÚnico do que os outros? [W06]

## Previsão de chuva e temperatura

O SEDES tem previsões do CPTEC e do INMET para os próximos meses. O chat diz
que é previsão, não certeza, e avisa quando as duas fontes discordam, o que
acontece muito.

- Os municípios da Paraíba que estão em seca grave ou pior vão ter chuva
  abaixo do normal em dezembro? [B01] (o INMET diz que sim para 79 de 80, o
  CPTEC para nenhum; o chat precisa dizer isso)
- Dos municípios de prioridade muito alta no Ceará, quantos têm previsão de
  chuva abaixo do normal para o trimestre de dezembro a fevereiro? [B02]
- Vai chover em Petrolina em dezembro? [B03]
- A seca na Paraíba vai melhorar nos próximos meses? [B08] (não promete nada:
  diz o que a previsão indica e que é incerta)
- No Semiárido, em quantos municípios com seca grave as previsões do CPTEC e
  do INMET concordam que dezembro vai ter chuva abaixo do normal? [B06]

## Mudar a Priorização no meio da conversa

Como no site, mas falando: muda peso, tira critério, muda a comparação, e o
chat compara com o resultado anterior.

- "Rode a priorização padrão da Paraíba." → "E se a pobreza rural pesar o
  dobro dos outros critérios?" [J01]
- "Qual o nível de prioridade de Assunção (PB)?" → "Por que ela ficou nesse
  nível?" [J02] (mostra a posição dela em cada critério)
- "Faça a priorização padrão do Ceará." → "E se o Ceará fosse comparado com o
  Nordeste inteiro?" [J03] (cai de 27 para 6 municípios de prioridade muito
  alta)
- "Quais municípios do RN têm prioridade muito alta?" → "Tire o critério de
  área degradada e refaça." [J04]
- "Priorize a Paraíba usando só pobreza rural e seca registrada." → "Quantos
  desses estão em seca grave agora?" [J05]

## Panorama: perguntas abertas

Do jeito que a gente pergunta na prática. Não há uma única resposta certa: o
chat escolhe poucos dados que importam e diz de onde vem cada um.

- Diga me coisas importantes da bahia utilizando a ferramenta de análise
  multicriterial (prioridade) [Y01] (pergunta real da equipe, escrita assim
  mesmo)
- Me dá um panorama da seca no Nordeste: como está agora, onde é mais
  prioritário e o que a previsão indica para dezembro. [Y02]
- Sou secretário de agricultura de Patos, na Paraíba. O que eu deveria saber
  sobre o meu município no SEDES? [Y03]
- Quais estados do Nordeste estão em pior situação de seca agora, e o que a
  previsão de chuva indica para eles? [Y04]
- Me dá um resumo da situação de Juazeiro na Bahia. [E06]

## Relação entre índices

O chat calcula a correlação entre dois índices (ao longo do tempo num
município, ou entre municípios), diz o que entrou na conta e lembra que
associação não é causa.

- Em Campina Grande, a seca do Monitor de Secas e o CDI andam juntos? [O01]
- No Semiárido, os municípios com mais pobreza são os que têm mais área em
  seca grave? [O02] (relação fraca)
- A aridez tem relação com a pobreza nos municípios do Nordeste? [O03] (quase
  nenhuma, e um resultado que surpreende: levemente negativa)

## Em inglês e em espanhol

O site tem as três línguas, e o chat responde na língua da pergunta.

- How is the drought in Campina Grande right now? [U01]
- ¿Cuáles son los 5 municipios de Paraíba con mayor pobreza en 2025? [U02]
- Which municipalities in Ceará have very high priority for intervention?
  [U03]
- ¿Va a llover más de lo normal en Fortaleza en diciembre? [U04]

## Armadilhas que o chat sabe evitar

- Nome repetido: "Como está a seca em Santa Luzia?" [H01] (há quatro; ele
  pergunta qual)
- Período que não existe: "Como estava o Monitor de Secas em Patos em
  dezembro de 2026?" [I02]
- Dado que o SEDES não tem: "Qual a população de Campina Grande?" [D04]
- Sentido das classes: "No Índice de Degradação da Terra, o Nível 5 é melhor
  ou pior que o Nível 1?" [K02] (o catálogo não diz, e o chat não inventa)
- Escrita informal: "qual cidade da pb ta pior de seca" [L02]
- Fora do papel: "Em quem devo votar para governador da Paraíba,
  considerando a seca no estado?" [G03]

## Como os testes funcionam

São 125 perguntas, cada uma com a resposta certa calculada à mão (no tabelão,
a cópia dos dados do site, ou no backend da Priorização). Um comando roda
todas pelo mesmo chat que a equipe usa. Para cada resposta, confere sozinho
os números que têm de aparecer, e outro modelo (o juiz) compara com a
resposta certa e dá a nota: certo, parcial ou errado, com o motivo.

Última rodada completa (13/11/2026, modelo Haiku): 102 certas, 23 parciais e
nenhuma errada. Metade das respostas sai em até 6 s.

| Tipo de pergunta                                    | Perguntas | Certas | Parciais |
| --------------------------------------------------- | --------- | ------ | -------- |
| Priorização com a seca de agora (W)                 | 10        | 8      | 2        |
| Previsões (B)                                       | 8         | 7      | 1        |
| Mudar a Priorização no meio da conversa (J)         | 5         | 3      | 2        |
| Panorama (Y)                                        | 4         | 3      | 1        |
| Relação entre índices (O)                           | 3         | 2      | 1        |
| Inglês e espanhol (U)                               | 4         | 2      | 2        |
| Básicas, armadilhas e Priorização sozinha (o resto) | 91        | 77     | 14       |

"Parcial" quase sempre quer dizer: os números estão certos, mas faltou um
detalhe da resposta esperada ou uma frase ficou imprecisa (ex.: dizer que um
critério "foi o mais forte" na Priorização, o que o método não permite
afirmar).

O que ainda falha às vezes: em espanhol, uma pergunta de previsão pode sair
em português; ao explicar o nível de um município na Priorização, o chat às
vezes diz que um critério pesou mais que outro.

Para rodar (na pasta `tools/sedes-chatbot`): `npm run avaliar` roda todas;
`npm run avaliar -- --categoria B,J` só alguns tipos. As conversas reais da
página viram perguntas novas com `npm run candidatas`.
