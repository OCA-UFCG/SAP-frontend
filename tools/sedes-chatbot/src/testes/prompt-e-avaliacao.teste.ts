import assert from "node:assert/strict";
import { test } from "node:test";
import { lerPerguntas, numerosFaltando } from "../avaliacao.ts";
import { promptDoSistema } from "../prompt-sistema.ts";
import { comRotuloDaClasse, trimestreDe } from "../ferramentas.ts";
import { linguaDa, paraOModelo } from "../chat/lingua.ts";

test("prompt do sistema leva catálogo, textos do site e a data no fim", () => {
  const p = promptDoSistema(new Date("2026-11-12T12:00:00Z"));
  assert.match(p, /## Catálogo de índices/);
  assert.match(p, /monitor-de-seca-ana — Monitor de secas/);
  // Com poucos períodos, lista os que existem em vez de "primeiro a último".
  assert.match(p, /produto-interno-bruto — .*anual, 2010, 2020, 2023;/);
  assert.match(p, /## Textos do site e complemento/);
  assert.ok(p.trimEnd().endsWith("Data de hoje: 12/11/2026."));
});

test("as variáveis de ambiente tiram catálogo e textos do prompt", () => {
  process.env.SEDES_CATALOGO_NO_PROMPT = "0";
  process.env.SEDES_TEXTOS_NO_PROMPT = "0";
  try {
    const p = promptDoSistema();
    assert.doesNotMatch(p, /## Catálogo de índices/);
    assert.doesNotMatch(p, /## Textos do site/);
  } finally {
    delete process.env.SEDES_CATALOGO_NO_PROMPT;
    delete process.env.SEDES_TEXTOS_NO_PROMPT;
  }
});

test("números esperados: casa o número inteiro, não um pedaço de outro", () => {
  const r = "Seca grave em 82,5% da área; moderada 17,5 %. Total 100%.";
  assert.deepEqual(numerosFaltando(r, ["82,5", "17,5", "100"]), []);
  assert.deepEqual(numerosFaltando(r, ["2,5"]), ["2,5"]);
  assert.deepEqual(numerosFaltando("71,72%", ["71,7"]), ["71,7"]);
  assert.deepEqual(numerosFaltando("98,0%", ["98"]), ["98"]);
});

test("perguntas com continuação são lidas na ordem", () => {
  const m02 = lerPerguntas().find((p) => p.id === "M02");
  assert.equal(m02?.perguntas.length, 3);
  assert.equal(m02?.perguntas[1], "E como era em 2015?");
  assert.deepEqual(m02?.numeros, ["42,8", "42,2"]);
});

test("consultar_sql põe o rótulo ao lado da classe", () => {
  const linhas = [
    {
      indice: "previsao-precipitacao-mensal-acumulado-inmet",
      classe: 2,
      valor: 100,
    },
  ];
  const t = comRotuloDaClasse(
    "SELECT ...",
    ["indice", "classe", "valor"],
    linhas,
  );
  assert.deepEqual(t.colunas, ["indice", "classe", "rotulo_classe", "valor"]);
  assert.equal(t.linhas[0].rotulo_classe, "10 a 100 mm/mês");
  // Sem coluna de índice: usa o único id escrito no SQL.
  const s = comRotuloDaClasse(
    "SELECT classe, valor FROM valores WHERE indice='monitor-de-seca-ana' AND territorio='pb'",
    ["classe", "valor"],
    [{ classe: 4, valor: 37.9 }],
  );
  assert.equal(s.linhas[0].rotulo_classe, "Seca grave");
  // Com rótulo já na consulta, ou sem como saber o índice, não mexe.
  const r = comRotuloDaClasse("x", ["classe", "rotulo_classe"], []);
  assert.deepEqual(r.colunas, ["classe", "rotulo_classe"]);
  assert.deepEqual(
    comRotuloDaClasse("x", ["classe", "valor"], [{ classe: 1, valor: 2 }])
      .colunas,
    ["classe", "valor"],
  );
});

test("trimestre da previsão sazonal pelo mês em que começa", () => {
  assert.equal(trimestreDe("2026-11"), "nov/2026 a jan/2027");
  assert.equal(trimestreDe("2026-09"), "set/2026 a nov/2026");
});

test("língua da pergunta: só as em inglês ou espanhol ganham lembrete", () => {
  const erradas = lerPerguntas()
    .flatMap((p) => p.perguntas.map((q) => [p.id, q] as const))
    .filter(([id, q]) => {
      // CV10 troca de língua no meio da conversa: só a 2ª pergunta é em inglês.
      const esperada =
        id === "CV10" && /English/.test(q)
          ? "en"
          : ({ U01: "en", U03: "en", U02: "es", U04: "es" }[id] ?? "pt");
      return linguaDa(q) !== esperada;
    });
  assert.deepEqual(erradas, []);
  assert.equal(linguaDa("And in Patos?"), "en");
  assert.equal(paraOModelo("E em Patos?"), "E em Patos?");
  assert.match(paraOModelo("¿Y en Patos?"), /toda la respuesta en español/);
});
