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
  ac: "Acre",
  al: "Alagoas",
  ap: "Amapá",
  am: "Amazonas",
  ba: "Bahia",
  ce: "Ceará",
  df: "Distrito Federal",
  es: "Espírito Santo",
  go: "Goiás",
  ma: "Maranhão",
  mt: "Mato Grosso",
  ms: "Mato Grosso do Sul",
  mg: "Minas Gerais",
  pa: "Pará",
  pb: "Paraíba",
  pr: "Paraná",
  pe: "Pernambuco",
  pi: "Piauí",
  rj: "Rio de Janeiro",
  rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul",
  ro: "Rondônia",
  rr: "Roraima",
  sc: "Santa Catarina",
  sp: "São Paulo",
  se: "Sergipe",
  to: "Tocantins",
};

export const states = new Set(Object.values(statesObj));
export const ufs = new Set(Object.keys(statesObj));
