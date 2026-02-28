import { SapChannelI } from "./interfaces";

export const channels: SapChannelI[] = [
  // Para reativar outras redes, descomente os blocos abaixo.
  // {
  //   name: "@mmeioambiente",
  //   href: "https://www.youtube.com/channel/UCrcru3HDT3g1XIEJVk0NARA",
  //   icon: "youtube",
  //   size: 32,
  // },

  // {
  //   name: "@mmeioambiente",
  //   href: "https://www.facebook.com/ministeriomeioambiente/?locale=pt_BR",
  //   icon: "facebook",
  //   size: 32,
  // },

  {
    name: "@observatorio.caatinga",
    href: "https://www.instagram.com/observatorio.caatinga/",
    icon: "instagram",
    size: 32,
  },

  // {
  //   name: "@mmeioambiente",
  //   href: "https://www.linkedin.com/company/ministério-do-meio-ambiente/?originalSubdomain=br",
  //   icon: "linkedin",
  //   size: 32,
  // },
];

export const sapEmail = "sap.ufcg@gmail.com";

export const statesObj = {
  ac: "acre",
  al: "alagoas",
  ap: "amapa",
  am: "amazonas",
  ba: "bahia",
  ce: "ceara",
  df: "distrito federal",
  es: "espirito santo",
  go: "goias",
  ma: "maranhao",
  mt: "mato grosso",
  ms: "mato grosso do sul",
  mg: "minas gerais",
  pa: "para",
  pb: "paraiba",
  pr: "parana",
  pe: "pernambuco",
  pi: "piaui",
  rj: "rio de janeiro",
  rn: "rio grande do norte",
  rs: "rio grande do sul",
  ro: "rondonia",
  rr: "roraima",
  sc: "santa catarina",
  sp: "sao paulo",
  se: "sergipe",
  to: "tocantins",
};

export const states = new Set(Object.values(statesObj));
export const ufs = new Set(Object.keys(statesObj));
