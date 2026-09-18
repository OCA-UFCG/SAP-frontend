import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { MunicipalReportData } from "@/contracts/municipalReport";
import {
  clearStoredReports,
  readStoredReport,
  storeReport,
} from "@/services/municipalReportFileStore";

function makeReport(locationKey: string): MunicipalReportData {
  return {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    requestedPeriod: "2024",
    municipality: { code: locationKey, name: "Teste", uf: "GO" },
    analyses: [],
    templateVariables: {},
  } as unknown as MunicipalReportData;
}

async function writeEnvelope(
  directory: string,
  key: string,
  envelope: unknown,
) {
  await writeFile(
    entryPathFor(directory, key),
    gzipSync(JSON.stringify(envelope)),
  );
}

async function readEnvelope(directory: string, key: string) {
  return JSON.parse(
    gunzipSync(await readFile(entryPathFor(directory, key))).toString("utf8"),
  );
}

function entryPathFor(directory: string, key: string) {
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return path.join(directory, `${digest}.json.gz`);
}

describe("cache em disco do relatório municipal", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sap-report-store-"));
    vi.stubEnv("MUNICIPAL_REPORT_DISK_CACHE_DIR", directory);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it("relê o relatório que acabou de gravar", async () => {
    await storeReport("chave-a", makeReport("5200050"));

    const stored = await readStoredReport("chave-a");

    expect(stored?.expired).toBe(false);
    expect(stored?.report.municipality?.code).toBe("5200050");
  });

  it("não devolve nada quando a chave nunca foi gravada", async () => {
    expect(await readStoredReport("chave-inexistente")).toBeNull();
  });

  it("recusa um arquivo cuja chave gravada não é a pedida", async () => {
    // O nome do arquivo é um hash, então este é o cenário de colisão: o arquivo
    // certo pelo nome, com o relatório de outro pedido dentro dele.
    await writeEnvelope(directory, "chave-a", {
      formatVersion: 1,
      key: "chave-b",
      storedAt: Date.now(),
      expiresAt: Date.now() + 1000,
      report: makeReport("2800308"),
    });

    expect(await readStoredReport("chave-a")).toBeNull();
  });

  it("recusa um arquivo gravado em outra versão do formato", async () => {
    await storeReport("chave-a", makeReport("5200050"));
    const envelope = await readEnvelope(directory, "chave-a");
    await writeEnvelope(directory, "chave-a", {
      ...envelope,
      formatVersion: 99,
    });

    expect(await readStoredReport("chave-a")).toBeNull();
  });

  it("recusa um relatório de outra versão do contrato", async () => {
    await storeReport("chave-a", makeReport("5200050"));
    const envelope = await readEnvelope(directory, "chave-a");
    await writeEnvelope(directory, "chave-a", {
      ...envelope,
      report: { ...envelope.report, schemaVersion: 2 },
    });

    expect(await readStoredReport("chave-a")).toBeNull();
  });

  it("trata um arquivo corrompido como ausente, sem lançar", async () => {
    await writeFile(
      entryPathFor(directory, "chave-a"),
      "{ isto não é json",
      "utf8",
    );

    expect(await readStoredReport("chave-a")).toBeNull();
  });

  it("marca como vencido o arquivo que passou do prazo, sem apagá-lo", async () => {
    vi.stubEnv("MUNICIPAL_REPORT_DISK_CACHE_TTL_SECONDS", "0.001");
    await storeReport("chave-a", makeReport("5200050"));

    await new Promise((resolve) => setTimeout(resolve, 10));
    const stored = await readStoredReport("chave-a");

    expect(stored?.expired).toBe(true);
    expect(stored?.report.municipality?.code).toBe("5200050");
  });

  it("apaga o arquivo mais antigo quando passa do teto", async () => {
    vi.stubEnv("MUNICIPAL_REPORT_DISK_CACHE_MAX_FILES", "2");
    await storeReport("chave-a", makeReport("1"));
    await storeReport("chave-b", makeReport("2"));
    await storeReport("chave-c", makeReport("3"));

    expect(await readStoredReport("chave-a")).toBeNull();
    expect(await readStoredReport("chave-c")).not.toBeNull();
    expect((await readdir(directory)).length).toBe(2);
  });

  it("não escreve nada quando o cache em disco está desligado", async () => {
    vi.stubEnv("MUNICIPAL_REPORT_DISK_CACHE_DIR", "off");

    await storeReport("chave-a", makeReport("5200050"));

    expect(await readStoredReport("chave-a")).toBeNull();
    expect(await readdir(directory)).toEqual([]);
  });

  it("apaga tudo quando o cache é limpo", async () => {
    await storeReport("chave-a", makeReport("5200050"));

    await clearStoredReports();

    expect(await readStoredReport("chave-a")).toBeNull();
  });
});
