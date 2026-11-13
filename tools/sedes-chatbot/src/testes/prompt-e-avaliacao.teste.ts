import assert from "node:assert/strict";
import { test } from "node:test";
import { lerPerguntas, numerosFaltando } from "../avaliacao.ts";
import { promptDoSistema } from "../prompt-sistema.ts";

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
