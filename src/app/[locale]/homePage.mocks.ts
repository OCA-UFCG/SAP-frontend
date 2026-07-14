import {
  ActionPlanSectionI,
  PlatformModulesSectionI,
  ThematicAxesSectionI,
  WorkingGroupSectionI,
} from "@/utils/interfaces";
import { BLOCKS } from "@contentful/rich-text-types";

export const MOCK_ACTION_PLAN_CONTENT: ActionPlanSectionI = {
  title: "O plano em que o SAP está inserido",
  text: {
    json: {
      nodeType: BLOCKS.DOCUMENT,
      data: {},
      content: [
        {
          nodeType: BLOCKS.PARAGRAPH,
          data: {},
          content: [
            {
              nodeType: "text",
              value:
                'O SAP integra o Plano de Ação Brasileiro de Combate à Desertificação e Mitigação dos Efeitos da Seca (PAB-Brasil), lançado pelo MMA em dezembro de 2025. É o principal instrumento de implementação da PNCD, com horizonte até 2045. O SAP corresponde ao Objetivo 2.4 do plano, no eixo "Pesquisa, inovação e gestão da informação".',
              marks: [],
              data: {},
            },
          ],
        },
      ],
    },
  },
  stats: [
    { value: "38", label: "objetivos estratégicos" },
    { value: "186", label: "ações com indicadores" },
    { value: "5", label: "eixos temáticos" },
    { value: "18", label: "ministérios envolvidos" },
    { value: "1,6 mil+", label: "municípios em ASD" },
    { value: "39 mi", label: "pessoas beneficiadas" },
  ],
};

export const MOCK_THEMATIC_AXES_CONTENT: ThematicAxesSectionI = {
  title: "Eixos temáticos",
  axes: [
    {
      title: "Gestão sustentável e neutralidade da degradação da terra",
      executor: "MDA",
      executorActionsCount: 23,
      partners: ["MEC", "INCRA", "MS", "MMA", "MCID", "MDS"],
      actionsCount: 69,
    },
    {
      title: "Adaptação climática e mitigação dos efeitos da seca",
      executor: "ANA",
      executorActionsCount: 10,
      partners: ["MIDR", "DNOCS", "MMA", "MDS", "MCID"],
      actionsCount: 30,
    },
    {
      title: "Pesquisa, inovação e gestão da informação",
      executor: "MMA",
      executorActionsCount: 12,
      partners: ["MEC", "MCTI", "ANA", "INPE", "CEMADEN", "INSA"],
      actionsCount: 30,
      isSapAxis: true,
    },
    {
      title: "Melhoria das condições de vida da população",
      executor: "MMA",
      executorActionsCount: 17,
      partners: ["MRE", "MPI", "CNCD", "SRI", "SG/PR", "MEC"],
      actionsCount: 23,
    },
    {
      title: "Governança e fortalecimento institucional",
      executor: "MMA",
      executorActionsCount: 32,
      partners: ["IBAMA", "MIR", "MIDR", "DNOCS", "MPI"],
      actionsCount: 34,
    },
  ],
};

export const MOCK_WORKING_GROUP_CONTENT: WorkingGroupSectionI = {
  title: "Origem do grupo de trabalho",
  text: {
    json: {
      nodeType: BLOCKS.DOCUMENT,
      data: {},
      content: [
        {
          nodeType: BLOCKS.PARAGRAPH,
          data: {},
          content: [
            {
              nodeType: "text",
              value:
                "Em 12 e 13 de maio de 2026, a Comissão Nacional de Combate à Desertificação (CNCD), por meio de sua Câmara Técnica de Implementação do PAB-Brasil, deliberou pela criação do GT-SAP, em atenção ao Objetivo 3.4 do PAB. O objetivo do grupo foi construir, de forma colaborativa, a contribuição de cada instituição aos três módulos do SAP e elaborar um Protocolo de Cooperação Técnica.",
              marks: [],
              data: {},
            },
          ],
        },
      ],
    },
  },
  milestones: [
    {
      date: "29 ABR 2026",
      title: "Workshop interinstitucional",
      description:
        "Proposta metodológica e desenvolvimento da plataforma apresentados e validados.",
    },
    {
      date: "12 A 13 MAI 2026",
      title: "Deliberação da CNCD",
      description:
        "Criação do GT-SAP aprovada em plenária, em atenção ao Objetivo 3.4 do PAB.",
    },
    {
      date: "14 MAI 2026",
      title: "1ª Reunião do GT-SAP",
      description:
        "Realizada no CECAD (Brasília/DF), início formal da atuação do grupo.",
      isCurrent: true,
    },
  ],
};

export const MOCK_PLATFORM_MODULES_CONTENT: PlatformModulesSectionI = {
  title: "Módulos",
  modules: [
    {
      title: "Monitoramento",
      description:
        "Camadas oficiais de dados, integradas a partir de instituições do GT (ANA, CEMADEN, OCA, IBGE, INPE, Embrapa, CPTEC/INPE). Dados sobre seca, clima, meio ambiente e socioeconômicos.",
    },
    {
      title: "Análise",
      description:
        "Modelo multicritério com pesos configuráveis, com o objetivo de priorizar ações no território. Os pesos são pactuados coletivamente pelo GT-SAP.",
    },
    {
      title: "Comunicação",
      description:
        "Dois produtos automatizados em PDF: o Relatório Analítico, customizável por variável e escala (Brasil, estado ou município), e o Boletim Oficial, com validação institucional.",
    },
  ],
};
