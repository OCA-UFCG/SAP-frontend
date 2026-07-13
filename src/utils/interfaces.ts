import { Document } from "@contentful/rich-text-types";
import type {
  CompactTerritorialAnalysisDataset,
  LayerAnalysisConfig,
} from "@/utils/analysis";

export interface DataCardsI {
  noDroughtAreaValue: number;
  watchAreaValue: number;
  recoveryAreaValue: number;
}
export interface FooterI {
  id: string;
  name: string;
  path: string;
  appears: boolean;
}

export interface SapChannelI {
  name: string;
  href: string;
  icon: string;
  size?: number;
}

export interface StatusItemI {
  id: string;
  label: string;
  value: number;
  color: string;
  checked?: boolean;
}

export interface IMainBanner {
  title: string;
  subtitle: string;
  linkText: string;
  link: string;
  image: {
    url: string;
  };
}

export interface TabsSectionI {
  identifier: string;
  title: string;
  text: {
    json: Document;
  };
  image: {
    url: string;
    title?: string;
  };
  includeInAboutSap: boolean;
}

export interface AboutSectionI {
  sys: {
    id: string;
  };
  title: string;
  text: {
    json: Document;
  };
  image: {
    url: string;
    title: string;
    width: number;
    height: number;
  };
}
export interface StatCardI {
  value: string;
  label: string;
}

export interface ActionPlanSectionI {
  title: string;
  text: {
    json: Document;
  };
  stats: StatCardI[];
}

export interface ThematicAxisI {
  title: string;
  executor: string;
  executorActionsCount: number;
  partners: string[];
  actionsCount: number;
  isSapAxis?: boolean;
}

export interface ThematicAxesSectionI {
  title: string;
  axes: ThematicAxisI[];
}

export interface TimelineMilestoneI {
  date: string;
  title: string;
  description: string;
  isCurrent?: boolean;
}

export interface WorkingGroupSectionI {
  eyebrow: string;
  title: string;
  text: {
    json: Document;
  };
  milestones: TimelineMilestoneI[];
}

export interface PlatformModuleI {
  title: string;
  description: string;
}

export interface PlatformModulesSectionI {
  title: string;
  modules: PlatformModuleI[];
}

export interface BrazilianState {
  name: string;
  uf: string;
}

export interface SearchResultI {
  key: string;
  label: string;
}

export interface SearchButtonI {
  onClick: () => void;
  children: React.ReactNode;
}
export interface SectionHeaderI {
  sys: {
    id: string;
  };
  title: string;
  description: string;
}
export interface PartnerI {
  sys: {
    id: string;
  };
  name: string;
  image: {
    url: string;
    title?: string;
    width?: number;
    height?: number;
  };
}

export interface ISection {
  name: string;
  id: string;
  path: string;
  appears: boolean;
  childrenCollection?: { items: ISection[] };
}

export interface ISections {
  [key: string]: ISection;
}

export interface SocialChannelsI {
  channels: SapChannelI[];
  size: number;
  displayName?: boolean;
}

export interface SecaStatus {
  "sem-seca": number;
  observacao: number;
  atencao: number;
  alerta: number;
  "recuperacao-total": number;
  "recuperacao-parcial": number;
}

export interface SecaData {
  status: SecaStatus;
  acontecendo: string;
  impacto: string[];
}

export interface SecaRootObject {
  [key: string]: SecaData;
}

type Direction = "up" | "down" | "right" | "left";
export interface ChevronI {
  open: boolean;
  from: Direction;
  to: Direction;
  size?: number;
}
export interface IImageParam {
  color: string;
  pixelLimit?: number;
  label: string;
}

export interface LegacyImageDataEntry {
  default: boolean;
  year?: string;
  imageId: string;
  imageParams: IImageParam[];
  analysis?: LayerAnalysisConfig;
}

export type LegacyImageDataMap = Record<string, LegacyImageDataEntry>;

export type ImageDataConfig =
  | LegacyImageDataMap
  | CompactTerritorialAnalysisDataset;

export interface PanelLayerI {
  sys: {
    id: string;
  };
  name: string;
  id: string;
  description: string;
  panelPosition?: number | null;
  previewMap: {
    url: string;
    title?: string;
    width?: number;
    height?: number;
  };
  imageData: ImageDataConfig;
  minScale?: number;
  maxScale?: number;
  category?: string;
  timeScale?: string;
}

export interface IEEInfo {
  id: string;
  name: string;
  description: string;
  extraInfo?: string[];
  checked?: boolean;
  measurementUnit: string;
  poster: { fields: { file: { url: string } } } | string;
  minScale?: number;
  maxScale?: number;
  imageData: ImageDataConfig;
  type: string;
}

export interface IMapId {
  mapid: string;
  token: string;
  urlFormat: string;
}
