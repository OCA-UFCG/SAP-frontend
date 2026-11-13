# Priorização no chat

12/11/2026, fim da noite. O chat passou a rodar a Priorização (aba do site,
análise multicritério ELECTRE TRI-B) pela ferramenta `priorizar_municipios`,
que chama o mesmo backend do site (`SAP-analise-multicriterial`). Entraram 11
perguntas (N01–N11), com as respostas calculadas no backend.

| Rodada                                    | Notas (certo · parcial · errado) | Mediana | Idas ao modelo | Custo (API) |
| ----------------------------------------- | -------------------------------- | ------- | -------------- | ----------- |
| 11 de Priorização, 1ª versão (`prio-v1`)  | 8 · 2 · 1                        | 10,8 s  | 2,0            | US$ 0,04    |
| 11 de Priorização, final (`prio-v2`)      | 10 · 1 · 0                       | 8,3 s   | 1,8            | US$ 0,04    |
| 11 de Priorização, Sonnet (`prio-sonnet`) | 9 · 2 · 0                        | 10,8 s  | 2,0            | US$ 0,58    |
| 32 difíceis, sem Priorização (`ab-base`)  | 25 · 6 · 1                       | 11,3 s  | 3,3            | US$ 0,09    |
| 32 difíceis, com Priorização (`ab-prio`)  | 26 · 5 · 1                       | 11,2 s  | 3,3            | US$ 0,12    |

As duas últimas rodaram ao mesmo tempo (com outra avaliação em paralelo, por
isso os tempos mais altos): a seção nova do prompt não piorou as outras
perguntas; o custo sobe porque o prompt cresceu ~6 mil caracteres.

O que a 1ª versão errou e mudou:

- Escreveu "12.406 km²" para 12,406 km² (mil vezes maior). A ferramenta agora
  arredonda pela grandeza (12,4; 0,242), sem 3 casas depois da vírgula acima de 1.
- Escolheu sozinha comparar o Nordeste todo junto. O prompt manda ficar no
  padrão do site (cada estado) e oferecer a outra comparação.
- Gastou uma ida ao modelo para achar o código de Assunção. A ferramenta aceita
  o nome do município ("Assunção-PB") e avisa quando há homônimos.
- Não citou nenhum dos 280 nomes de uma lista longa. O prompt pede 10 e o total.

Achados para a equipe (planilha da Priorização e backend), não corrigidos:

- "Pobreza Rural" (coluna `pobreza_rural_2021`) diz "em 2025" na descrição e
  não tem unidade; o bot chama de "%".
- "Anomalia de Precipitação" (coluna `anomalia_out_2026`) diz "dezembro de
  2026" na descrição.
- "População Indígena" e as três de cisternas são contagens absolutas marcadas
  como benefício: município grande fica com prioridade menor só por ser grande.
- 13 municípios da Paraíba, entre eles João Pessoa e Cabedelo, não têm o
  "Índice de Seca" e ficam de fora da análise padrão.
- O servidor MCP do próprio backend (`app/mcp/server.py`) diz que as classes
  vão de 1 (pior) a 5 (melhor). O backend devolve 0 a 4, e 4 é a pior
  situação (muito alta prioridade), como no mapa do site.

# Antes: avaliação difícil e catálogo no prompt

12/11/2026, à noite. As 48 perguntas davam 48/48 nos dois modelos e já não
mostravam nada. Entraram 32 perguntas tiradas do uso real da página (conversa
com continuação, pergunta aberta, sentido das classes, escrita informal, dado
que não existe, comparação) e um avaliador novo, `npm run avaliar`, que roda
pelo mesmo motor da página e dá nota com um juiz (Sonnet). As rodadas citadas
estão em `resultados/rodadas/`.

## O que mudou

- **Prompt do sistema** (`src/prompt-sistema.ts`, igual nos dois motores):
  `prompt.md` + o catálogo de índices resumido + os textos do site + a data. O
  modelo deixou de chamar `listar_indices` (71% das perguntas → 2%) e
  `sobre_o_sedes`. No catálogo, índice com poucos períodos lista os que
  existem (PIB: 2010, 2020, 2023), em vez de "2010 a 2023".
- **Regras novas no prompt**: não acrescentar meses, índices ou comparações
  que ninguém pediu (era onde o Haiku errava); frase sobre tendência só com
  números lidos de uma ferramenta; série descrita quando a pergunta é de
  evolução; pergunta aberta resolvida com uma comparação simples e poucas
  consultas; como explicar uma classe que o catálogo não define.
- **Esquema do SQL**: exemplo de dois índices lado a lado, mês a mês, numa
  consulta só; aviso de que no Índice de Degradação a classe 1 é o "Nível 5"
  (o Haiku chamou a classe 2 de "Nível 2").
- **Motor `claude`**: deixa um processo aberto à espera da próxima conversa
  (primeira pergunta 2,0 s → 1,1 s) e aceita `SEDES_CHAT_ESFORCO`.

## Resultados (Haiku)

| Rodada                            | Notas (certo · parcial · errado) | Mediana | Idas ao modelo | Custo (API) |
| --------------------------------- | -------------------------------- | ------- | -------------- | ----------- |
| 32 difíceis, antes (`base-haiku`) | 23 · 8 · 1                       | 6,7 s   | 4,2            | US$ 0,19    |
| 32 difíceis, depois (`v7-padrao`) | 26 · 6 · 0                       | 6,5 s   | 3,4            | US$ 0,09    |
| 48 antigas, antes (`antigo2-…`)   | 43 · 5 · 0                       | 7,5 s   | 3,8            | US$ 0,16    |
| 48 antigas, depois (`v6-…`)       | 43 · 3 · 2                       | 5,9 s   | 2,7            | US$ 0,08    |
| 32 difíceis, Sonnet (`v5-sonnet`) | 28 · 4 · 0                       | 6,3 s   | 2,9            | US$ 1,35    |

O tempo só se compara entre rodadas feitas ao mesmo tempo: a API varia de um
horário para outro (às 21:58, três respostas de 3 idas levaram 32 a 44 s). Nas
comparações lado a lado, o catálogo no prompt baixou a média de 8,0 s para
6,5 s nas difíceis, e a mediana das antigas caiu de 7,5 s para 5,9 s. No beta
(motor `api`) não há os ~1 a 2 s de abrir o `claude`.

O esforço do modelo não compensou: `low` ganhou 0,8 s e deixou faltar mais
números; `high` perdeu 1,9 s para uma nota a mais. Fica o padrão.

O Sonnet acerta mais nas difíceis no mesmo tempo, mas custa 15 vezes mais na
API (~US$ 0,04 por pergunta; o teto de US$ 2 por dia dá ~50 perguntas).

O juiz também erra e varia: refazer as notas das mesmas respostas mudou 2 a 3
notas. Ele só vale com a leitura do motivo.

## O que ainda acontece (Haiku)

- Descuido ao comentar números que ele mesmo leu ("o único aumento da série",
  "as classes de recuperação somaram entre 4% e 17%").
- Num resumo de um lugar, às vezes traz índices demais.
- Na terceira pergunta de uma conversa, às vezes deixa de repetir de quando é
  o dado.

## Buracos no catálogo e no site (avisar a equipe; não corrigido aqui)

- CDI: o catálogo não define os Estágios 1 a 3 nem as três classes de
  recuperação. O bot explica pela cascata da descrição e diz que é leitura dela.
- Índice de Degradação da Terra: não diz se o Nível 5 ou o Nível 1 é o mais
  degradado. O bot diz que o catálogo não define.
- As 8 previsões por probabilidade têm descrição de ~47 caracteres.
- Classe 5 de `previsao-anomalia-temperatura-trimestral-cptec`: "cima do
  normal" (falta o "A").
- Nome do índice "Mortalidade Infatil".
- A seção "Conheça nossa Equipe de Desenvolvimento" do site não traz nomes no
  texto que o `npm run guia` baixa; o bot responde com as instituições.

# Antes: gráfico, link para o site, textos do SEDES e escopo

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
