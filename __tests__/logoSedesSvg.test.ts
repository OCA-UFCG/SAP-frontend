import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const logo = readFileSync(
  join(process.cwd(), "public", "logo-sedes.svg"),
  "utf8",
);

/**
 * SED-095: o logo do cabeçalho aparecia serrilhado.
 *
 * A causa não era o CSS nem o next/image: o arquivo era um traçado automático
 * do PNG de 128x46, com um único path de 1.435 segmentos retos presos à grade
 * de meio pixel (`L32.928,23.5L32.928,22.5...`) e nenhuma curva. Cada degrau do
 * bitmap virou geometria vetorial, então o serrilhado sobrevivia a qualquer
 * escala — inclusive aos 57 px do rodapé.
 *
 * Estes testes falham se alguém reexportar um traçado de bitmap por cima do
 * vetor original.
 */
describe("public/logo-sedes.svg", () => {
  it("é o vetor original, não um traçado de bitmap", () => {
    const paths = logo.match(/<path/g) ?? [];
    expect(paths.length).toBe(9);
  });

  it("usa curvas de Bézier, que um traçado por pixel nunca produz", () => {
    expect(logo).toMatch(/[Cc]\s*-?\d/);
  });

  it("não tem a assinatura do traçado: centenas de segmentos na grade de meio pixel", () => {
    const halfPixelSteps = logo.match(/L-?\d+\.\d*5(?:[,\s])/g) ?? [];
    expect(halfPixelSteps.length).toBeLessThan(20);
  });

  it("mantém o viewBox que Header e Footer assumem", () => {
    expect(logo).toContain('viewBox="0 0 128 46"');
  });
});
