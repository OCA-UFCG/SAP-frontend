import { timingSafeEqual } from "node:crypto";
import { statfs } from "node:fs/promises";
import {
  getHealthReport,
  type HealthReport,
} from "@/app/api/health/checks";

/**
 * As métricas do SEDES no formato que o Prometheus lê, para a VM de
 * monitoramento (oca-monitor) vigiar o ambiente de fora.
 *
 * Traz o mesmo estado das dependências que o `/api/health` e, além dele, o
 * disco da VM: o container enxerga o disco do host pela camada do Docker, e
 * disco cheio derruba os containers. Só responde a quem manda o
 * `METRICS_TOKEN`; sem ele configurado, a rota não existe.
 */
export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN?.trim();
  if (!token) return new Response(null, { status: 404 });
  if (!isAuthorized(request.headers.get("authorization"), token)) {
    return new Response(null, { status: 401 });
  }

  const [report, disk] = await Promise.all([getHealthReport(), readDisk()]);

  return new Response(formatMetrics(report, disk), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isAuthorized(header: string | null, token: string) {
  const sent = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return sent.length === expected.length && timingSafeEqual(sent, expected);
}

interface DiskUsage {
  usedRatio: number;
  freeBytes: number;
}

async function readDisk(): Promise<DiskUsage | null> {
  try {
    const stats = await statfs("/");
    const used = (stats.blocks - stats.bfree) * stats.bsize;
    const free = stats.bavail * stats.bsize;
    // A mesma conta do `df`: o espaço reservado ao root não conta como livre.
    return { usedRatio: used / (used + free), freeBytes: free };
  } catch (error) {
    console.error("[metrics] não consegui ler o disco:", error);
    return null;
  }
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatMetrics(report: HealthReport, disk: DiskUsage | null) {
  const dependencies = Object.entries(report.dependencies);
  const lines = [
    "# HELP sedes_dependency_up 1 se a dependência respondeu na última verificação; o rótulo error diz a categoria da falha.",
    "# TYPE sedes_dependency_up gauge",
    ...dependencies.map(([name, status]) => {
      const error = status.error ? `,error="${escapeLabel(status.error)}"` : "";
      return `sedes_dependency_up{dependency="${name}"${error}} ${status.ok ? 1 : 0}`;
    }),
    "# HELP sedes_dependency_latency_seconds Quanto a dependência levou para responder na última verificação.",
    "# TYPE sedes_dependency_latency_seconds gauge",
    ...dependencies.map(
      ([name, status]) =>
        `sedes_dependency_latency_seconds{dependency="${name}"} ${status.latencyMs / 1000}`,
    ),
  ];

  if (disk) {
    lines.push(
      "# HELP sedes_disk_used_ratio Fração usada do disco da VM onde ficam as imagens e os logs do Docker.",
      "# TYPE sedes_disk_used_ratio gauge",
      `sedes_disk_used_ratio ${disk.usedRatio}`,
      "# HELP sedes_disk_free_bytes Espaço livre no disco da VM.",
      "# TYPE sedes_disk_free_bytes gauge",
      `sedes_disk_free_bytes ${disk.freeBytes}`,
    );
  }

  return lines.join("\n") + "\n";
}
