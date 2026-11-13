/**
 * A Priorização (análise multicritério) do SEDES no chat: a mesma conta da aba
 * Priorização do site, feita pelo mesmo backend (SAP-analise-multicriterial,
 * ELECTRE TRI-B). O chat só chama POST /api/v1/analyze e resume a resposta;
 * nada é recalculado aqui, para o número do chat ser o número do site.
 *
 * Os dados da Priorização não são os do tabelão: vêm da planilha que a equipe
 * mantém e que o backend relê a cada 30 minutos.
 *
 * Variável de ambiente:
 *   SEDES_MULTICRITERIO_URL  base do backend (padrão http://127.0.0.1:8000, a
 *                            mesma do API_BASE_URL do site local)
 */
import { z } from "zod";
import type { Ferramenta } from "./ferramentas.ts";
import { semAcento } from "./texto.ts";

const BASE = (
  process.env.SEDES_MULTICRITERIO_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");
const SITE_URL = (
  process.env.SEDES_SITE_URL ?? "https://sedes.oca.ufcg.edu.br"
).replace(/\/$/, "");
const PRAZO_MS = 30_000;
const CRITERIOS_VALEM_MS = 10 * 60_000;
const LISTA_MAX = 150;

// Os mesmos padrões do formulário do site (AnalyzeForm.tsx).
const LIMIARES_PADRAO = { indiferenca: 0.02, preferencia: 0.1, veto: 0.5 };

/** Classe do backend (0 a 4) → nível de prioridade, como no mapa do site. */
export const NIVEIS = ["Muito baixa", "Baixa", "Média", "Alta", "Muito alta"];

export type Criterio = {
  name: string;
  label: string;
  is_benefit: boolean;
  unit: string | null;
  description: string | null;
  default: boolean;
};

// --- critérios ----------------------------------------------------------------

let criterios: Criterio[] | null = null;
let lidosEm = 0;

/** Lista de critérios do backend, guardada por 10 minutos. */
export async function criteriosDaPriorizacao(): Promise<Criterio[]> {
  if (criterios && Date.now() - lidosEm < CRITERIOS_VALEM_MS) return criterios;
  try {
    const resp = await fetch(`${BASE}/api/v1/criterias`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    criterios = (await resp.json()) as Criterio[];
    lidosEm = Date.now();
  } catch (error) {
    // Com o backend fora, segue com a última lista que deu certo.
    if (!criterios) throw error;
  }
  return criterios;
}

/** A última lista lida, sem esperar a rede (para o prompt do sistema). */
export function criteriosEmCache() {
  return criterios;
}

// --- resultados guardados para o consultar_sql ---------------------------------
//
// Cada análise fica guardada com um id curto, para o consultar_sql cruzá-la com
// os índices do tabelão por código IBGE (tabela priorizacao), sem o modelo
// copiar listas de nomes. Um id por análise, e não "a última", porque no motor
// api o mesmo processo atende várias conversas ao mesmo tempo.

/** codigo, nome, uf, nivel, nivel_ordem (5 = muito alta), grupo */
type LinhaGuardada = [
  string,
  string,
  string,
  string | null,
  number | null,
  string | null,
];
const GUARDADAS = new Map<string, LinhaGuardada[]>();
const GUARDADAS_MAX = 50;

function guardar(linhas: LinhaGuardada[]) {
  let id: string;
  do id = `p${Math.random().toString(36).slice(2, 6)}`;
  while (GUARDADAS.has(id));
  GUARDADAS.set(id, linhas);
  if (GUARDADAS.size > GUARDADAS_MAX)
    GUARDADAS.delete(GUARDADAS.keys().next().value!);
  return id;
}

export const COLUNAS_DA_TABELA =
  "priorizacao(codigo, nome, uf, nivel, nivel_ordem, grupo)";

/**
 * Põe na frente da consulta a tabela priorizacao com o resultado guardado (uma
 * CTE lida de um JSON). A consulta já foi validada antes (só SELECT/WITH).
 */
export function comPriorizacao(
  sql: string,
  id: string,
): { sql: string } | { erro: string } {
  const linhas = GUARDADAS.get(id.trim());
  if (!linhas)
    return {
      erro: `a Priorização "${id}" não está guardada (ficam as ${GUARDADAS_MAX} últimas análises). Rode priorizar_municipios de novo e use o id novo.`,
    };
  const json = JSON.stringify(linhas).replace(/'/g, "''");
  const cte = `${COLUNAS_DA_TABELA} AS (SELECT value->>0, value->>1, value->>2, value->>3, value->>4, value->>5 FROM json_each('${json}'))`;
  const corpo = sql.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  const comWith = corpo.match(/^with(\s+recursive)?\s/i);
  return {
    sql: comWith
      ? `WITH${comWith[1] ? " RECURSIVE" : ""} ${cte}, ${corpo.slice(comWith[0].length)}`
      : `WITH ${cte} ${corpo}`,
  };
}

/** Os critérios em uma linha cada, para o prompt do sistema. */
export function criteriosResumidos(lista: Criterio[]) {
  return lista
    .map((c) =>
      `- ${c.name}: ${c.label}${c.unit ? ` (${c.unit})` : ""}. ${c.is_benefit ? "Benefício: maior valor = melhor situação = menos prioridade" : "Custo: maior valor = pior situação = mais prioridade"}.${c.default ? " Padrão do site." : ""} ${c.description ?? ""}`.trimEnd(),
    )
    .join("\n");
}

// --- área e comparação ----------------------------------------------------------

const UFS: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};
const REGIOES = ["Norte", "Nordeste", "Centro-oeste", "Sudeste", "Sul"];
const BIOMAS = [
  "Amazônia",
  "Caatinga",
  "Cerrado",
  "Mata Atlântica",
  "Pampa",
  "Pantanal",
];

type TipoArea = "brasil" | "estado" | "regiao" | "bioma" | "semiarido" | "asd";
type Comparacao = "area" | "estado" | "regiao" | "bioma";

const AREA_DO_BACKEND: Record<TipoArea, string> = {
  brasil: "national",
  estado: "state",
  regiao: "region",
  bioma: "biome",
  semiarido: "semiarid",
  asd: "asd",
};
const NIVEL_DO_BACKEND: Record<Comparacao, string> = {
  area: "national",
  estado: "state",
  regiao: "region",
  bioma: "biome",
};
// Os agrupamentos que o site oferece para cada área (rankingLevelsByInterestArea).
const COMPARACOES_POR_AREA: Record<TipoArea, Comparacao[]> = {
  brasil: ["area", "regiao", "bioma", "estado"],
  regiao: ["regiao", "bioma", "estado"],
  bioma: ["bioma", "estado"],
  estado: ["estado"],
  semiarido: ["area", "estado"],
  asd: ["area", "estado"],
};
const NOME_COMPARACAO: Record<Comparacao, string> = {
  area: "todos os municípios da área comparados juntos",
  estado: "cada estado separadamente",
  regiao: "cada região separadamente",
  bioma: "cada bioma (predominante) separadamente",
};
// Coluna do resultado que diz o grupo de cada município.
const COLUNA_DO_GRUPO: Record<Comparacao, string | null> = {
  area: null,
  estado: "UF",
  regiao: "nm_regiao",
  bioma: "bioma_pred",
};

function acharValor(valor: string, opcoes: string[]) {
  const alvo = semAcento(valor);
  return opcoes.find((o) => semAcento(o) === alvo);
}

function resolverArea(tipo: TipoArea, valor?: string) {
  switch (tipo) {
    case "brasil":
      return { valor: "brasil", nome: "Brasil" };
    case "semiarido":
      return { valor: "semiarid", nome: "Semiárido" };
    case "asd":
      return { valor: "asd", nome: "ASD e entorno" };
    case "estado": {
      const v = valor?.trim() ?? "";
      const uf =
        v.toUpperCase() in UFS
          ? v.toUpperCase()
          : Object.keys(UFS).find((k) => semAcento(UFS[k]) === semAcento(v));
      if (!uf)
        return { erro: `Estado "${v}" inválido: use a sigla (ex.: PB).` };
      return { valor: uf, nome: UFS[uf] };
    }
    case "regiao": {
      const r = valor && acharValor(valor, REGIOES);
      if (!r)
        return {
          erro: `Região "${valor ?? ""}" inválida. Opções: ${REGIOES.join(", ")}.`,
        };
      return { valor: r, nome: `região ${r}` };
    }
    case "bioma": {
      const b = valor && acharValor(valor, BIOMAS);
      if (!b)
        return {
          erro: `Bioma "${valor ?? ""}" inválido. Opções: ${BIOMAS.join(", ")}.`,
        };
      return { valor: b, nome: b };
    }
  }
}

// --- resultado -------------------------------------------------------------------

type Municipio = Record<string, unknown> & {
  name: string;
  UF: string;
  classification: number;
};
type Resultado = {
  result: Record<string, Municipio>;
  count: number;
  total_count: number;
  excluded_count: number;
  excluded?: Record<string, { name: string | null; missing_fields: string[] }>;
};

/**
 * Número com vírgula decimal e casas pela grandeza. Acima de 1, nunca 3 casas:
 * "12,406 km²" foi lido pelo modelo como 12.406 (doze mil).
 */
function num(v: number, casas?: number) {
  const a = Math.abs(v);
  const c = casas ?? (a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  return String(Math.round(v * 10 ** c) / 10 ** c).replace(".", ",");
}
const pct = (v: number) => `${num(v * 100, 1)}%`;

// Os 2 primeiros dígitos do código IBGE dizem o estado.
const UF_DO_CODIGO: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

/**
 * Acha os códigos de um município pedido por código ou por nome ("Assunção",
 * "Assunção–PB", "Assunção (PB)"), entre os classificados e os de fora.
 */
function acharMunicipio(pedido: string, r: Resultado): string[] {
  const texto = pedido.trim();
  if (/^\d{7}$/.test(texto)) return [texto];
  const m = /^(.*?)\s*(?:[-–/(,]\s*([A-Za-z]{2})\)?)?$/.exec(texto);
  const nome = semAcento(m?.[1] ?? texto);
  const uf = m?.[2]?.toUpperCase();
  const todos: Array<[string, string | null]> = [
    ...Object.entries(r.result).map(
      ([c, x]) => [c, x.name] as [string, string],
    ),
    ...Object.entries(r.excluded ?? {}).map(
      ([c, x]) => [c, x.name] as [string, string | null],
    ),
  ];
  return todos
    .filter(
      ([c, n]) =>
        n &&
        semAcento(n) === nome &&
        (!uf || UF_DO_CODIGO[c.slice(0, 2)] === uf),
    )
    .map(([c]) => c);
}

/** % dos municípios do grupo em situação melhor que este, num critério. */
function piorQue(valor: number, outros: number[], beneficio: boolean) {
  const melhores = outros.filter((o) => (beneficio ? o > valor : o < valor));
  return melhores.length / outros.length;
}

type Pedido = {
  criterios?: Array<{ nome: string; peso: number }>;
  area?: { tipo: TipoArea; valor?: string };
  comparar_dentro_de?: Comparacao;
  cenario?: "pessimista" | "otimista";
  limiares?: { indiferenca?: number; preferencia?: number; veto?: number };
  municipios?: string[];
  listar?: string[];
};

export async function priorizar(p: Pedido): Promise<string> {
  let lista: Criterio[];
  try {
    lista = await criteriosDaPriorizacao();
  } catch (error) {
    return `Erro: a Priorização está fora do ar (${(error as Error).message}). Diga a quem perguntou que não foi possível rodar a análise agora.`;
  }
  const porNome = new Map(lista.map((c) => [c.name, c]));
  const acharCriterio = (nome: string) =>
    porNome.get(nome) ??
    lista.find((c) => semAcento(c.label) === semAcento(nome));

  // Critérios e pesos. Sem critérios, os padrões do site com pesos iguais.
  const pedidos = p.criterios?.length
    ? p.criterios
    : padroes(lista).map((c) => ({ nome: c.name, peso: 1 }));
  const desconhecidos = pedidos.filter((c) => !acharCriterio(c.nome));
  if (desconhecidos.length)
    return `Erro: critério(s) que a Priorização não tem: ${desconhecidos.map((c) => c.nome).join(", ")}. Critérios disponíveis:\n${criteriosResumidos(lista)}`;
  const escolhidos = pedidos.map((c) => ({
    criterio: acharCriterio(c.nome)!,
    peso: c.peso,
  }));
  const nomes = escolhidos.map((e) => e.criterio.name);
  if (new Set(nomes).size !== nomes.length)
    return "Erro: o mesmo critério apareceu duas vezes.";
  const soma = escolhidos.reduce((s, e) => s + e.peso, 0);
  if (!(soma > 0)) return "Erro: a soma dos pesos tem de ser maior que zero.";
  // O backend recusa soma acima de 1; arredondar para baixo garante isso.
  const pesos = escolhidos.map((e) => Math.floor((e.peso / soma) * 1e4) / 1e4);

  const tipoArea = p.area?.tipo ?? "brasil";
  const area = resolverArea(tipoArea, p.area?.valor);
  if ("erro" in area) return `Erro: ${area.erro}`;
  const comparacao = p.comparar_dentro_de ?? "estado";
  if (!COMPARACOES_POR_AREA[tipoArea].includes(comparacao))
    return `Erro: com a área ${tipoArea}, comparar_dentro_de pode ser ${COMPARACOES_POR_AREA[tipoArea].join(", ")}.`;
  const cenario = p.cenario ?? "pessimista";
  const limiares = { ...LIMIARES_PADRAO, ...p.limiares };

  const corpo = {
    criteria: escolhidos.map((e, i) => ({
      name: e.criterio.name,
      value: pesos[i],
      is_benefit: e.criterio.is_benefit,
    })),
    thresholds: {
      indifference: limiares.indiferenca,
      preference: limiares.preferencia,
      veto: limiares.veto,
    },
    typeScenario: cenario === "otimista" ? "optimistic" : "pessimistic",
    model: { version: "1.0" },
    interestArea: { type: AREA_DO_BACKEND[tipoArea], value: area.valor },
    ranking: { level: NIVEL_DO_BACKEND[comparacao] },
  };

  let r: Resultado;
  try {
    const resp = await fetch(`${BASE}/api/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!resp.ok) {
      const texto = await resp.text();
      return `Erro: a Priorização recusou o pedido (HTTP ${resp.status}): ${texto.slice(0, 300)}`;
    }
    r = (await resp.json()) as Resultado;
  } catch (error) {
    return `Erro: a Priorização não respondeu (${(error as Error).message}). Diga a quem perguntou que não foi possível rodar a análise agora.`;
  }

  const municipios: Municipio[] = Object.values(r.result);
  const colunaGrupo = COLUNA_DO_GRUPO[comparacao];
  const grupoDe = (m: Municipio) =>
    colunaGrupo ? String(m[colunaGrupo] ?? "?") : area.nome;
  const grupos = new Map<string, typeof municipios>();
  for (const m of municipios) {
    const g = grupoDe(m);
    grupos.set(g, [...(grupos.get(g) ?? []), m]);
  }
  const variasUfs = new Set(municipios.map((m) => m.UF)).size > 1;
  const nomeDe = (m: { name: string; UF: string }) =>
    variasUfs ? `${m.name}–${m.UF}` : m.name;

  const partes: string[] = [
    "Priorização do SEDES (análise multicritério ELECTRE TRI-B): a mesma conta da aba Priorização do site, com os dados da planilha da Priorização (não os do tabelão).",
    "",
    "Configuração usada:",
    `- Critérios e pesos: ${escolhidos.map((e, i) => `${e.criterio.label} ${pct(pesos[i])} (${e.criterio.is_benefit ? "benefício" : "custo"})`).join("; ")}.`,
    `- Área: ${area.nome}. Comparação: ${NOME_COMPARACAO[comparacao]}${comparacao === "area" ? "" : " (cada grupo tem as próprias faixas; um nível só vale dentro do grupo)"}.`,
    `- Cenário ${cenario}. Limiares: indiferença ${num(limiares.indiferenca)}, preferência ${num(limiares.preferencia)}, veto ${num(limiares.veto)}${p.limiares ? "" : " (os padrões do site)"}.`,
    "",
    // No começo: a página só recebe os primeiros 6 mil caracteres da saída.
    `Priorização no site: ${SITE_URL}/pt/platform?section=analysis`,
    "(A página do chat mostra um botão com este link. Ele abre a aba Priorização sem esta configuração: se a pessoa quiser repetir no site, diga os critérios, pesos e opções usados.)",
    "",
  ];

  const excluidos = Object.values(r.excluded ?? {});
  const id = guardar([
    ...Object.entries(r.result).map(([c, m]): LinhaGuardada => [
      c,
      m.name,
      m.UF,
      NIVEIS[m.classification] ?? null,
      m.classification + 1,
      grupoDe(m),
    ]),
    ...Object.entries(r.excluded ?? {}).map(([c, e]): LinhaGuardada => [
      c,
      e.name ?? c,
      UF_DO_CODIGO[c.slice(0, 2)] ?? "",
      null,
      null,
      null,
    ]),
  ]);
  partes.push(
    `Para cruzar com índices do tabelão: chame consultar_sql com priorizacao: "${id}". A consulta ganha a tabela ${COLUNAS_DA_TABELA} com os ${r.count + excluidos.length} municípios desta análise: nivel 'Muito alta', 'Alta', 'Média', 'Baixa' ou 'Muito baixa' (nivel_ordem 5 a 1), ou NULL para os que ficaram de fora; grupo é o grupo de comparação. Junte por codigo (= valores.territorio).`,
    "",
  );
  partes.push(
    `Municípios classificados: ${r.count} de ${r.total_count}.` +
      (excluidos.length
        ? ` Ficaram de fora ${excluidos.length} por falta de dado em algum critério escolhido (${resumirFaltas(excluidos, porNome)})${excluidos.length <= 20 ? `: ${excluidos.map((e) => e.name ?? "?").join(", ")}` : ""}.`
        : ""),
    "",
    "Distribuição por nível de prioridade (municípios):",
    "rotulo | valor",
  );
  const contar = (ms: Array<{ classification: number }>) =>
    NIVEIS.map((_, n) => ms.filter((m) => m.classification === n).length);
  const total = contar(municipios);
  for (let n = NIVEIS.length - 1; n >= 0; n--)
    partes.push(`${NIVEIS[n]} | ${total[n]}`);
  partes.push("");

  if (grupos.size > 1 && grupos.size <= 30) {
    partes.push(
      `Por grupo (muito alta / alta / média / baixa / muito baixa):`,
      ...[...grupos.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([g, ms]) => `${g}: ${contar(ms).reverse().join(" / ")}`),
      "",
    );
  }

  // Listas por nível. Dentro de um nível o ELECTRE TRI-B não ordena.
  // Quem pede municípios específicos quer o nível deles, não a lista toda.
  const listar = (p.listar ?? (p.municipios?.length ? [] : ["Muito alta"]))
    .map((n) => NIVEIS.findIndex((x) => semAcento(x) === semAcento(n)))
    .filter((n) => n >= 0);
  for (const n of [...new Set(listar)].sort((a, b) => b - a)) {
    const nomes = municipios
      .filter((m) => m.classification === n)
      .map(nomeDe)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    partes.push(
      `Prioridade ${NIVEIS[n].toLowerCase()} (${nomes.length} municípios, em ordem alfabética; dentro de um nível não há ordem):`,
      nomes.slice(0, LISTA_MAX).join(", ") || "(nenhum)",
      ...(nomes.length > LISTA_MAX
        ? [
            `(e mais ${nomes.length - LISTA_MAX}; para ver todos, rode por estado)`,
          ]
        : []),
      "",
    );
  }

  // Detalhe de municípios pedidos: nível, valores e posição no grupo.
  for (const pedido of p.municipios ?? []) {
    const codigos = acharMunicipio(pedido, r);
    if (codigos.length > 1) {
      partes.push(
        `"${pedido}": ${codigos.length} municípios com esse nome na área (${codigos.map((c) => `${UF_DO_CODIGO[c.slice(0, 2)]}, código ${c}`).join("; ")}). Pergunte qual é, ou passe o nome com a UF.`,
        "",
      );
      continue;
    }
    const codigo = codigos[0] ?? pedido;
    const m = r.result[codigo];
    if (!m) {
      const fora = r.excluded?.[codigo];
      partes.push(
        fora
          ? `${fora.name ?? codigo}: ficou de fora por falta de dado em ${fora.missing_fields.map((f) => porNome.get(f)?.label ?? f).join(", ")}.`
          : `"${pedido}": não está na área analisada (confira o nome ou o código com buscar_territorio).`,
        "",
      );
      continue;
    }
    const grupo = grupos.get(grupoDe(m)) ?? [];
    partes.push(
      `${nomeDe(m)} (${codigo}): prioridade ${NIVEIS[m.classification]?.toLowerCase() ?? m.classification}, comparado com ${grupo.length} municípios (${colunaGrupo ? grupoDe(m) : area.nome}).`,
      "critério | valor | situação pior que (% do grupo)",
      ...escolhidos.map(({ criterio: c }) => {
        const v = m[c.name] as number;
        const outros = grupo.map((o) => o[c.name] as number);
        return `${c.label}${c.unit ? ` (${c.unit})` : ""} | ${num(v)} | ${pct(piorQue(v, outros, c.is_benefit))}`;
      }),
      "",
    );
  }

  return partes.join("\n");
}

/** Como o formulário do site: os critérios marcados como padrão, até 4. */
function padroes(lista: Criterio[]) {
  const marcados = lista.filter((c) => c.default);
  return (marcados.length ? marcados : lista).slice(0, 4);
}

function resumirFaltas(
  excluidos: Array<{ missing_fields: string[] }>,
  porNome: Map<string, Criterio>,
) {
  const n = new Map<string, number>();
  for (const e of excluidos)
    for (const f of e.missing_fields) n.set(f, (n.get(f) ?? 0) + 1);
  return [...n.entries()]
    .map(([f, k]) => `${porNome.get(f)?.label ?? f}: ${k}`)
    .join("; ");
}

export const priorizarMunicipios: Ferramenta = {
  nome: "priorizar_municipios",
  titulo: "Priorização (análise multicritério)",
  descricao:
    "Roda a Priorização do SEDES (aba Priorização do site, método ELECTRE TRI-B): combina critérios com pesos e classifica os municípios de uma área em 5 níveis de prioridade de intervenção (muito alta, alta, média, baixa, muito baixa). Use quando pedirem para priorizar, combinar critérios ou indicadores, ou saber quais municípios precisam mais de ação. Os critérios (lista no prompt) vêm da planilha da Priorização, não do tabelão. Devolve a configuração usada, quantos ficaram de fora por falta de dado, a distribuição por nível (a página desenha o gráfico), a lista dos municípios de prioridade muito alta e, para os municípios pedidos, o nível e a posição em cada critério. Leva menos de 1 s. Sem criterios, usa os padrões do site com pesos iguais.",
  entrada: {
    criterios: z
      .array(
        z.object({
          nome: z
            .string()
            .describe("Nome do critério (ex.: 'ia_mean') ou o rótulo"),
          peso: z
            .number()
            .positive()
            .describe(
              "Importância relativa (ex.: de 1 a 10, como no site); os pesos são normalizados para somar 100%",
            ),
        }),
      )
      .max(16)
      .optional()
      .describe("Omita para usar os critérios padrão do site com pesos iguais"),
    area: z
      .object({
        tipo: z.enum([
          "brasil",
          "estado",
          "regiao",
          "bioma",
          "semiarido",
          "asd",
        ]),
        valor: z
          .string()
          .optional()
          .describe(
            "Sigla da UF ('PB'), região ('Nordeste') ou bioma ('Caatinga')",
          ),
      })
      .optional()
      .describe("Onde rodar. Padrão: Brasil"),
    comparar_dentro_de: z
      .enum(["area", "estado", "regiao", "bioma"])
      .optional()
      .describe(
        "Grupos em que os municípios são comparados entre si. 'estado' (padrão do site; use se a pessoa não pedir outra coisa) classifica cada estado separadamente; 'area' compara todos da área juntos, numa lista única; 'regiao' e 'bioma' agrupam por região ou bioma predominante",
      ),
    cenario: z
      .enum(["pessimista", "otimista"])
      .optional()
      .describe("Padrão do site: pessimista"),
    limiares: z
      .object({
        indiferenca: z.number().min(0).max(1).optional(),
        preferencia: z.number().min(0).max(1).optional(),
        veto: z.number().min(0).max(1).optional(),
      })
      .optional()
      .describe("Só se a pessoa pedir; padrão do site 0,02 / 0,1 / 0,5"),
    municipios: z
      .array(z.string().min(2))
      .max(10)
      .optional()
      .describe(
        "Municípios para ver o nível e a posição em cada critério: nome com UF ('Assunção-PB') ou código IBGE. Não precisa chamar buscar_territorio antes",
      ),
    listar: z
      .array(z.enum(["Muito alta", "Alta", "Média", "Baixa", "Muito baixa"]))
      .optional()
      .describe(
        "Níveis cujos municípios listar por nome. Padrão: só 'Muito alta' (nenhum, quando municipios é passado)",
      ),
  },
  executar: (args: Pedido) => priorizar(args),
};
