/**
 * Roda as consultas SQL de perguntas.md no tabelão e mostra o resultado de
 * cada uma, para conferir a resposta esperada.
 *
 * Uso: npm run consultas [-- P07]   (sem argumento, roda todas)
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACOTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new DatabaseSync(path.join(PACOTE, "data/sedes.sqlite"), {
  readOnly: true,
});
const md = readFileSync(path.join(PACOTE, "perguntas.md"), "utf8");
const filtro = process.argv[2];

for (const bloco of md.split(/^### /m).slice(1)) {
  const id = bloco.split(/\s/)[0];
  if (filtro && id !== filtro) continue;
  const consultas = [...bloco.matchAll(/```sql\n([\s\S]*?)```/g)].map(
    (m) => m[1],
  );
  for (const sql of consultas) {
    const t0 = performance.now();
    const linhas = db.prepare(sql).all() as Array<Record<string, unknown>>;
    const ms = Math.round(performance.now() - t0);
    console.log(`\n=== ${id} (${linhas.length} linhas, ${ms} ms)`);
    for (const l of linhas.slice(0, 15))
      console.log("  " + Object.values(l).join(" | "));
  }
}
