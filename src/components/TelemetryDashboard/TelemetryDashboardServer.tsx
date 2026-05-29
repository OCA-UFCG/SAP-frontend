import { getTelemetryDashboardData } from "@/services/telemetry/telemetryService";
import { TelemetryDashboard } from "./TelemetryDashboard";

export async function TelemetryDashboardServer() {
  const data = await getTelemetryDashboardData();

  return <TelemetryDashboard data={data} />;
}
