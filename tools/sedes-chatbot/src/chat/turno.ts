/**
 * O que os dois motores da página (motor-api.ts e motor-claude.ts) têm em
 * comum: um Turno recebe o que o modelo vai fazendo e repassa para a página,
 * e o servidor grava o turno inteiro quando ele termina.
 */
import type { Contexto } from "../ferramentas.ts";

export type Evento = Record<string, unknown> & { tipo: string };

// Tamanho máximo da saída de ferramenta mandada para a página (ela mostra
// num detalhe recolhido; o arquivo da conversa guarda a saída inteira).
export const SAIDA_MAX = 6_000;

export type Ferramenta = {
  id: string;
  nome: string;
  entrada: unknown;
  saida?: string;
  erro?: boolean;
  inicio: number;
  ms?: number;
};

export type FimDoTurno = {
  ms?: number;
  custo_usd?: number;
  uso?: unknown;
  erro?: string | null;
  interrompida?: boolean;
  /** Só no motor "claude": a sessão do claude que o --resume retoma. */
  session_id?: string;
};

export class Turno {
  resposta = "";
  ferramentas: Ferramenta[] = [];
  readonly inicio = Date.now();
  private separar = false;
  private terminado = false;

  constructor(
    readonly numero: number,
    readonly pergunta: string,
    private readonly enviar: (e: Evento) => void,
    private readonly aoTerminar: (t: Turno, fim: FimDoTurno) => void,
  ) {}

  get acabou() {
    return this.terminado;
  }

  pensando() {
    this.enviar({ tipo: "pensando" });
  }

  preparando(nome: string) {
    this.enviar({ tipo: "preparando", nome });
  }

  /** Um bloco de texto novo depois de outro: a página separa em parágrafos. */
  novoBlocoDeTexto() {
    if (this.resposta) this.separar = true;
  }

  texto(pedaco: string) {
    if (!pedaco) return;
    if (this.separar) {
      pedaco = "\n\n" + pedaco;
      this.separar = false;
    }
    this.resposta += pedaco;
    this.enviar({ tipo: "texto", t: pedaco });
  }

  ferramenta(id: string, nome: string, entrada: unknown) {
    const f: Ferramenta = { id, nome, entrada, inicio: Date.now() };
    this.ferramentas.push(f);
    this.enviar({ tipo: "ferramenta", id, nome, entrada });
  }

  saida(id: string, texto: string, erro: boolean) {
    const f = this.ferramentas.find((x) => x.id === id);
    if (!f) return;
    f.saida = texto;
    f.erro = erro;
    f.ms = Date.now() - f.inicio;
    this.enviar({
      tipo: "saida",
      id,
      texto: texto.slice(0, SAIDA_MAX),
      cortada: texto.length > SAIDA_MAX,
      erro,
      ms: f.ms,
    });
  }

  terminar(fim: FimDoTurno) {
    if (this.terminado) return;
    this.terminado = true;
    this.aoTerminar(this, fim);
  }
}

/** O que o motor recebe para responder uma pergunta. */
export type Pedido = {
  conversa: string;
  /** Apelido do modelo: "haiku" ou "sonnet". */
  modelo: string;
  turno: Turno;
  contexto: Contexto;
  /** Turnos já gravados, para retomar uma conversa que não está na memória. */
  anteriores: () => Array<{
    pergunta: string;
    resposta: string;
    session_id?: string;
  }>;
};

export type Motor = {
  nome: "api" | "claude";
  /** Apelido → id do modelo. */
  modelos: Record<string, string>;
  /** Começa a responder; termina chamando pedido.turno.terminar(). */
  responder(pedido: Pedido): void;
  /** Botão Parar: interrompe a resposta em andamento daquela conversa. */
  parar(conversa: string): void;
  encerrar(): void;
};
