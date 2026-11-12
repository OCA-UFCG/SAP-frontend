/**
 * Limites de uso por dia, contados no horário de Fortaleza: um número de
 * perguntas por pessoa e um teto de gasto para o chat todo. Valem além do
 * limite mensal da chave no Console: se algo der errado, o pior caso é o chat
 * parar de responder naquele dia, não a conta crescer.
 *
 * As contagens começam do que já está gravado nas conversas de hoje, então
 * reiniciar o servidor não zera o dia.
 *
 * Variáveis de ambiente:
 *   SEDES_CHAT_PERGUNTAS_POR_DIA   perguntas por pessoa por dia (padrão 40; 0 = sem limite)
 *   SEDES_CHAT_TETO_DIARIO_USD     gasto máximo do chat por dia (padrão 2 no motor api; 0 = sem teto)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function diaDe(quando: Date | string = new Date()) {
  return new Date(quando).toLocaleDateString("sv-SE", {
    timeZone: "America/Fortaleza",
  });
}

export function criarLimites(diretorio: string, env = process.env) {
  const porPessoa = Number(env.SEDES_CHAT_PERGUNTAS_POR_DIA ?? 40);
  const tetoUsd = Number(env.SEDES_CHAT_TETO_DIARIO_USD ?? 2);
  let dia = diaDe();
  let gastoUsd = 0;
  const perguntas = new Map<string, number>();

  function virarDia() {
    const hoje = diaDe();
    if (hoje === dia) return;
    dia = hoje;
    gastoUsd = 0;
    perguntas.clear();
  }

  // Relê o dia de hoje das conversas gravadas.
  const inicioDoDia = Date.now() - 36 * 3600_000;
  for (const f of readdirSync(diretorio).filter((f) => f.endsWith(".jsonl"))) {
    const arquivo = path.join(diretorio, f);
    if (statSync(arquivo).mtimeMs < inicioDoDia) continue;
    let email: string | undefined;
    for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
      if (!linha) continue;
      try {
        const r = JSON.parse(linha);
        if (r.tipo === "inicio") email = r.email ?? undefined;
        if (r.tipo === "turno" && r.em && diaDe(r.em) === dia) {
          gastoUsd += Number(r.custo_usd ?? 0);
          if (email) perguntas.set(email, (perguntas.get(email) ?? 0) + 1);
        }
      } catch {
        // linha cortada: ignora
      }
    }
  }

  return {
    porPessoa,
    tetoUsd,
    /** Motivo para recusar a pergunta, ou null se pode perguntar. */
    recusa(email: string | undefined): string | null {
      virarDia();
      if (tetoUsd > 0 && gastoUsd >= tetoUsd)
        return "O chat atingiu o limite de uso de hoje. Ele volta amanhã.";
      if (email && porPessoa > 0 && (perguntas.get(email) ?? 0) >= porPessoa)
        return `Você chegou a ${porPessoa} perguntas hoje, o limite por pessoa durante o teste. Amanhã libera de novo.`;
      return null;
    },
    contarPergunta(email: string | undefined) {
      virarDia();
      if (email) perguntas.set(email, (perguntas.get(email) ?? 0) + 1);
    },
    contarGasto(usd: number | undefined) {
      virarDia();
      gastoUsd += usd ?? 0;
    },
    situacao() {
      virarDia();
      return { dia, gastoUsd, perguntas: Object.fromEntries(perguntas) };
    },
  };
}
