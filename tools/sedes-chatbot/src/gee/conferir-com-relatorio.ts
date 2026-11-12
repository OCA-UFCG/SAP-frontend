/**
 * Confere o tabelão contra o relatório do site: para cada território da
 * amostra, pede o relatório (que traz a série inteira de cada índice) e
 * compara cada período e cada classe com o valor do tabelão, arredondado a 1
 * casa como o relatório mostra.
 *
 * Uso: npx tsx src/gee/conferir-com-relatorio.ts [qtd de municípios sorteados, padrão 20]
 *   SEDES_BASE_URL (padrão http://localhost:3000), SEDES_TABELAO (padrão data/sedes.sqlite)
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TABELAO =
  process.env.SEDES_TABELAO ?? path.resolve(AQUI, "../../data/sedes.sqlite");
const BASE_URL = (
  process.env.SEDES_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/u, "");
const SORTEADOS = Number(process.argv[2] ?? 20);

interface Analise {
  id: string;
  status: string;
  timeSeries: Array<{
    period: string;
    distribution: Array<{ percentage: number }>;
  }>;
}

const db = new DatabaseSync(TABELAO, { readOnly: true });
const indices = new Set(
  (db.prepare("SELECT id FROM indices").all() as Array<{ id: string }>).map(
    (r) => r.id,
  ),
);
const fixos = [
  "br",
  "pb",
  "ce",
  "2_regiao-nordeste",
  "3_bioma-caatinga",
  "3_bioma-amazonia",
  "4_asd-asd-entorno",
  "5_semiarido-semiarido-total",
  "2504009",
];
// Sorteio estável: os mesmos municípios a cada rodada, para comparar rodadas.
const sorteados = (
  db
    .prepare(
      "SELECT codigo FROM territorios WHERE tipo = 'municipio' ORDER BY (CAST(codigo AS INTEGER) * 2654435761) % 4294967296 LIMIT ?",
    )
    .all(SORTEADOS) as Array<{ codigo: string }>
).map((r) => r.codigo);
const valoresDe = db.prepare(
  "SELECT periodo, classe, valor FROM valores WHERE territorio = ? AND indice = ? ORDER BY periodo, classe",
);

let comparados = 0;
let iguais = 0;
let soNoRelatorio = 0;
let soNoTabelao = 0;
const diferencas: string[] = [];
const ausentes = new Map<string, number>();

for (const territorio of [...fixos, ...sorteados]) {
  const resp = await fetch(
    `${BASE_URL}/api/municipal-report/${territorio}?period=2026`,
  );
  if (!resp.ok) {
    console.log(`${territorio}: relatório respondeu ${resp.status}`);
    continue;
  }
  const relatorio = (await resp.json()) as { analyses: Analise[] };
  for (const a of relatorio.analyses) {
    if (!indices.has(a.id)) {
      ausentes.set(a.id, (ausentes.get(a.id) ?? 0) + 1);
      continue;
    }
    const tabelao = new Map<string, number[]>();
    for (const r of valoresDe.all(territorio, a.id) as Array<{
      periodo: string;
      classe: number;
      valor: number;
    }>) {
      const lista = tabelao.get(r.periodo) ?? [];
      lista[r.classe - 1] = r.valor;
      tabelao.set(r.periodo, lista);
    }
    const vistos = new Set<string>();
    for (const ponto of a.timeSeries) {
      vistos.add(ponto.period);
      const nossos = tabelao.get(ponto.period);
      if (!nossos) {
        soNoRelatorio += 1;
        if (diferencas.length < 40)
          diferencas.push(
            `${territorio} ${a.id} ${ponto.period}: só no relatório`,
          );
        continue;
      }
      ponto.distribution.forEach((classe, i) => {
        comparados += 1;
        const nosso = Number((nossos[i] ?? 0).toFixed(1));
        if (Math.abs(nosso - classe.percentage) < 1e-9) iguais += 1;
        else if (diferencas.length < 40) {
          diferencas.push(
            `${territorio} ${a.id} ${ponto.period} classe ${i + 1}: tabelão ${nosso}, relatório ${classe.percentage}`,
          );
        }
      });
    }
    for (const periodo of tabelao.keys()) {
      if (!vistos.has(periodo)) {
        soNoTabelao += 1;
        if (diferencas.length < 40)
          diferencas.push(`${territorio} ${a.id} ${periodo}: só no tabelão`);
      }
    }
  }
  process.stdout.write(".");
}

console.log(
  `\n${fixos.length + sorteados.length} territórios, ${comparados} valores comparados: ${iguais} iguais (${((100 * iguais) / Math.max(comparados, 1)).toFixed(3)}%).`,
);
console.log(
  `Períodos só no relatório: ${soNoRelatorio}. Só no tabelão: ${soNoTabelao}.`,
);
if (ausentes.size)
  console.log(
    `Índices do relatório fora do tabelão: ${[...ausentes.keys()].join(", ")}`,
  );
for (const d of diferencas) console.log(`  - ${d}`);
