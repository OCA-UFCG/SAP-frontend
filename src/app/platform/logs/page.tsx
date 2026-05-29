import { TelemetryDashboard } from "@/components/TelemetryDashboard/TelemetryDashboard";
import { getTelemetryDashboardData } from "@/services/telemetry/telemetryService";

export default async function PlatformLogsPage() {
  const data = await getTelemetryDashboardData();

  return <TelemetryDashboard data={data} />;
}
