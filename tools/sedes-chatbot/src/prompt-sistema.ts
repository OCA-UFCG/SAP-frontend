/**
 * O prompt do sistema dos dois motores: prompt.md, o catálogo de índices
 * resumido e a data de hoje. Rodado direto, imprime o prompt (o comum.sh grava
 * o resultado para o claude da linha de comando).
 *
 * SEDES_CATALOGO_NO_PROMPT=0 tira o catálogo (o modelo volta a chamar
 * listar_indices) e SEDES_TEXTOS_NO_PROMPT=0 tira os textos do site (volta a
 * chamar sobre_o_sedes); servem para comparar na avaliação. SEDES_PROMPT troca
 * o prompt.md por outro arquivo (ex.: a versão anterior, para comparar).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogoResumido, textosDoSite } from "./ferramentas.ts";

const PACOTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function promptDoSistema(agora = new Date()) {
  const hoje = agora.toLocaleDateString("pt-BR", {
    timeZone: "America/Fortaleza",
  });
  const arquivo = process.env.SEDES_PROMPT ?? path.join(PACOTE, "prompt.md");
  const partes = [readFileSync(arquivo, "utf8").trim()];
  if (process.env.SEDES_CATALOGO_NO_PROMPT !== "0")
    partes.push(
      `## Catálogo de índices\n\nÉ o mesmo de listar_indices, já aqui: use-o para os ids, as classes, os períodos e a data de atualização, sem chamar listar_indices.\n\n${catalogoResumido()}`,
    );
  const textos = process.env.SEDES_TEXTOS_NO_PROMPT !== "0" && textosDoSite();
  if (textos)
    partes.push(
      `## Textos do site e complemento\n\nÉ o mesmo que sobre_o_sedes devolve, já aqui: responda com eles as perguntas sobre o SEDES, a plataforma e os conceitos, sem chamar sobre_o_sedes. Os títulos abaixo são do site.\n\n${textos.replace(/^#/gm, "###")}`,
    );
  // A data fica no fim: o resto do prompt é igual o dia todo e vai para o cache.
  partes.push(`Data de hoje: ${hoje}.`);
  return partes.join("\n\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.stdout.write(promptDoSistema() + "\n");
