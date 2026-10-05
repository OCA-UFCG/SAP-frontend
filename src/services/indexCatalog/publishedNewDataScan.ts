import "server-only";

import { chunk } from "@/utils/chunk";
import { listCatalogEntries } from "@/services/indexCatalog/contentfulManagement";
import { checkCatalogNewData } from "@/services/indexCatalog/newDataCheck";
import type {
  CatalogNewDataCheck,
  IndexCatalogItem,
  PublishedNewDataScan,
} from "@/types/indexCatalog";

// Quantos índices são verificados ao mesmo tempo. Cada verificação é uma única
// listagem de diretório, e o SDK do Earth Engine despacha uma requisição a cada
// 350 ms de uma fila global — mais concorrência que isso só alonga a fila.
const SCAN_CONCURRENCY = 4;

// A varredura inteira responde à abertura da tela, então ela vale por um tempo:
// a pasta do Earth Engine não ganha asset novo de minuto em minuto, e sem TTL
// cada F5 do operador refaria dezenas de chamadas.
const SCAN_TTL_MS = 10 * 60 * 1000;

interface ScanCacheEntry {
  expiresAt: number;
  scan: Promise<PublishedNewDataScan>;
}

let cached: ScanCacheEntry | null = null;

function scannableItems(items: IndexCatalogItem[]) {
  return items.filter((item) => item.published && item.managedScope === "full");
}

async function checkOrSkip(
  item: IndexCatalogItem,
): Promise<[string, CatalogNewDataCheck] | null> {
  try {
    return [item.entryId, await checkCatalogNewData(item.entryId)];
  } catch (error) {
    // Um índice que falha não pode derrubar a varredura dos outros: ele fica
    // fora da seção, e o botão do cartão dele mostra o erro de perto.
    console.error(
      `[indexCatalog] verificação de novos dados falhou: ${item.panelLayerId}`,
      error,
    );
    return null;
  }
}

async function runScan(): Promise<PublishedNewDataScan> {
  const items = scannableItems(await listCatalogEntries());
  const checks: Record<string, CatalogNewDataCheck> = {};
  let failed = 0;

  for (const wave of chunk(items, SCAN_CONCURRENCY)) {
    for (const result of await Promise.all(wave.map(checkOrSkip))) {
      if (!result) {
        failed += 1;
        continue;
      }
      checks[result[0]] = result[1];
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    checked: items.length,
    failed,
    checks,
  };
}

/**
 * Verifica de uma vez todos os índices publicados que o catálogo criou, para a
 * tela poder abrir já sabendo quais estão publicando dado velho.
 *
 * Guarda a **promessa**, e não o resultado: a tela do catálogo é aberta por
 * mais de uma pessoa da equipe, e sem isso dois acessos simultâneos disparariam
 * duas varreduras inteiras contra a mesma cota do Earth Engine.
 *
 * @example
 * const scan = await scanPublishedNewData();
 * scan.checks[entryId]?.status; // "new-data"
 */
export function scanPublishedNewData(
  now = Date.now(),
): Promise<PublishedNewDataScan> {
  if (cached && cached.expiresAt > now) return cached.scan;

  const scan = runScan();
  cached = { expiresAt: now + SCAN_TTL_MS, scan };
  // Uma varredura que falha inteira não fica guardada: o próximo acesso tenta
  // de novo em vez de herdar o erro pelos dez minutos do TTL.
  scan.catch(() => {
    if (cached?.scan === scan) cached = null;
  });
  return scan;
}

/** Descarta a varredura guardada; usado quando uma publicação muda a lista. */
export function clearPublishedNewDataScan() {
  cached = null;
}
