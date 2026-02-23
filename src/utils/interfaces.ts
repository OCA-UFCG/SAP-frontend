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
