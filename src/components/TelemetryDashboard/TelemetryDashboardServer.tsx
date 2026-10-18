import { resolveProductionTelemetryCollectionName } from "@/repositories/telemetry/telemetryRepository";
import { getTelemetryDashboardData } from "@/services/telemetry/telemetryService";
import { TelemetryDashboard, type TelemetrySource } from "./TelemetryDashboard";

export async function TelemetryDashboardServer({
  source = "current",
}: {
  source?: TelemetrySource;
} = {}) {
  const productionCollection = resolveProductionTelemetryCollectionName();
  const readsProduction = source === "production" && !!productionCollection;
  const data = await getTelemetryDashboardData(
    undefined,
    readsProduction ? productionCollection : undefined,
  );

  return (
    <TelemetryDashboard
      data={data}
      source={
        productionCollection
          ? readsProduction
            ? "production"
            : "current"
          : undefined
      }
    />
  );
}
