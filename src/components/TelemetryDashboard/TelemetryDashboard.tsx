import type { ReactNode } from "react";

import type {
  PersistedTelemetryEvent,
  TelemetryCountEntry,
  TelemetryDashboardData,
} from "@/types/telemetry";

const EVENT_LABELS: Record<string, string> = {
  search_found: "Busca encontrada",
  search_not_found: "Busca não encontrada",
  layer_details_opened: "Clique em Detalhamento",
  layer_toggled: "Layer ativado",
};

const SURFACE_LABELS: Record<string, string> = {
  "analysis-panel": "Plataforma",
  home: "Home",
};

const EVENT_BADGE_STYLES: Record<string, string> = {
  search_found: "bg-[#E7F6EC] text-[#1F7A39] ring-[#B7E0C4] border-[#B7E0C4]",
  search_not_found:
    "bg-[#FDECEC] text-[#B42318] ring-[#F5C2C0] border-[#F5C2C0]",
  layer_details_opened:
    "bg-[#FFF4E5] text-[#B54708] ring-[#F8D3A8] border-[#F8D3A8]",
  layer_toggled: "bg-[#EAF2FF] text-[#1D4ED8] ring-[#BFDBFE] border-[#BFDBFE]",
};

const EVENT_ROW_STYLES: Record<string, string> = {
  search_found: "bg-[#F3FBF5]",
  search_not_found: "bg-[#FFF5F5]",
  layer_details_opened: "bg-[#FFF8F0]",
  layer_toggled: "bg-[#F3F7FF]",
};

const SURFACE_PANEL_STYLES: Record<string, string> = {
  "analysis-panel": "bg-[#F3F7FF] border-[#D6E4FF] text-[#214A9A]",
  home: "bg-[#F3FBF5] border-[#CDEAD6] text-[#256B45]",
};

function formatEventLabel(value: string) {
  return EVENT_LABELS[value] ?? value;
}

function formatSurfaceLabel(value: string) {
  return SURFACE_LABELS[value] ?? value;
}

function getEventBadgeClassName(value: string) {
  return (
    EVENT_BADGE_STYLES[value] ??
    "bg-[#F6F7F6] text-[#5F5A5C] ring-[#D6D8D2] border-[#D6D8D2]"
  );
}

function getEventRowClassName(value: string) {
  return EVENT_ROW_STYLES[value] ?? "bg-[#F6F7F6]";
}

function getSurfacePanelClassName(value: string) {
  return (
    SURFACE_PANEL_STYLES[value] ??
    "bg-[#F6F7F6] border-[#E4E5E2] text-[#5F5A5C]"
  );
}

function getSurfaceCount(entries: TelemetryCountEntry[], surface: string) {
  return entries.find((entry) => entry.label === surface)?.count ?? 0;
}

function formatLayerLabel(event: PersistedTelemetryEvent) {
  const layerLabel = event.activeLayerName ?? event.activeLayerId;

  if (!layerLabel) {
    return "-";
  }

  if (event.surface === "home") {
    return `Home - ${layerLabel}`;
  }

  return layerLabel;
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-2xl border border-[#E4E5E2] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#7E797B]">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[#292829]">{value}</p>
      <p className="mt-2 text-sm text-[#7E797B]">{helper}</p>
    </article>
  );
}

function SurfaceSummaryCard({ entries }: { entries: TelemetryCountEntry[] }) {
  const surfaceCards = [
    {
      surface: "analysis-panel",
      label: formatSurfaceLabel("analysis-panel"),
      count: getSurfaceCount(entries, "analysis-panel"),
    },
    {
      surface: "home",
      label: formatSurfaceLabel("home"),
      count: getSurfaceCount(entries, "home"),
    },
  ];

  return (
    <article className="rounded-2xl border border-[#E4E5E2] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#7E797B]">
        Logs por superfície
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {surfaceCards.map((entry) => (
          <div
            key={entry.surface}
            className={`rounded-2xl border px-4 py-4 ${getSurfacePanelClassName(entry.surface)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em]">
              {entry.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#292829]">
              {entry.count}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-[#7E797B]">
        Quantidade de logs recentes por origem.
      </p>
    </article>
  );
}

function RankedList({
  title,
  emptyLabel,
  entries,
  renderEntryLabel,
  getItemClassName,
}: {
  title: string;
  emptyLabel: string;
  entries: TelemetryCountEntry[];
  renderEntryLabel?: (entry: TelemetryCountEntry) => ReactNode;
  getItemClassName?: (entry: TelemetryCountEntry) => string;
}) {
  const renderLabel =
    renderEntryLabel ?? ((entry: TelemetryCountEntry) => entry.label);
  const resolveItemClassName = getItemClassName ?? (() => "bg-[#F6F7F6]");

  return (
    <section className="rounded-2xl border border-[#E4E5E2] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#292829]">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#7E797B]">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.label}
              className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ${resolveItemClassName(entry)}`}
            >
              <div className="text-sm font-medium text-[#292829]">
                {renderLabel(entry)}
              </div>
              <span className="rounded-full bg-[#E1E2B4] px-3 py-1 text-xs font-semibold text-[#5B612A]">
                {entry.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatEventTimestamp(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

function EventTable({ events }: { events: PersistedTelemetryEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[#D6D8D2] bg-[#F6F7F6] p-6 text-sm text-[#7E797B]">
        Nenhum log persistido ainda. Depois que a busca e os toggles forem
        usados, esta tabela passa a mostrar os registros mais recentes.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E5E2] bg-white shadow-sm">
      <div className="border-b border-[#E4E5E2] px-5 py-4">
        <h2 className="text-lg font-semibold text-[#292829]">
          Eventos recentes
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E4E5E2] text-left text-sm">
          <thead className="bg-[#F6F7F6] text-[#7E797B]">
            <tr>
              <th className="px-5 py-3 font-medium">Recebido</th>
              <th className="px-5 py-3 font-medium">Evento</th>
              <th className="px-5 py-3 font-medium">Superfície</th>
              <th className="px-5 py-3 font-medium">Usuário</th>
              <th className="px-5 py-3 font-medium">Consulta</th>
              <th className="px-5 py-3 font-medium">Layer</th>
              <th className="px-5 py-3 font-medium">Data</th>
              <th className="px-5 py-3 font-medium">Contexto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEFEF]">
            {events.map((event, index) => (
              <tr key={`${event.receivedAt}-${event.eventName}-${index}`}>
                <td className="px-5 py-3 text-[#7E797B]">
                  {formatEventTimestamp(event.receivedAt)}
                </td>
                <td className="px-5 py-3 font-medium text-[#292829]">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEventBadgeClassName(event.eventName)}`}
                  >
                    {formatEventLabel(event.eventName)}
                  </span>
                </td>
                <td className="px-5 py-3 text-[#292829]">
                  {formatSurfaceLabel(event.surface)}
                </td>
                <td className="px-5 py-3 text-[#292829]">
                  {event.userEmail ?? "-"}
                </td>
                <td className="px-5 py-3 text-[#292829]">
                  {event.query ?? "-"}
                </td>
                <td className="px-5 py-3 text-[#292829]">
                  {formatLayerLabel(event)}
                </td>
                <td className="px-5 py-3 text-[#292829]">
                  {event.activeDateLabel ?? "-"}
                </td>
                <td className="px-5 py-3 text-[#7E797B]">
                  {[
                    event.selectionMethod,
                    event.resolvedLocationType,
                    event.action,
                    event.activeSection,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TelemetryDashboard({ data }: { data: TelemetryDashboardData }) {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F6F7F6] px-4 py-10 md:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[28px] bg-[linear-gradient(135deg,#E1E2B4_0%,#F6F7F6_55%,#FFFFFF_100%)] p-8 shadow-sm ring-1 ring-[#E4E5E2]">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#777E32]">
            Logs da plataforma
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#292829] md:text-4xl">
            Busca por local e uso de layers
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F5A5C] md:text-base">
            Painel operacional sobre os logs recentes gravados no Firestore.
            Esta tela usa uma amostra recente para destacar termos buscados,
            consultas sem resultado e os layers com mais ativações e aberturas
            de detalhamento.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="Eventos amostrados"
            value={String(data.sampledEventCount)}
            helper={data.sampledWindowLabel}
          />
          <SummaryCard
            title="Último recebimento"
            value={
              data.lastReceivedAt
                ? formatEventTimestamp(data.lastReceivedAt)
                : "-"
            }
            helper="Timestamp do evento mais recente salvo no backend"
          />
          <SurfaceSummaryCard entries={data.surfaceCounts} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RankedList
            title="Eventos por tipo"
            emptyLabel="Sem eventos suficientes para agregação."
            entries={data.eventCounts}
            renderEntryLabel={(entry) => (
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEventBadgeClassName(entry.label)}`}
              >
                {formatEventLabel(entry.label)}
              </span>
            )}
            getItemClassName={(entry) => getEventRowClassName(entry.label)}
          />
          <RankedList
            title="Consultas encontradas por camada e data"
            emptyLabel="Ainda não há buscas encontradas na amostra atual."
            entries={data.topSearchQueries}
          />
          <RankedList
            title="Consultas sem resultado por camada e data"
            emptyLabel="Nenhuma consulta sem resultado na amostra atual."
            entries={data.topNotFoundQueries}
          />
          <RankedList
            title="Layers mais ativados"
            emptyLabel="Nenhuma ativação de layer registrada ainda."
            entries={data.topActivatedLayers}
          />
          <RankedList
            title="Layers com mais detalhamento"
            emptyLabel="Nenhuma abertura de detalhamento registrada ainda."
            entries={data.topDetailedLayers}
          />
        </section>

        <EventTable events={data.recentEvents} />
      </div>
    </div>
  );
}
