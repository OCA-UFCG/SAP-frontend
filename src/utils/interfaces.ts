import { Document } from "@contentful/rich-text-types";

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
