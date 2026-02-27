import { Document } from "@contentful/rich-text-types";
export interface FooterI {
  name: string;
  id: string;
  path: string;
  appears: boolean;
  childrenCollection?: { items: FooterI[] };
}

export interface SapChannelI {
  name: string;
  href: string;
  icon: string;
  size?: number;
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
