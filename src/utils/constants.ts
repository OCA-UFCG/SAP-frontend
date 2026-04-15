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

export const maps_legends = {
  cdi: [
      {label: "Sem seca", classification: "0", color: '#E4E5E2'},
      {label: "Observação", classification: "1", color: '#FFCC80'},
      {label: "Atenção", classification: "2", color: '#FB8C00'},
      {label: "Seca severa", classification: "3", color: '#BF360C'},
      {label: "Recuperação total", classification: "4", color: '#A3B18A'},
      {label: "Recuperação parcial", classification: "5", color: '#588157'},
    ],
}

export const states = new Set(Object.values(statesObj));
export const ufs = new Set(Object.keys(statesObj));

export const classificationMeta = {
  "sem-seca": {
    label: "Sem seca",
    color: "#989F43",        
    bg: "#F0F0D7",           
    border: "#989F43",
  },

  "observacao": {
    label: "Observação",
    color: "#FFCC80",
    bg: "#FFF3E0",
    border: "#FFB74D",
  },

  "atencao": {
    label: "Atenção",
    color: "#FB8C00",
    bg: "#FFE0B2",
    border: "#EF6C00",
  },

  "alerta": {
    label: "Seca severa",
    color: "#BF360C",
    bg: "#FDE0DC",
    border: "#A9320A",
  },

  "recuperacao-total": {
    label: "Recuperação total",
    color: "#A3B18A",
    bg: "#EEF2E6",
    border: "#8A9A74",
  },

  "recuperacao-parcial": {
    label: "Recuperação parcial",
    color: "#588157",
    bg: "#E6EEE8",
    border: "#4A6F4A",
  },
} as const;

export type ClassificationKey = keyof typeof classificationMeta;

export const TIER_CONFIG = {
  "sem-seca": { label: "Sem seca", color: "#F0F0D7" },
  observacao: { label: "Observação", color: "#FECB89" },
  atencao: { label: "Atenção", color: "#FC8F23" },
  alerta: { label: "Seca severa", color: "#B52C08" },
  "recuperacao-total": { label: "Recuperação Total", color: "#B4BA61" },
  "recuperacao-parcial": { label: "Recuperação Parcial", color: "#5B612A" },
};
