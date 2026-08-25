"use client";

import { useEffect, useState, type ReactNode } from "react";

const ANA_STATISTICS_ASSET =
  "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_2025";
const ANA_MAP_SAMPLE =
  "projects/ee-ulissesalencar17/assets/IC_monitor_seca_ANA/monitor_ana_2025_01";

const TERRITORY_PROPERTIES = [
  [
    "Nível do território",
    "NIVEL_AGRUPAMENTO",
    "Indica se a linha representa Brasil, região, estado, município, bioma, ASD ou semiárido.",
  ],
  [
    "Nome do território",
    "NOME_LOCAL",
    "Nome do território que será apresentado para a pessoa usuária.",
  ],
  [
    "Código do município",
    "CD_MUN",
    "Código oficial usado para localizar um município sem depender apenas do nome.",
  ],
  [
    "Unidade federativa",
    "NM_UF",
    "Identificação da unidade federativa usada nas consultas por estado e município.",
  ],
  ["Ano", "ano", "Ano ao qual a estatística pertence."],
  [
    "Data da imagem",
    "data_img",
    "Data usada para descobrir e consultar os períodos mensais.",
  ],
  [
    "Área total em hectares",
    "area_total_ha",
    "Área total do território, em hectares, usada como referência da análise.",
  ],
] as const;

const ANA_CLASSES = [
  [0, "Sem seca", "#FFFFFF"],
  [1, "Seca fraca", "#FCFF50"],
  [2, "Seca moderada", "#F4D48A"],
  [3, "Seca grave", "#D0782A"],
  [4, "Seca extrema", "#CA281B"],
  [5, "Seca excepcional", "#640E08"],
] as const;

interface GuideFieldProps {
  explanation: ReactNode;
  label: string;
  value: string;
}

function GuideField({ explanation, label, value }: GuideFieldProps) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="text-xs font-semibold text-stone-700">
        {label}
        <span className="mt-1 block break-all rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs font-normal text-stone-900">
          {value}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stone-600">
        {explanation}
      </p>
    </div>
  );
}

function GuideStep({ children }: { children: ReactNode }) {
  return <div className="mt-5 grid gap-3 md:grid-cols-2">{children}</div>;
}

const STEPS = [
  {
    title: "1. Identificação do índice",
    description:
      "Essas informações ajudam as pessoas a encontrar e compreender o índice no Monitoramento.",
    content: (
      <GuideStep>
        <GuideField
          label="Nome"
          value="TESTE — Monitor de Secas ANA 2025"
          explanation="É o título exibido no catálogo e no Monitoramento. Use TESTE enquanto estiver experimentando."
        />
        <GuideField
          label="Categoria"
          value="Dados Climáticos"
          explanation="Define em qual grupo o índice aparecerá no painel lateral do Monitoramento."
        />
        <div className="md:col-span-2">
          <GuideField
            label="Descrição"
            value="TESTE de cadastro usando estatísticas e mapas reais do Monitor de Secas ANA de 2025. Não publicar em produção."
            explanation="Explique o que o índice representa. Essa descrição não altera os dados nem o cálculo."
          />
        </div>
      </GuideStep>
    ),
  },
  {
    title: "2. Fonte das estatísticas",
    description:
      "Aqui se informa onde estão as porcentagens e áreas que serão mostradas para cada território.",
    content: (
      <>
        <GuideStep>
          <GuideField
            label="Organização das tabelas"
            value="Uma tabela com todos os períodos"
            explanation="Use quando uma única tabela contém todos os períodos. Neste exemplo, a mesma tabela contém os 12 meses de 2025."
          />
          <GuideField
            label="Granularidade dos períodos"
            value="Mensal"
            explanation="Descreve as linhas da tabela: o sistema encontrará janeiro a dezembro pela coluna data_img."
          />
          <div className="md:col-span-2">
            <GuideField
              label="Endereço da FeatureCollection"
              value={ANA_STATISTICS_ASSET}
              explanation="É o endereço exato da tabela no Google Earth Engine. O catálogo somente lê esse asset; não o copia nem o modifica."
            />
          </div>
        </GuideStep>
        <div className="mt-4 rounded-lg border border-[#D6D89A] bg-[#F4F5D8] p-4 text-sm leading-relaxed">
          <strong>Uma tabela ou várias?</strong> Se todos os períodos estão na
          mesma tabela, escolha
          <em className="mx-1">Uma tabela com todos os períodos</em> e cole o
          endereço dela. Se existe uma tabela para cada período, escolha
          <em className="mx-1">Uma tabela por período</em> e cole o endereço de
          <strong className="mx-1">uma delas</strong>, por exemplo
          <code className="mx-1 rounded bg-white px-1">estatisticas_2026</code>.
          O catálogo reconhece o período no nome, procura as tabelas irmãs na
          mesma pasta e mostra na tela o que reconheceu. Você não precisa
          escrever{" "}
          <code className="mx-1 rounded bg-white px-1">{"{year}"}</code>
          nem <code className="mx-1 rounded bg-white px-1">{"{month}"}</code> —
          e, se o nome for fora do padrão, existe a opção de escrever o template
          à mão.
          <br />
          <br />
          <strong>E a granularidade?</strong> Ela descreve as linhas da tabela,
          não o nome do arquivo. Uma tabela por ano pode guardar os doze meses
          daquele ano — é o caso do Monitor da ANA: deixe
          <em className="mx-1">Mensal</em> e os períodos saem da coluna
          data_img. Quando o próprio nome da tabela já traz o mês (
          <code className="mx-1 rounded bg-white px-1">..._2026_09</code>), a
          leitura mensal é a única possível e o catálogo fixa a granularidade
          para você.
        </div>
      </>
    ),
  },
  {
    title: "3. Propriedades territoriais",
    description:
      "São os nomes das colunas da tabela GEE. Normalmente os valores padrão já estarão corretos.",
    content: (
      <GuideStep>
        {TERRITORY_PROPERTIES.map(([label, value, explanation]) => (
          <GuideField
            key={label}
            label={label}
            value={value}
            explanation={explanation}
          />
        ))}
      </GuideStep>
    ),
  },
  {
    title: "4. Visualização do mapa",
    description:
      "A tabela fornece os números. Estes campos apontam para as imagens que serão desenhadas no mapa.",
    content: (
      <GuideStep>
        <GuideField
          label="Tipo"
          value="Image"
          explanation="Cada mapa mensal da ANA é uma imagem do Earth Engine. Também existem índices baseados em ImageCollection ou FeatureCollection."
        />
        <GuideField
          label="Organização das imagens"
          value="Um asset por período"
          explanation="Há uma imagem diferente para cada mês. O sistema monta o endereço usando o ano e o mês selecionados."
        />
        <div className="md:col-span-2">
          <GuideField
            label="Endereço do mapa de um período"
            value={ANA_MAP_SAMPLE}
            explanation="Cole o endereço de um mês que já existe. O catálogo reconhece 2025 e 01 no nome e passa a montar o endereço de cada período, exatamente como faz com as tabelas."
          />
        </div>
        <GuideField
          label="Banda"
          value="classe"
          explanation="É o nome da informação dentro da imagem que contém os números das classes de seca."
        />
        <GuideField
          label="Como o mapa vira classes"
          value="O pixel já é o código da classe"
          explanation="Os mapas da ANA guardam o número da classe em cada pixel. Quando a imagem tem valores contínuos — anomalia, índice, milímetros — escolha Separar por faixas de valor e informe os limites."
        />
      </GuideStep>
    ),
  },
  {
    title: "5. Classes e etapas finais",
    description:
      "Os índices das classes são encontrados automaticamente. Depois, você informa apenas os nomes e as cores.",
    content: (
      <>
        <div className="mt-5 overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100">
              <tr>
                <th className="px-3 py-2">Índice</th>
                <th className="px-3 py-2">Rótulo</th>
                <th className="px-3 py-2">Cor</th>
              </tr>
            </thead>
            <tbody>
              {ANA_CLASSES.map(([index, label, color]) => (
                <tr key={index} className="border-t border-stone-200">
                  <td className="px-3 py-2">{index}</td>
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2">
                    <span
                      className="mr-2 inline-block size-4 align-middle ring-1 ring-stone-300"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed text-stone-700">
          <li>
            <strong>1. Salvar rascunho:</strong> guarda o trabalho na área de
            rascunhos do sistema (Contentful), mas não o mostra no
            Monitoramento.
          </li>
          <li>
            <strong>2. Validar assets e gerar prévia:</strong> salva o rascunho,
            confere tabelas, períodos, classes e mapas no GEE e mostra uma
            prévia privada.
          </li>
          <li>
            <strong>3. Publicar:</strong> faz uma última validação e torna o
            índice disponível no Monitoramento.
          </li>
        </ol>
      </>
    ),
  },
] as const;

interface IndexCatalogGuideModalProps {
  onClose: () => void;
}

export function IndexCatalogGuideModal({
  onClose,
}: IndexCatalogGuideModalProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="index-catalog-guide-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#757B35]">
              Guia de preenchimento · etapa {step + 1} de {STEPS.length}
            </p>
            <h2
              id="index-catalog-guide-title"
              className="mt-1 text-xl font-bold"
            >
              {current.title}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{current.description}</p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-md px-3 py-1 text-xl font-bold hover:bg-stone-100"
            aria-label="Fechar guia"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {current.content}

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button
            type="button"
            className="cursor-pointer rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            disabled={step === 0}
            onClick={() => setStep((currentStep) => currentStep - 1)}
          >
            Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="cursor-pointer rounded-md bg-[#989F43] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setStep((currentStep) => currentStep + 1)}
            >
              Próxima etapa
            </button>
          ) : (
            <button
              type="button"
              className="cursor-pointer rounded-md bg-[#292829] px-4 py-2 text-sm font-semibold text-white"
              onClick={onClose}
            >
              Fechar guia
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
