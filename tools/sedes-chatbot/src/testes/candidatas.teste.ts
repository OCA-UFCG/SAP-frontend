import assert from "node:assert/strict";
import { test } from "node:test";
import { candidatasDe, emMarkdown, type Registro } from "../candidatas.ts";
import { perguntasDoMarkdown } from "../avaliacao.ts";

const turno = (
  n: number,
  pergunta: string,
  extra: Partial<Extract<Registro, { tipo: "turno" }>> = {},
): Registro => ({
  tipo: "turno",
  turno: n,
  pergunta,
  resposta: "Resposta.",
  ...extra,
});

test("candidatas: 👎 primeiro, depois sinais; pula as que já existem", () => {
  const cs = candidatasDe(
    [
      {
        id: "a",
        registros: [
          { tipo: "inicio", id: "a" },
          turno(1, "Como está a seca em Patos?"),
          turno(2, "E   em\n Sousa?", {
            resposta: "Não tenho uma ferramenta para isso.",
          }),
        ],
      },
      {
        id: "b",
        registros: [
          turno(1, "Quais os mais pobres da PB?", {
            ms: 45_000,
            ferramentas: [{ nome: "consultar_sql", saida: "Erro: no such" }],
          }),
          { tipo: "avaliacao", turno: 1, nota: "ruim", comentario: "errado" },
          turno(2, "como esta a seca em patos"),
        ],
      },
    ],
    ["Como está a seca em Patos?"],
  );
  assert.deepEqual(
    cs.map((c) => c.id),
    ["cand-b-1", "cand-a-2"],
  );
  assert.deepEqual(cs[0].sinais, [
    "ferramenta com erro (consultar_sql)",
    "lenta (45 s)",
  ]);
  assert.equal(cs[0].comentario, "errado");
  // A continuação leva as perguntas anteriores, numa linha cada.
  assert.deepEqual(cs[1].perguntas, [
    "Como está a seca em Patos?",
    "E em Sousa?",
  ]);
  assert.match(cs[1].sinais[0], /^recusa/);
});

test("o markdown das candidatas é lido pelo avaliar", () => {
  const md = emMarkdown(
    candidatasDe([
      {
        id: "x",
        registros: [turno(1, "Primeira?"), turno(2, "Segunda?")],
      },
    ]),
  );
  const ps = perguntasDoMarkdown(md);
  assert.equal(ps.length, 2);
  assert.equal(ps[1].id, "cand-x-2");
  assert.deepEqual(ps[1].perguntas, ["Primeira?", "Segunda?"]);
});
