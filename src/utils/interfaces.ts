import { Document } from "@contentful/rich-text-types";
export interface DataCardsValueProps {
    noDroughtAreaValue: number 
    watchAreaValue: number
    recoveryAreaValue: number
}
export interface IMainBanner {
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonUrl: string;
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