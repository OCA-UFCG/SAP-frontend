export interface IDroughtDataset {
  id: number;
  title: string;
  description: string;
  image?: string;
  fileRef?: string;
}

export const DROUGHT_DATASETS: IDroughtDataset[] = [
  {
    id: 1,
    title: "CDI",
    description: "breve descrição do dataset",
    fileRef: "data/CDI_Janeiro_2024_Vetores.json",
  },
  {
    id: 2,
    title: "Monitor de seca",
    description: "breve descrição do dataset",
    fileRef: "data/CDI_Janeiro_2024_Vetores.json",
  },
  {
    id: 3,
    title: "Monitor de seca",
    description: "breve descrição do dataset",
    fileRef: "data/CDI_Janeiro_2024_Vetores.json",
  },
];

function InfoIcon() {
  return (
    <svg width="16" height="16" aria-hidden>
      <use href="/sprite.svg#info" />
    </svg>
  );
}

export function DroughtDataset({ card }: { card: IDroughtDataset }) {
  return (
    <div className="flex flex-row items-start w-full bg-white border border-[#EFEFEF] shadow-sm rounded-lg overflow-hidden shrink-0">
      <div className="flex flex-col items-start w-full">

        {/* card header */}
        <div className="flex flex-row items-center pr-4 gap-2 w-full" style={{ height: 126 }}>
          <div className="relative shrink-0" style={{ width: "115.51px", height: 126 }}>
            {card.image ? (
              <img
                src={card.image}
                alt={card.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[#E4E5E2]" />
            )}
          </div>

          <div className="flex flex-col items-start py-2 gap-[6px] flex-1" style={{ height: 126 }}>
            <div className="flex items-center w-full" style={{ height: 24 }}>
              <span
                className="w-full font-semibold text-base text-[#292829]"
                style={{ fontFamily: "Inter", letterSpacing: "-0.015em" }}
              >
                {card.title}
              </span>
            </div>
            <div className="flex items-center w-full" style={{ height: 20 }}>
              <span
                className="w-full text-sm font-normal text-[#7E797B] line-clamp-1"
                style={{ fontFamily: "Inter" }}
              >
                {card.description}
              </span>
            </div>
          </div>
        </div>

        {/* card footer */}
        <div
          className="flex flex-row items-center w-full p-4 gap-4 border-t border-[#EFEFEF]"
          style={{ height: 72 }}
        >
          <button
            type="button"
            className="flex flex-row justify-center items-center px-4 py-2 gap-[10px] flex-1 h-10 bg-[#989F43] rounded-[6px]"
          >
            <span
              className="text-sm font-normal text-white"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              Analisar
            </span>
          </button>

          <button
            type="button"
            className="box-border flex flex-row justify-center items-center p-2 gap-2 w-10 h-10 bg-white border border-slate-200 rounded-[6px] shrink-0"
            aria-label="Mais informações"
          >
            <InfoIcon />
          </button>
        </div>
      </div>
    </div>
  );
}