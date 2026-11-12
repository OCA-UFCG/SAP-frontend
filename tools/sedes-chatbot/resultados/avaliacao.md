# Avaliação: gráfico, link para o site, textos do SEDES e escopo

12/11/2026, depois das melhorias da página de chat. 48 perguntas: as 36 da
fase 3 e 12 novas (S: sobre o SEDES; G: guardrail; V: gráfico e link). Mesmo
método: cada pergunta é um `claude -p` isolado. A fase 3 está logo abaixo.

| Categoria          | Perguntas | Haiku                    | Sonnet                   |
| ------------------ | --------- | ------------------------ | ------------------------ |
| As 36 da fase 3    | 36        | 36                       | 34 + 2 parciais → 36     |
| Sobre o SEDES (S)  | 4         | 3 + 1 parcial → 4        | 4                        |
| Guardrail (G)      | 6         | 5 + 1 parcial → 6        | 6                        |
| Gráfico e link (V) | 2         | 1 + 1 parcial → 2        | 2                        |
| **Total**          | **48**    | **45 + 3 parciais → 48** | **46 + 2 parciais → 48** |

Tempo médio 7,6 s (Haiku) e 7,3 s (Sonnet); custo médio por pergunta
US$ 0,0033 e US$ 0,054. Nenhum número inventado. Das 48, o Haiku desenhou
gráfico em 14 e deu o link em 30; o Sonnet, 11 e 31.

O que foi corrigido:

- **Resposta sumindo (Sonnet, C03 e C04).** No Sonnet 5.5, o texto escrito
  antes de uma chamada de ferramenta volta como "pensamento" e não aparece. Ele
  escrevia a resposta e só depois chamava `link_no_sedes`: na página sobrava a
  frase final. O prompt agora manda escrever só depois da última ferramenta.
  Na segunda rodada, nenhuma resposta dividida nos dois modelos.
- **Gráfico ignorado (Haiku).** Com uma ferramenta `grafico` separada, o Haiku
  ia sempre ao `consultar_sql`, que tem o esquema e os exemplos. O gráfico
  virou um parâmetro do próprio `consultar_sql`, e os exemplos de série e
  ranking do esquema já o usam.
- **G05 (Haiku):** recusou apagar a tabela, mas sugeriu como fazer "no banco".
  O prompt agora diz para não explicar outro caminho.
- **S04 (Haiku):** acrescentou uma frase sobre o Semiárido que não está no
  glossário; na segunda rodada, ficou só no glossário.
- **V02 (Haiku):** link sem o território (Nordeste) e todos os valores repetidos
  no texto; na segunda rodada, certo.

Ainda acontece: o Haiku às vezes escreve o link também no texto (P02), além do
botão, e usa o gráfico numa pergunta de valor único (P02), acrescentando anos
vizinhos. Não erra número; fica mais longo.

---

# Avaliação: Haiku 5.5 × Sonnet 5.5 com o tabelão do Earth Engine (fase 3)

12/11/2026. 36 perguntas de `perguntas.md` (as 35 da fase 2, atualizadas para o
tabelão novo, mais a T05, tirada de uma conversa real). Cada pergunta é um
`claude -p` isolado, com as 5 ferramentas do SEDES e mais nada. Respostas
completas em `claude-haiku-5-5.md` e `claude-sonnet-5-5.md`. A fase 2 está em
`fase2/`.

## Resultado por categoria

Primeira rodada → depois das correções (que estão no código):

| Categoria           | Perguntas | Haiku                    | Sonnet                   |
| ------------------- | --------- | ------------------------ | ------------------------ |
| Conceitual          | 4         | 3 + 1 parcial → 4        | 3 + 1 parcial → 4        |
| Valor pontual       | 6         | 6                        | 6                        |
| Ranking             | 5         | 5                        | 5                        |
| Tendência           | 5         | 4 + 1 parcial → 5        | 4 + 1 parcial → 5        |
| Cruzamento          | 3         | 2 + 1 parcial → 3        | 3                        |
| Recorte agregado    | 4         | 4                        | 4                        |
| Homônimo            | 3         | 3                        | 3                        |
| Período inexistente | 3         | 3                        | 3                        |
| Fora do escopo      | 3         | 3                        | 3                        |
| **Total**           | **36**    | **33 + 3 parciais → 36** | **34 + 2 parciais → 36** |

Nenhum número inventado. Tempo médio 7,9 s por pergunta nos dois (máximo
13,5 s). Nenhuma chamada ao relatório do site: o tabelão respondeu tudo,
inclusive PIB, recortes e previsões, que na fase 2 exigiam o site.

## As parciais e o que foi corrigido

| Pergunta                   | Modelo  | O que houve                                  | Causa                                                                | Correção                                                           |
| -------------------------- | ------- | -------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| C01 (o que é o CDI)        | os dois | Disseram que o catálogo não explica o método | `listar_indices` não mostra a descrição longa                        | Ferramenta nova `detalhar_indice`                                  |
| T05 (Itabuna)              | os dois | 45,0% onde o certo é 44,9%                   | A ferramenta mostrava 2 casas (44,95) e o modelo arredondava de novo | Saída com 3 casas                                                  |
| X02 (degradação × pobreza) | Haiku   | Contou 2.275 municípios (certo: 2.268)       | A contagem somou 7 recortes junto                                    | Exemplo de contagem com `t.tipo = 'municipio'` na descrição da SQL |

O mesmo arredondamento duplo afetava a fase 2: o gabarito da X02 dizia 81,0%
para Campo Grande–AL, e o valor é 80,9% (como no site). Corrigido.

## O que melhorou com o tabelão novo

- A conversa real que virou a T05 (seca em Itabuna em 7/5/2001 e 7/5/2026)
  falhava na fase 2: o bot comparava o CDI de 2001 com o Monitor de Secas de 2026. Agora os dois modelos usam o CDI nos dois anos, explicam que o dia 7
  cai no decêndio de 1º de maio e citam o Monitor como complemento.
- Recortes (Nordeste, Semiárido) têm valor próprio para todos os índices: A02
  e A04 deixaram de depender do site ou de média improvisada.
- R04 (S2iD na Caatinga): os dois perceberam o empate de 760 municípios com
  1 registro e repetiram a ressalva da planilha, em vez de inventar um ranking.
