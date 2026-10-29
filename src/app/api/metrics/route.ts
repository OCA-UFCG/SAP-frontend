import { timingSafeEqual } from "node:crypto";
import { readFile, statfs } from "node:fs/promises";
import {
  getHealthReport,
  type HealthReport,
} from "@/app/api/health/checks";
import {
  getContentfulTraffic,
  type ContentfulTraffic,
} from "@/infrastructure/contentful/traffic";
import {
  getContentfulUsage,
  type ContentfulUsage,
} from "@/infrastructure/contentful/usage";

/**
 * As métricas do SEDES no formato que o Prometheus lê, para a VM de
 * monitoramento (oca-monitor) vigiar o ambiente de fora.
 *
 * Traz o mesmo estado das dependências que o `/api/health` e, além dele, o
 * disco, a memória e a CPU da VM: o container enxerga o disco do host pela
 * camada do Docker e lê o `/proc` do host, e disco cheio ou memória esgotada
 * derrubam os containers. Traz também o uso da cota de API do Contentful no
 * mês e quantas chamadas este servidor fez a ele. Só responde a quem manda o
 * `METRICS_TOKEN`; sem ele configurado, a rota não existe.
 */
export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN?.trim();
  if (!token) return new Response(null, { status: 404 });
  if (!isAuthorized(request.headers.get("authorization"), token)) {
    return new Response(null, { status: 401 });
  }

  const [report, disk, memory, cpu, usage] = await Promise.all([
    getHealthReport(),
    readDisk(),
    readMemory(),
    readCpu(),
    getContentfulUsage(),
  ]);

  const body = formatMetrics({
    report,
    disk,
    memory,
    cpu,
    usage,
    traffic: getContentfulTraffic(),
  });
  return new Response(body, {
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

interface MemoryUsage {
  totalBytes: number;
  availableBytes: number;
}

/** O `/proc/meminfo` do container é o do host: a memória da VM inteira. */
async function readMemory(): Promise<MemoryUsage | null> {
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const kilobytes = (name: string) =>
      Number(new RegExp(`^${name}:\\s+(\\d+) kB`, "m").exec(meminfo)?.[1]);
    const total = kilobytes("MemTotal");
    const available = kilobytes("MemAvailable");
    if (!total || !Number.isFinite(available)) return null;
    return { totalBytes: total * 1024, availableBytes: available * 1024 };
  } catch (error) {
    console.error("[metrics] não consegui ler a memória:", error);
    return null;
  }
}

interface CpuTime {
  count: number;
  totalSeconds: number;
  idleSeconds: number;
}

/**
 * O tempo de CPU da VM desde que ela ligou, da primeira linha do `/proc/stat`
 * do host. O Prometheus tira a porcentagem ocupada pela diferença entre duas
 * coletas. O tempo roubado pelo hipervisor (steal) conta como ocupado: numa
 * instância da AWS sem créditos de CPU, é ele que cresce.
 */
async function readCpu(): Promise<CpuTime | null> {
  try {
    const stat = await readFile("/proc/stat", "utf8");
    // user nice system idle iowait irq softirq steal, em centésimos de segundo.
    const ticks = stat
      .split("\n", 1)[0]
      .trim()
      .split(/\s+/)
      .slice(1, 9)
      .map(Number);
    if (ticks.length < 8 || ticks.some((tick) => !Number.isFinite(tick))) {
      return null;
    }
    const total = ticks.reduce((sum, tick) => sum + tick, 0);
    return {
      count: (stat.match(/^cpu\d+ /gm) ?? []).length,
      totalSeconds: total / 100,
      idleSeconds: (ticks[3] + ticks[4]) / 100,
    };
  } catch (error) {
    console.error("[metrics] não consegui ler a CPU:", error);
    return null;
  }
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

interface MetricsInput {
  report: HealthReport;
  disk: DiskUsage | null;
  memory: MemoryUsage | null;
  cpu: CpuTime | null;
  usage: ContentfulUsage | null;
  traffic: ReadonlyMap<string, ContentfulTraffic>;
}

function formatMetrics({
  report,
  disk,
  memory,
  cpu,
  usage,
  traffic,
}: MetricsInput) {
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

  if (memory) {
    lines.push(
      "# HELP sedes_memory_total_bytes Memória total da VM.",
      "# TYPE sedes_memory_total_bytes gauge",
      `sedes_memory_total_bytes ${memory.totalBytes}`,
      "# HELP sedes_memory_available_bytes Memória que a VM ainda consegue entregar sem usar swap (MemAvailable).",
      "# TYPE sedes_memory_available_bytes gauge",
      `sedes_memory_available_bytes ${memory.availableBytes}`,
    );
  }

  if (cpu) {
    lines.push(
      "# HELP sedes_cpu_count Núcleos de CPU da VM.",
      "# TYPE sedes_cpu_count gauge",
      `sedes_cpu_count ${cpu.count}`,
      "# HELP sedes_cpu_seconds_total Tempo de CPU da VM desde que ela ligou, somando os núcleos.",
      "# TYPE sedes_cpu_seconds_total counter",
      `sedes_cpu_seconds_total ${cpu.totalSeconds}`,
      "# HELP sedes_cpu_idle_seconds_total Parte desse tempo em que a CPU ficou parada (idle + iowait).",
      "# TYPE sedes_cpu_idle_seconds_total counter",
      `sedes_cpu_idle_seconds_total ${cpu.idleSeconds}`,
    );
  }

  lines.push(
    "# HELP sedes_process_resident_memory_bytes Memória que o servidor do SEDES ocupa.",
    "# TYPE sedes_process_resident_memory_bytes gauge",
    `sedes_process_resident_memory_bytes ${process.memoryUsage.rss()}`,
  );

  if (usage) {
    lines.push(
      "# HELP sedes_contentful_api_requests_month Chamadas de API da organização do Contentful no mês (UTC), de qualquer origem, até o último dia que ele contou.",
      "# TYPE sedes_contentful_api_requests_month gauge",
      ...Object.entries(usage.monthToDate).map(
        ([api, count]) =>
          `sedes_contentful_api_requests_month{api="${api}"} ${count}`,
      ),
      "# HELP sedes_contentful_api_requests_month_projected Como o mês fecha se o ritmo dos últimos 7 dias continuar.",
      "# TYPE sedes_contentful_api_requests_month_projected gauge",
      `sedes_contentful_api_requests_month_projected ${usage.projectedMonthTotal}`,
      "# HELP sedes_contentful_api_requests_limit Chamadas por mês que o plano do Contentful aceita antes de bloquear o espaço.",
      "# TYPE sedes_contentful_api_requests_limit gauge",
      `sedes_contentful_api_requests_limit ${usage.limit}`,
    );
  }

  const apis = [...traffic.entries()];
  lines.push(
    "# HELP sedes_contentful_requests_total Pedidos deste servidor ao Contentful que saíram pela rede, por API.",
    "# TYPE sedes_contentful_requests_total counter",
    ...apis.map(
      ([api, count]) =>
        `sedes_contentful_requests_total{api="${api}"} ${count.requests}`,
    ),
    "# HELP sedes_contentful_response_bytes_total Bytes que o Contentful declarou nas respostas a este servidor, por API.",
    "# TYPE sedes_contentful_response_bytes_total counter",
    ...apis.map(
      ([api, count]) =>
        `sedes_contentful_response_bytes_total{api="${api}"} ${count.bytes}`,
    ),
  );

  return lines.join("\n") + "\n";
}
