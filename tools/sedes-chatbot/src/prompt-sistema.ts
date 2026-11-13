/**
 * O prompt do sistema dos dois motores: prompt.md, o catálogo de índices
 * resumido, os textos do site, a Priorização (texto e critérios) e a data de
 * hoje. Rodado direto, imprime o prompt (o comum.sh grava
 * o resultado para o claude da linha de comando).
 *
 * SEDES_CATALOGO_NO_PROMPT=0 tira o catálogo (o modelo volta a chamar
 * listar_indices) e SEDES_TEXTOS_NO_PROMPT=0 tira os textos do site (volta a
 * chamar sobre_o_sedes); servem para comparar na avaliação. SEDES_PROMPT troca
 * o prompt.md por outro arquivo (ex.: a versão anterior, para comparar).
 *
 * Os critérios da Priorização vêm do backend dela: entram os da última leitura
 * (criteriosDaPriorizacao). Sem leitura ainda, o prompt diz para o modelo
 * pedir a lista à ferramenta.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogoResumido, textosDoSite } from "./ferramentas.ts";
import {
  criteriosDaPriorizacao,
  criteriosEmCache,
  criteriosResumidos,
} from "./priorizacao.ts";

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
  partes.push(priorizacao());
  // A data fica no fim: o resto do prompt é igual o dia todo e vai para o cache.
  partes.push(`Data de hoje: ${hoje}.`);
  return partes.join("\n\n");
}

/** O texto da Priorização e a lista de critérios (também vai para o juiz da avaliação). */
export function priorizacao() {
  const arquivo = path.join(PACOTE, "conhecimento/priorizacao.md");
  const texto = existsSync(arquivo)
    ? readFileSync(arquivo, "utf8")
        .replace(/^<!--[\s\S]*?-->\n*/, "")
        .replace(/^# .*\n+/, "")
        .replace(/^#/gm, "##")
    : "";
  const criterios = criteriosEmCache();
  const lista = criterios
    ? `### Critérios disponíveis (nome: rótulo, tipo, descrição)\n\n${criteriosResumidos(criterios)}`
    : "A lista de critérios não pôde ser lida agora; priorizar_municipios devolve a lista quando recebe um critério que não existe.";
  return `## Priorização (análise multicritério)\n\n${texto.trim()}\n\n${lista}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Com o backend da Priorização fora, o prompt sai sem a lista de critérios.
  await criteriosDaPriorizacao().catch(() => {});
  process.stdout.write(promptDoSistema() + "\n");
}
