import { Document } from "@contentful/rich-text-types";

export interface StatusItemI {
    id: string;
    label: string;
    value: number; 
    color: `#${string}`; //HEX's format needed in the graphic 
    textColor: `#${string}`;
    checked?: boolean;
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