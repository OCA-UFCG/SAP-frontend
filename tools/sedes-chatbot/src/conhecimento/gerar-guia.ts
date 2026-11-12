/**
 * Baixa os textos do site do SEDES (página inicial, Sobre e Glossário) e grava
 * em conhecimento/site.md, que a ferramenta sobre_o_sedes entrega ao bot.
 *
 * Lê as páginas publicadas, já renderizadas, para pegar exatamente o que o
 * visitante vê (Contentful, traduções e textos do código juntos). O que o site
 * não diz e o bot precisa saber fica em conhecimento/complemento.md, escrito à
 * mão; este script nunca o toca.
 *
 * Uso: npm run guia     (SEDES_SITE_URL troca o site; padrão, a produção)
 * Precisa do jsdom, que vem com o `npm install` da raiz do repositório.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.resolve(AQUI, "../../conhecimento/site.md");
const SITE = (
  process.env.SEDES_SITE_URL ?? "https://sedes.oca.ufcg.edu.br"
).replace(/\/$/, "");

const PAGINAS = [
  { caminho: "/pt", titulo: "Página inicial" },
  { caminho: "/pt/sobre-o-sedes", titulo: "Sobre o SEDES" },
  { caminho: "/pt/glossary", titulo: "Glossário" },
];

// Fora do texto: navegação, controles, mídia sem descrição e o que o leitor
// de tela também ignora. As logos dos parceiros entram pelo texto alternativo.
const IGNORAR =
  "script,style,svg,noscript,nav,header,footer,button,form,picture,video,iframe,[aria-hidden='true'],[hidden]";
// Blocos que o site mostra só no celular (o computador tem outra versão do
// mesmo conteúdo): `md:hidden` e afins.
const SO_NO_CELULAR = /(^|\s)(sm|md|lg|xl):hidden(\s|$)/;
const EM_LINHA = new Set([
  "A",
  "SPAN",
  "STRONG",
  "EM",
  "B",
  "I",
  "SMALL",
  "SUP",
  "SUB",
  "BR",
  "ABBR",
  "CODE",
  "MARK",
  "TIME",
  "LABEL",
  "IMG",
]);

const normalizar = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
const ignorado = (el: Element) =>
  el.matches(IGNORAR) || SO_NO_CELULAR.test(el.getAttribute("class") ?? "");

/** O texto que o leitor vê: sem o ignorado, com espaço entre elementos vizinhos. */
function textoDe(el: Element): string {
  if (el.tagName === "IMG") return el.getAttribute("alt") ?? "";
  const partes: string[] = [];
  for (const no of el.childNodes) {
    if (no.nodeType === 3) partes.push(no.textContent ?? "");
    else if (no.nodeType === 1 && !ignorado(no as Element))
      partes.push(` ${textoDe(no as Element)} `);
  }
  return normalizar(partes.join(""))
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/([(])\s+/g, "$1");
}

/** Uma linha por bloco de texto, títulos como "###", itens de lista como "-". */
function blocos(raiz: Element): string[] {
  const saida: string[] = [];
  const visitar = (el: Element) => {
    if (ignorado(el)) return;
    const txt = textoDe(el);
    if (!txt) return;
    const titulo = /^H([1-4])$/.exec(el.tagName);
    if (titulo) {
      saida.push(`${"#".repeat(Number(titulo[1]) + 2)} ${txt}`);
      return;
    }
    const temBloco = [...el.children].some(
      (c) => !EM_LINHA.has(c.tagName) && !ignorado(c) && textoDe(c),
    );
    if (!temBloco) {
      // Um bloco que é só um link ("Explore o Monitoramento") é botão, não texto.
      const soLink =
        el.matches("a") ||
        [...el.children].some((c) => c.matches("a") && textoDe(c) === txt);
      if (!soLink) saida.push(el.tagName === "LI" ? `- ${txt}` : txt);
      return;
    }
    for (const no of el.childNodes) {
      if (no.nodeType === 3) {
        const solto = normalizar(no.textContent);
        if (solto) saida.push(solto);
      } else if (no.nodeType === 1) visitar(no as Element);
    }
  };
  visitar(raiz);
  return saida;
}

/**
 * Seções que se repetem entre páginas (os parceiros aparecem na inicial e no
 * Sobre) entram uma vez: a seção cujo título já apareceu sai inteira, até o
 * próximo título do mesmo nível ou acima. Repetições em sequência também saem.
 */
function semSecoesRepetidas(linhas: string[], vistos: Set<string>): string[] {
  const saida: string[] = [];
  let pulandoNivel = 0;
  for (const linha of linhas) {
    const nivel = /^(#+) /.exec(linha)?.[1].length ?? 0;
    if (pulandoNivel && (!nivel || nivel > pulandoNivel)) continue;
    pulandoNivel = 0;
    if (nivel) {
      if (vistos.has(linha)) {
        pulandoNivel = nivel;
        continue;
      }
      vistos.add(linha);
    }
    if (linha !== saida.at(-1)) saida.push(linha);
  }
  return saida;
}

async function main() {
  const partes: string[] = [];
  const vistos = new Set<string>();
  for (const { caminho, titulo } of PAGINAS) {
    const url = `${SITE}${caminho}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${url} respondeu ${resp.status}`);
    const doc = new JSDOM(await resp.text()).window.document;
    const principal = doc.querySelector("main") ?? doc.body;
    const linhas = semSecoesRepetidas(blocos(principal), vistos);
    partes.push(`## ${titulo}\n\n(${url})\n\n${linhas.join("\n\n")}`);
    console.log(`${url}: ${linhas.length} blocos`);
  }
  const hoje = new Date().toLocaleDateString("pt-BR");
  const texto =
    `<!-- Gerado por \`npm run guia\` em ${hoje} a partir de ${SITE}. Não edite: rode de novo. O que o site não diz vai em complemento.md. -->\n\n` +
    `# O SEDES pelo próprio site\n\n${partes.join("\n\n")}\n`;
  writeFileSync(SAIDA, texto);
  console.log(`${SAIDA}: ${texto.length} caracteres`);
}

await main();
