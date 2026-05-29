const SUMMARY_SKELETON_IDS = ["summary-1", "summary-2", "summary-3"];
const RANKED_LIST_SKELETON_IDS = ["list-1", "list-2", "list-3", "list-4"];
const TABLE_ROW_SKELETON_IDS = ["row-1", "row-2", "row-3", "row-4"];

export function TelemetryDashboardLoading() {
  return (
    <div
      data-testid="telemetry-dashboard-loading"
      aria-busy="true"
      className="min-h-[calc(100vh-64px)] bg-[#F6F7F6] px-4 py-10 md:px-8 lg:px-12"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="rounded-[28px] bg-[linear-gradient(135deg,#E1E2B4_0%,#F6F7F6_55%,#FFFFFF_100%)] p-8 shadow-sm ring-1 ring-[#E4E5E2]">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#777E32]">
            Carregando auditoria
          </p>
          <div className="h-4 w-32 animate-pulse rounded-full bg-[#D1D4A6]" />
          <div className="mt-4 h-10 w-full max-w-2xl animate-pulse rounded-2xl bg-white/70" />
          <div className="mt-3 h-5 w-full max-w-3xl animate-pulse rounded-full bg-white/60" />
          <div className="mt-2 h-5 w-4/5 max-w-2xl animate-pulse rounded-full bg-white/60" />
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {SUMMARY_SKELETON_IDS.map((entryId) => (
            <article
              key={entryId}
              className="rounded-2xl border border-[#E4E5E2] bg-white p-5 shadow-sm"
            >
              <div className="h-4 w-28 animate-pulse rounded-full bg-[#E4E5E2]" />
              <div className="mt-4 h-10 w-24 animate-pulse rounded-2xl bg-[#EFF0ED]" />
              <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#EFF0ED]" />
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {RANKED_LIST_SKELETON_IDS.map((entryId) => (
            <section
              key={entryId}
              className="rounded-2xl border border-[#E4E5E2] bg-white p-5 shadow-sm"
            >
              <div className="h-6 w-44 animate-pulse rounded-full bg-[#E4E5E2]" />
              <div className="mt-5 space-y-3">
                {TABLE_ROW_SKELETON_IDS.map((rowId) => (
                  <div
                    key={`${entryId}-${rowId}`}
                    className="flex items-center justify-between gap-4 rounded-xl bg-[#F6F7F6] px-4 py-3"
                  >
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-white" />
                    <div className="h-7 w-12 animate-pulse rounded-full bg-[#E1E2B4]" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className="rounded-2xl border border-[#E4E5E2] bg-white p-6 shadow-sm">
          <div className="h-6 w-40 animate-pulse rounded-full bg-[#E4E5E2]" />
          <div className="mt-6 space-y-3">
            {TABLE_ROW_SKELETON_IDS.map((rowId) => (
              <div
                key={rowId}
                className="h-12 animate-pulse rounded-2xl bg-[#F6F7F6]"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
