import { Document } from "@contentful/rich-text-types";
import type {
  CompactTerritorialAnalysisDataset,
  LayerAnalysisConfig,
} from "@/utils/analysis";
import type { PublishedGeeStatisticsSource } from "@/contracts/geeStatistics";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type { PanelLayerForecastFacets } from "@/contracts/panelLayerForecast";
import type { PanelLayerSourceGroup } from "@/contracts/panelLayerSourceGroup";

export interface DataCardsI {
  noDroughtAreaValue: number;
  watchAreaValue: number;
  recoveryAreaValue: number;
}
export interface SedesChannelI {
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

export interface ThematicAxisI {
  title: string;
  description?: string;
  executor: string;
  executorActionsCount: number;
  partners: string[];
  actionsCount: number;
  isSedesAxis?: boolean;
}

export interface ActionPlanSectionI {
  title: string;
  text: {
    json: Document;
  };
  stats: StatCardI[];
  axesTitle: string;
  axes: ThematicAxisI[];
}

export interface TimelineMilestoneI {
  date: string;
  title: string;
  description: string;
  isCurrent?: boolean;
}

export interface WorkingGroupSectionI {
  title: string;
  text: {
    json: Document;
  };
  milestones: TimelineMilestoneI[];
}

export interface PlatformModuleI {
  /** Chave dos textos em `PlatformModulesSection.modules.<id>`. */
  id: "monitoring" | "communication" | "analysis";
  image: string;
  href: string;
}

export interface PlatformModulesSectionI {
  modules: PlatformModuleI[];
}

/** Novidade da home; título e texto ficam em `NewsSection.items.<id>`. */
export interface HomeNewsItemI {
  id: string;
  module: PlatformModuleI["id"];
  /** Data no formato AAAA-MM-DD; sem ela o card não mostra o calendário. */
  date?: string;
  href: string;
}

/** Card da faixa de números logo abaixo do carrossel. */
export interface HomeHighlightI {
  value: string;
  label: string;
  description: string;
}

/** Textos do card de uma ferramenta; o link fica no código. */
export interface HomeToolTextI {
  id: PlatformModuleI["id"];
  name: string;
  /** Foto do Contentful; vazia, o card usa a foto do código. */
  image?: string;
  shortText: string;
  /** Texto do "Ver mais"; vazio, o card não mostra o "Ver mais". */
  fullText?: string;
  buttonText: string;
}

/** Card de "Recursos em destaque" / "O que há de novo?". */
export interface HomeFeatureI {
  id: string;
  module: PlatformModuleI["id"];
  title: string;
  description: string;
  href: string;
  /** Data no formato AAAA-MM-DD. */
  date?: string;
}

export interface HomeTestimonialI {
  quote: string;
  author: string;
  authorDetail?: string;
  /** Foto do Contentful; sem ela, o card fica com a cor do design. */
  image?: string;
}

/** Textos editáveis da home, já resolvidos para o idioma da página. */
export interface HomeTextsI {
  highlights: HomeHighlightI[];
  tools: { title: string; subtitle?: string; items: HomeToolTextI[] };
  publicPolicy: {
    title: string;
    text: string;
    buttonText: string;
    /** Fotos da colagem, na ordem dos espaços; o que faltar usa a do código. */
    images?: string[];
  };
  features: { title: string; items: HomeFeatureI[] };
  testimonials: { title: string; items: HomeTestimonialI[] };
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
  description?: string;
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
  channels: SedesChannelI[];
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
  LegacyImageDataMap | CompactTerritorialAnalysisDataset;

export interface MunicipalReportSeriesConfig {
  schemaVersion: 1;
  datasetVersion: string;
  shardCount: number;
  shardStrategy: "ibge-modulo";
  firstPeriod: string;
  lastPeriod: string;
}

export interface PanelLayerI {
  sys: {
    id: string;
  };
  name: string;
  id: string;
  description: string;
  panelPosition?: number | null;
  previewMap?: {
    url: string;
    title?: string;
    width?: number;
    height?: number;
  } | null;
  imageData: ImageDataConfig;
  minScale?: number;
  maxScale?: number;
  category?: string;
  timeScale?: string;
  reportSeriesConfig?: MunicipalReportSeriesConfig | null;
  statisticsSource?: PublishedGeeStatisticsSource | null;
  /** Texto do Relatório Automático escrito no catálogo, quando existe. */
  reportConfig?: PublishedPanelLayerReportConfig | null;
  /** Filtros da previsão climática, quando o índice é uma delas. */
  forecastFacets?: PanelLayerForecastFacets | null;
  /** O grupo do mesmo índice com outras fontes de dados, quando existe. */
  sourceGroup?: PanelLayerSourceGroup | null;
  tileApiPath?: string;
  municipalAnalysisApiPath?: string;
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
  tileApiPath?: string;
  municipalAnalysisApiPath?: string;
  statisticsSource?: PublishedGeeStatisticsSource | null;
}

export interface IMapId {
  mapid: string;
  token: string;
  urlFormat: string;
}
