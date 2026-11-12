# Avaliação do protótipo: Haiku 5.5 × Sonnet 5.5

Rodado em 12/11/2026 com `./avaliar.sh`, 35 perguntas de `perguntas.md`, cada
uma numa sessão `claude -p` isolada, só com as 4 ferramentas do SEDES. Cada
resposta foi comparada com a resposta esperada e, quando trazia um número que
não estava na resposta esperada, conferida no tabelão.

- **Certa:** todos os números e a conclusão batem, com a fonte e a data dos dados.
- **Parcial:** a resposta principal está certa, mas há um detalhe errado.
- **Errada:** número inventado, conclusão errada ou resposta faltando.

## Resultado por categoria

| Categoria           | Perguntas | Haiku, rodada 1 | Sonnet, rodada 1 | Haiku, rodada 2 | Sonnet, rodada 2 |
| ------------------- | --------- | --------------- | ---------------- | --------------- | ---------------- |
| Conceitual          | 4         | 4               | 4                | 4               | 4                |
| Valor pontual       | 6         | 5 + 1 parcial   | 6                | 6               | 6                |
| Ranking             | 5         | 5               | 5                | 5               | 5                |
| Tendência           | 4         | 4               | 4                | 4               | 4                |
| Cruzamento          | 3         | 3               | 2 + 1 parcial    | 3               | 3                |
| Recorte agregado    | 4         | 3 + 1 parcial   | 4                | 4               | 4                |
| Homônimo            | 3         | 3               | 3                | 3               | 3                |
| Período inexistente | 3         | 3               | 3                | 3               | 3                |
| Fora do escopo      | 3         | 3               | 3                | 3               | 3                |
| **Total certas**    | **35**    | **33**          | **34**           | **35**          | **35**           |

Nenhuma resposta errada nas duas rodadas. A rodada 2 repetiu só as perguntas
afetadas pelas correções (P01, A01, X02, T02, A03); as demais são da rodada 1.

Tempo por pergunta (rodada 1): Haiku média 7,8 s (mediana 6,9 s, máximo
18,4 s); Sonnet média 7,6 s (mediana 7,3 s, máximo 12,3 s). Os dois fazem ~2,4
chamadas de ferramenta por pergunta e usaram o relatório do site em 5 e 6
perguntas, todas em que o tabelão não tinha o dado (PIB, Semiárido, ano
faltando, recorte de região, fora do escopo).

## Erros da rodada 1 e causa

| Pergunta | Modelo | O que aconteceu                                                                                                        | Causa provável                                                                                                         | Correção                                                                                   |
| -------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| P01      | Haiku  | Número certo, mas escreveu "conferi esse valor com o relatório atual do site, e ele bate" sem ter chamado o relatório. | Descrição confusa: a observação do índice dizia "Conferido: bate com o site", e o modelo tomou a conferência como sua. | Observação reescrita ("na conferência da equipe, 12/11/2026") e regra no prompt.           |
| A01      | Haiku  | Números de abril certos; comentário extra dizia que a seca extrema "caiu para zero em fevereiro" (foi 9,3%).           | Leitura errada do resultado, num comentário que ninguém pediu.                                                         | Prompt: responder o que foi perguntado e só oferecer o resto.                              |
| X02      | Sonnet | Ranking certo; contou 2.272 municípios em vez de 2.268.                                                                | SQL errado: a contagem não filtrou `tipo = 'municipio'` e somou 4 estados.                                             | Esquema da ferramenta: `valores` mistura municípios, estados e recortes; filtre pelo tipo. |

## O que sobrou

- O Haiku ainda acrescenta detalhes não pedidos (em A03 trouxe Nordeste,
  Pernambuco e Paraíba). Os números conferem, mas deixam a resposta mais
  longa e abrem espaço para erro de leitura. O Sonnet segue melhor a regra.
- Nenhum dos dois buscou o dado mais recente do site sem que fosse pedido
  (em I02 os dois ofereceram, em vez de buscar). Isso é coerente com o prompt,
  que manda usar o tabelão primeiro.
- Os dois avisam quando o índice foi recalculado no site (S2iD, CDI, cobertura)
  porque a observação está no catálogo. Mas nenhum mostrou o número atual do
  site em P03, em que o site diz 1 registro e o tabelão diz 2.

## Leitura

Com as ferramentas certas, os dois modelos acertam as 35 perguntas, e as
falhas da rodada 1 vieram de descrições e do prompt, não do modelo. O Haiku é
tão rápido quanto o Sonnet aqui (o tempo é dominado pelas idas e vindas de
ferramentas) e um pouco mais propenso a comentar além do pedido. Para a
demonstração, o Sonnet é a escolha mais segura; o Haiku é suficiente se o
custo pesar na fase 4.

Esta lista é pequena e foi escrita junto com as ferramentas, então mede bem o
que foi pensado e mal o que não foi. A próxima rodada deve usar perguntas
escritas pela equipe.
