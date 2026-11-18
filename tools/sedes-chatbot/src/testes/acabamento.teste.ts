/**
 * O que a página faz com a resposta do modelo sem depender dele: conferir os
 * números, limpar o texto, montar o link e resumir séries.
 * Roda com: npm run testar
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { numerosEscritos, numerosSemFonte } from "../conferir-numeros.ts";
import {
  acabar,
  limparResposta,
  revisaoSemErro,
  semComentarioDaRevisao,
} from "../chat/acabamento.ts";
import { Turno, type Evento, type Pedido } from "../chat/turno.ts";
import {
  corrigirColunasInventadas,
  dicaDoErro,
  linkDasConsultas,
  notasDaForma,
  notasDeIdsDesconhecidos,
  resumoCalculado,
  resumoDasPrevisoes,
} from "../ferramentas.ts";

const saida = `periodo | rotulo_classe | valor
2026-01 | Seca moderada | 49.64
2026-01 | Seca grave | 20.879
2026-01 | Seca extrema | 27.331
2026-04 | Seca grave | 6.729`;
const fontes = { ferramentas: [saida], outras: ["Como está a seca no Ceará?"] };

test("número que está na saída, arredondado como foi escrito, vale", () => {
  assert.deepEqual(
    numerosSemFonte("Seca grave: 20,9% em janeiro e 6,7% em abril.", fontes),
    [],
  );
});

test("número que não está em lugar nenhum é acusado", () => {
  assert.deepEqual(
    numerosSemFonte("Seca grave: 23,4% em janeiro.", fontes),
    ["23,4"],
  );
});

test("soma de linhas vizinhas e diferença entre números da resposta valem", () => {
  // 20,879 + 27,331 = 48,21; 20,9 - 6,7 = 14,2
  assert.deepEqual(
    numerosSemFonte(
      "Grave ou pior: 48,2%. A grave caiu de 20,9% para 6,7% (14,2 pontos).",
      fontes,
    ),
    [],
  );
});

test("anos, datas e inteiros pequenos não são conferidos", () => {
  assert.deepEqual(
    numerosEscritos("Em 2026, 3 dos 5 meses (até 19/10/2026) e 2026-09.").map(
      (n) => n.texto,
    ),
    [],
  );
});

test("em inglês o ponto é a decimal", () => {
  assert.deepEqual(numerosSemFonte("Severe drought: 20.9%.", fontes, "en"), []);
  assert.deepEqual(numerosSemFonte("Severe drought: 31.2%.", fontes, "en"), [
    "31.2",
  ]);
});

test("limparResposta separa as sugestões e tira o link do site do texto", () => {
  const r = limparResposta(
    "Patos tem 82,5%.\n\n[Ver no SEDES](https://sedes.oca.ufcg.edu.br/pt/platform?section=communication&locationKey=2510808)\n\n» E em Sousa?\n» Mostre no mapa da Paraíba.",
  );
  assert.equal(r.resposta, "Patos tem 82,5%.");
  assert.deepEqual(r.sugestoes, ["E em Sousa?", "Mostre no mapa da Paraíba."]);
});

test("link: um território, vários do mesmo estado, filtro por recorte, Brasil", () => {
  const sql = (resto: string) =>
    `SELECT 1 FROM valores v JOIN territorios t ON t.codigo=v.territorio WHERE v.indice='monitor-de-seca-ana' ${resto}`;
  assert.match(
    linkDasConsultas([sql("AND v.territorio='2504009'")])!,
    /locationKey=2504009.*layers=monitor-de-seca-ana/,
  );
  assert.match(
    linkDasConsultas([sql("AND v.territorio IN ('2504009','2510808')")])!,
    /locationKey=pb&/,
  );
  assert.match(
    linkDasConsultas([sql("AND t.semiarido = 1")])!,
    /locationKey=5_semiarido-semiarido-total/,
  );
  assert.match(linkDasConsultas([sql("")])!, /section=monitoring/);
  assert.equal(linkDasConsultas(["SELECT COUNT(*) FROM territorios"]), null);
});

test("resumo de uma série: início, fim, extremos e sequências", () => {
  const r = resumoCalculado(
    "serie",
    [0, 0, 100, 100, 100, 0, 82.5].map((valor, i) => ({
      rotulo: `2026-0${i + 1}`,
      valor,
    })),
  );
  assert.match(r, /maior 100 \(2026-03, 2026-04, 2026-05\)/);
  assert.match(r, /0 \(2026-01\) → 82,5 \(2026-07\), alta de 82,5/);
  assert.match(r, /1 até o último \(desde 2026-07\)/);
  assert.match(r, /maior sequência foi de 3 \(2026-03 a 2026-05\)/);
});

test("resumo de uma série diz em quais períodos houve alta quando são poucas", () => {
  const r = resumoCalculado(
    "serie",
    [50, 45, 46, 40, 41].map((valor, i) => ({ rotulo: `202${i}`, valor })),
  );
  assert.match(r, /2 altas \(em 2022, 2024\), 2 quedas \(em 2021, 2023\)/);
});

test("id de índice que não existe ganha aviso com os parecidos", () => {
  const [nota] = notasDeIdsDesconhecidos(
    "SELECT 1 FROM valores WHERE indice='monitor-de-secas' AND territorio='pb' AND periodo='2026-09'",
  );
  assert.match(nota, /não existe índice com o id 'monitor-de-secas'/);
  assert.match(nota, /'monitor-de-seca-ana'/);
  assert.deepEqual(
    notasDeIdsDesconhecidos(
      "SELECT 1 FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='4_asd-asd-entorno'",
    ),
    [],
  );
});

test("previsões: soma o lado de cada fonte e avisa quando discordam", () => {
  const linha = (indice: string, rotulo_classe: string, valor: number) => ({
    indice,
    periodo: "2026-12",
    rotulo_classe,
    valor,
  });
  const cptec = "previsao-anomalia-precipitacao-cptec-inpe";
  const inmet = "previsao-anomalia-precipitacao-mensal-inmet";
  const r = resumoDasPrevisoes(
    ["indice", "periodo", "rotulo_classe", "valor"],
    [
      linha(cptec, "Levemente abaixo (-30 a 0 mm/mês)", 0.074),
      linha(cptec, "Levemente acima (0 a 30 mm/mês)", 99.926),
      linha(inmet, "Levemente abaixo (-30 a 0 mm/mês)", 76.4),
      linha(inmet, "Levemente acima (0 a 30 mm/mês)", 23.6),
    ],
  );
  assert.match(r, /cptec-inpe \(2026-12\): 0,1% da área abaixo do normal, 99,9% acima/);
  assert.match(r, /as fontes discordam/);
  // Fora das previsões, nada.
  assert.equal(
    resumoDasPrevisoes(
      ["indice", "valor"],
      [{ indice: "monitor-de-seca-ana", valor: 10 }],
    ),
    "",
  );
});

/** Um turno que já consultou o tabelão e escreveu a resposta. */
function turnoRespondido(resposta: string) {
  const eventos: Evento[] = [];
  const turno = new Turno(1, "Como está a seca no Ceará?", (e) => eventos.push(e), () => {});
  turno.ferramenta("f1", "consultar_sql", { sql: "SELECT 1" });
  turno.saida("f1", saida, false);
  turno.texto(resposta);
  const pedido = {
    conversa: "c",
    modelo: "haiku",
    turno,
    contexto: {},
    anteriores: () => [],
  } as unknown as Pedido;
  return { turno, pedido, eventos };
}

test("revisão das frases: OK mantém a resposta que a pessoa já está vendo", () => {
  const { turno, pedido, eventos } = turnoRespondido(
    "Seca grave: 20,9% em janeiro.\n» E em abril?",
  );
  assert.match(acabar(pedido)!, /releia a sua resposta/);
  const antes = eventos.length;
  turno.texto("OK");
  assert.equal(acabar(pedido), null);
  assert.equal(turno.resposta, "Seca grave: 20,9% em janeiro.");
  assert.equal(turno.reescritaNaRevisao, false);
  assert.deepEqual(turno.sugestoes, ["E em abril?"]);
  // Nada apagado nem reescrito na página durante a revisão.
  assert.deepEqual(
    eventos.slice(antes).map((e) => e.tipo),
    ["sugestoes"],
  );
});

test("revisão das frases: resposta corrigida troca a anterior", () => {
  const { turno, pedido, eventos } = turnoRespondido(
    "Quase toda a seca era grave: 20,9% em janeiro.",
  );
  assert.ok(acabar(pedido));
  turno.texto("Em janeiro, 20,9% da área estava em seca grave e 49,6% em seca moderada.");
  assert.equal(acabar(pedido), null);
  assert.match(turno.resposta, /49,6% em seca moderada/);
  assert.equal(turno.reescritaNaRevisao, true);
  assert.deepEqual(
    eventos.slice(-2).map((e) => e.tipo),
    ["descartar", "texto"],
  );
});

test("revisão das frases: correção com número sem fonte é descartada", () => {
  const { turno, pedido } = turnoRespondido("Seca grave: 20,9% em janeiro.");
  assert.ok(acabar(pedido));
  turno.texto("Em janeiro, 33,3% da área estava em seca grave, bem mais que em abril.");
  assert.equal(acabar(pedido), null);
  assert.equal(turno.resposta, "Seca grave: 20,9% em janeiro.");
  assert.equal(turno.reescritaNaRevisao, false);
  assert.equal(turno.corrigida, false);
});

test("resumo da série dá a variação em % quando o valor não é porcentagem", () => {
  const pib = [
    { rotulo: "2010", valor: 3434155106 },
    { rotulo: "2020", valor: 7079376394 },
    { rotulo: "2023", valor: 10577530457 },
  ];
  assert.match(resumoCalculado("serie", pib, "R$"), /\+208% \(o último é 3,1 vezes/);
  // Em "% da área" a variação relativa se confunde com pontos: não entra.
  assert.doesNotMatch(resumoCalculado("serie", pib, "% da área"), /Variação/);
  assert.doesNotMatch(resumoCalculado("serie", pib), /Variação/);
});

test("avisa quando a média é tirada entre as classes, não entre os períodos", () => {
  const errada =
    "SELECT ano, AVG(CASE WHEN classe IN (2,3,4) THEN valor END) FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='ce' GROUP BY ano";
  assert.match(notasDaForma(errada).join(" "), /média ENTRE AS CLASSES/);
  const certa =
    "SELECT ano, AVG(s) FROM (SELECT ano, periodo, SUM(valor) s FROM valores WHERE indice='indice-combinado-de-seca-cdi' AND territorio='ce' AND classe BETWEEN 2 AND 4 GROUP BY periodo) GROUP BY ano";
  assert.deepEqual(notasDaForma(certa), []);
});

test("avisa quando a consulta trouxe só o estado de nome igual ao município", () => {
  const sp = "SELECT valor FROM valores WHERE indice='monitor-de-seca-ana' AND periodo='2026-09' AND territorio='sp'";
  assert.match(notasDaForma(sp).join(" "), /só o ESTADO \('sp'\); o município é '3550308'/);
  // Com os dois na consulta, ou com um estado sem município homônimo, não avisa.
  assert.deepEqual(notasDaForma(sp.replace("='sp'", " IN ('sp','3550308')")), []);
  assert.deepEqual(notasDaForma(sp.replace("'sp'", "'pb'")), []);
});

test("erro de coluna volta com as colunas que existem", () => {
  assert.match(
    dicaDoErro("SELECT indice, nome FROM indices", "no such column: indice"),
    /indices\(id, nome, descricao/,
  );
  assert.equal(dicaDoErro("SELECT 1", "near FROM: syntax error"), "");
});

test("a resposta reescrita sai sem o parágrafo que fala da conferência", () => {
  const vazou =
    "Não encontrei erros na resposta de antes, exceto uma frase. Segue a resposta corrigida.\n\nO SEDES não tem o nível do açude.";
  assert.equal(semComentarioDaRevisao(vazou), "O SEDES não tem o nível do açude.");
  // Resposta normal, ou de um parágrafo só, fica como está.
  const normal = "Em setembro de 2026, 82,5% da área estava em seca grave.\n\n» E a previsão?";
  assert.equal(semComentarioDaRevisao(normal), normal);
  assert.equal(semComentarioDaRevisao("Segue a resposta corrigida."), "Segue a resposta corrigida.");
});

test("a coluna inventada codigo_territorio vira territorio", () => {
  assert.equal(
    corrigirColunasInventadas("SELECT * FROM valores_com_nomes WHERE v.codigo_territorio='2504009'"),
    "SELECT * FROM valores_com_nomes WHERE v.territorio='2504009'",
  );
});

test("um OK escrito por extenso na revisão mantém a resposta original", () => {
  assert.equal(
    revisaoSemErro(
      "Esta resposta não precisa de correção, então não a reescrevo. Pelo que confirmei nas saídas, a contagem de 14 estados acima de 50% está certa, a ordem do ranking está certa, e o período e a data de atualização conferem.",
    ),
    true,
  );
  // Anunciar a correção e trazer o texto novo continua sendo reescrita.
  assert.equal(
    revisaoSemErro(
      "Não encontrei erros, exceto uma frase sem apoio. Segue a resposta corrigida.\n\nO SEDES não tem o nível do açude. Para o município de Boqueirão, o SEDES tem o Monitor de Secas e as previsões de chuva.",
    ),
    false,
  );
  assert.equal(
    revisaoSemErro(
      "Em setembro de 2026, 82,5% da área de Patos (PB) estava em seca grave e 17,5% em seca moderada, pelo Monitor de Secas.",
    ),
    false,
  );
});

test("colunas inventadas em consultas de uma tabela só", () => {
  assert.equal(
    corrigirColunasInventadas("SELECT valor FROM valores_com_nomes WHERE codigo='2504009'"),
    "SELECT valor FROM valores_com_nomes WHERE territorio='2504009'",
  );
  // Com territorios na consulta, codigo é a coluna de verdade: fica.
  const comT = "SELECT t.codigo FROM valores_com_nomes v JOIN territorios t ON t.codigo=v.territorio";
  assert.equal(corrigirColunasInventadas(comT), comT);
  assert.equal(
    corrigirColunasInventadas("SELECT indice, atualizado_em FROM indices WHERE id='x'"),
    "SELECT id, atualizado_em FROM indices WHERE id='x'",
  );
  const valores = "SELECT indice FROM valores WHERE indice='x'";
  assert.equal(corrigirColunasInventadas(valores), valores);
});
