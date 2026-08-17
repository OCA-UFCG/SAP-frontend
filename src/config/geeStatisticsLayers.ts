export const GEE_STATISTICS_LAYER_IDS = ["carbonoembrapa", "anaseca"] as const;

export type GeeStatisticsLayerId = (typeof GEE_STATISTICS_LAYER_IDS)[number];

export function isGeeStatisticsLayerId(
  panelLayerId: string,
): panelLayerId is GeeStatisticsLayerId {
  return GEE_STATISTICS_LAYER_IDS.some((layerId) => layerId === panelLayerId);
}
