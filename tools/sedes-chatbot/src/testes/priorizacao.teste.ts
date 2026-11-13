import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { comPriorizacao, priorizar } from "../priorizacao.ts";

// Backend da Priorização de mentira: 3 critérios e 4 municípios da PB.
const CRITERIOS = [
  {
    name: "ia_mean",
    label: "Índice de Aridez",
    is_benefit: true,
    unit: null,
    description: "",
    default: true,
  },
  {
    name: "pobreza_rural_2021",
    label: "Pobreza Rural",
    is_benefit: false,
    unit: null,
    description: "",
    default: true,
  },
  {
    name: "ips",
    label: "Índice de Progresso Social",
    is_benefit: true,
    unit: null,
    description: "",
    default: false,
  },
];
const mun = (name: string, cls: number, ia: number, pob: number) => ({
  name,
  UF: "PB",
  classification: cls,
  ia_mean: ia,
  pobreza_rural_2021: pob,
});
const RESULTADO = {
  result: {
    "2501351": mun("Assunção", 4, 0.2, 80),
    "2504009": mun("Campina Grande", 2, 0.4, 60),
    "2515906": mun("Serraria", 0, 0.7, 70),
    "2500106": mun("Água Branca", 4, 0.3, 90),
  },
  count: 4,
  total_count: 5,
  excluded_count: 1,
  excluded: { "2507507": { name: "João Pessoa", missing_fields: ["ia_mean"] } },
};

const fetchOriginal = globalThis.fetch;
let pedidos: Array<{ url: string; corpo?: unknown }> = [];

function backend(analise: () => Response) {
  pedidos = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    pedidos.push({
      url,
      corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.endsWith("/criterias")) return Response.json(CRITERIOS);
    return analise();
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test("sem critérios usa os padrões do site com pesos iguais e as opções padrão", async () => {
  backend(() => Response.json(RESULTADO));
  const saida = await priorizar({ area: { tipo: "estado", valor: "Paraíba" } });
  const corpo = pedidos.find((p) => p.url.endsWith("/analyze"))
    ?.corpo as Record<string, unknown>;
  assert.deepEqual(corpo.criteria, [
    { name: "ia_mean", value: 0.5, is_benefit: true },
    { name: "pobreza_rural_2021", value: 0.5, is_benefit: false },
  ]);
  assert.deepEqual(corpo.interestArea, { type: "state", value: "PB" });
  assert.deepEqual(corpo.ranking, { level: "state" });
  assert.equal(corpo.typeScenario, "pessimistic");
  assert.deepEqual(corpo.thresholds, {
    indifference: 0.02,
    preference: 0.1,
    veto: 0.5,
  });
  assert.match(saida, /Área: Paraíba\./);
  assert.match(saida, /^Priorização no site: https:\/\/\S+section=analysis$/m);
});

test("pesos são normalizados sem passar de 1, e o rótulo vale como nome", async () => {
  backend(() => Response.json(RESULTADO));
  await priorizar({
    criterios: [
      { nome: "Pobreza Rural", peso: 2 },
      { nome: "ia_mean", peso: 1 },
      { nome: "ips", peso: 1 },
    ],
    area: { tipo: "semiarido" },
    comparar_dentro_de: "area",
  });
  const corpo = pedidos.find((p) => p.url.endsWith("/analyze"))?.corpo as {
    criteria: Array<{ name: string; value: number }>;
    ranking: unknown;
  };
  assert.deepEqual(
    corpo.criteria.map((c) => c.name),
    ["pobreza_rural_2021", "ia_mean", "ips"],
  );
  assert.deepEqual(
    corpo.criteria.map((c) => c.value),
    [0.5, 0.25, 0.25],
  );
  const tres = await (async () => {
    await priorizar({
      criterios: CRITERIOS.map((c) => ({ nome: c.name, peso: 1 })),
    });
    return (pedidos.at(-1)?.corpo as { criteria: Array<{ value: number }> })
      .criteria;
  })();
  assert.ok(tres.reduce((s, c) => s + c.value, 0) <= 1);
  assert.deepEqual(corpo.ranking, { level: "national" });
});

test("a saída traz a distribuição para o gráfico, os de fora e o detalhe pedido", async () => {
  backend(() => Response.json(RESULTADO));
  const saida = await priorizar({
    area: { tipo: "estado", valor: "PB" },
    municipios: ["2501351", "João Pessoa-PB"],
    listar: ["Muito alta"],
  });
  assert.match(
    saida,
    /rotulo \| valor\nMuito alta \| 2\nAlta \| 0\nMédia \| 1\nBaixa \| 0\nMuito baixa \| 1\n/,
  );
  assert.match(
    saida,
    /Ficaram de fora 1 .*Índice de Aridez: 1\): João Pessoa\./,
  );
  assert.match(
    saida,
    /Prioridade muito alta \(2 municípios.*\):\nÁgua Branca, Assunção/,
  );
  // Aridez é benefício: 0,2 é a menor do grupo, todos os outros estão melhor.
  assert.match(saida, /Índice de Aridez \| 0,2 \| 75%/);
  // Pobreza é custo: 80 só perde para 90.
  assert.match(saida, /Pobreza Rural \| 80 \| 50%/);
  assert.match(
    saida,
    /João Pessoa: ficou de fora por falta de dado em Índice de Aridez\./,
  );
});

test("erros voltam como texto que o modelo entende", async () => {
  backend(() => Response.json(RESULTADO));
  assert.match(
    await priorizar({ criterios: [{ nome: "desmatamento", peso: 1 }] }),
    /não tem: desmatamento\. Critérios disponíveis:\n- ia_mean/,
  );
  assert.match(
    await priorizar({
      area: { tipo: "estado", valor: "PB" },
      comparar_dentro_de: "area",
    }),
    /com a área estado, comparar_dentro_de pode ser estado/,
  );
  assert.match(
    await priorizar({ area: { tipo: "bioma", valor: "Floresta" } }),
    /Bioma "Floresta" inválido/,
  );
  backend(() => new Response("Criterias sum exceed 1.0", { status: 400 }));
  assert.match(await priorizar({}), /recusou o pedido \(HTTP 400\)/);
});

test("o resultado fica guardado para o consultar_sql cruzar por código", async () => {
  backend(() =>
    Response.json({
      ...RESULTADO,
      result: {
        ...RESULTADO.result,
        "2510303": mun("Olho d'Água", 3, 0.5, 50),
      },
    }),
  );
  const saida = await priorizar({ area: { tipo: "estado", valor: "PB" } });
  const id = saida.match(/consultar_sql com priorizacao: "(p\w+)"/)?.[1];
  assert.ok(id, "a saída diz o id");

  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE valores(territorio TEXT, valor REAL); INSERT INTO valores VALUES ('2501351', 100), ('2500106', 50), ('2504009', 0)",
  );
  const rodar = (sql: string) => {
    const r = comPriorizacao(sql, id);
    assert.ok(!("erro" in r));
    return db.prepare(r.sql).all();
  };
  assert.deepEqual(
    rodar(
      "SELECT p.nivel, p.nivel_ordem, AVG(v.valor) AS media FROM priorizacao p JOIN valores v ON v.territorio = p.codigo GROUP BY p.nivel ORDER BY p.nivel_ordem DESC",
    ).map((l) => ({ ...l })),
    [
      { nivel: "Muito alta", nivel_ordem: 5, media: 75 },
      { nivel: "Média", nivel_ordem: 3, media: 0 },
    ],
  );
  // Consulta que já começa com WITH (e comentário), apóstrofo e os de fora.
  assert.deepEqual(
    rodar(
      "-- comentário\nWITH x AS (SELECT 1) SELECT nome, uf, nivel FROM priorizacao, x WHERE nome LIKE '%''%' OR nivel IS NULL ORDER BY nome",
    ).map((l) => ({ ...l })),
    [
      { nome: "João Pessoa", uf: "PB", nivel: null },
      { nome: "Olho d'Água", uf: "PB", nivel: "Alta" },
    ],
  );
  assert.match(
    JSON.stringify(comPriorizacao("SELECT 1", "pnada")),
    /não está guardada/,
  );
});

test("comparar_com diz quem entrou e saiu da prioridade muito alta", async () => {
  backend(() => Response.json(RESULTADO));
  const antes = await priorizar({ area: { tipo: "estado", valor: "PB" } });
  const id = antes.match(/priorizacao: "(p\w+)"/)![1];
  // Assunção cai para alta, Serraria sobe para muito alta.
  backend(() =>
    Response.json({
      ...RESULTADO,
      result: {
        ...RESULTADO.result,
        "2501351": mun("Assunção", 3, 0.2, 80),
        "2515906": mun("Serraria", 4, 0.7, 70),
      },
    }),
  );
  const depois = await priorizar({
    area: { tipo: "estado", valor: "PB" },
    criterios: [{ nome: "pobreza_rural_2021", peso: 1 }],
    comparar_com: id,
  });
  assert.match(depois, /só os 4 municípios classificados nas duas/);
  assert.match(depois, /muito alta: 2 antes, 2 agora/);
  assert.match(depois, /Entraram em muito alta \(1\): Serraria\./);
  assert.match(depois, /Saíram de muito alta \(1\): Assunção\./);
  assert.match(depois, /1 subiram, 1 desceram, 2 ficaram no mesmo/);
  const sem = await priorizar({ comparar_com: "pnada" });
  assert.match(sem, /"pnada" não está guardada/);
});
