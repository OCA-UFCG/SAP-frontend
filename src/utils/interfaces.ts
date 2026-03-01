import { Document } from "@contentful/rich-text-types";
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
export interface BrazilianState {
  name: string;
  uf: string;
}

export interface SearchResultI {
  key: string;
  label: string;
}

export interface SearchButtonI {
  onClick: () => void
  children: React.ReactNode
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

export interface PartnersSectionQuery {
  cabealhoSeesCollection: {
    items: SectionHeaderI[];
  };
  partnersCollection: {
    items: PartnerI[];
  };
}

export interface SecaoSobreI {
  sys: {
    id: string;
  };
  title: string;
  text: {
    json: Document;
  };
  image: {
    url: string;
    title?: string;
    width?: number;
    height?: number;
  };
}

export interface AboutPageQuery {
  secaoSobreCollection: {
    items: SecaoSobreI[];
  };
  cabealhoSeesCollection: {
    items: SectionHeaderI[];
  };
  partnersCollection: {
    items: PartnerI[];
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
  channels: SapChannelI[]
  size: number 
  displayName?: boolean
}
