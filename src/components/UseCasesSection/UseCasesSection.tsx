import Image from "next/image";
import { PersonIcon, QuoteIcon } from "@/components/HomeIcons/HomeIcons";
import { HomeTestimonialI } from "@/utils/interfaces";
import { Reveal, Spotlight } from "@/components/HomeMotion/HomeMotion";
import { revealOrder } from "@/components/HomeMotion/revealOrder";

type Props = {
  id?: string;
  title: string;
  items: HomeTestimonialI[];
};

type CardStyle = {
  /** Posição e fundo do card no mosaico. */
  card: string;
  /** Cor do ícone de aspas. */
  quote: string;
  /** Cor do texto. */
  text: string;
  /** Card grande: aspas maiores e texto no pé do card. */
  large?: boolean;
};

// Com foto, qualquer card fica com texto claro sobre um degradê escuro.
const PHOTO_COLORS = { quote: "text-[#CCCF87]", text: "text-[#F8F7F8]" };

// Mosaico do design da home (Figma), na ordem dos depoimentos: no alto, o card
// grande (com foto no design), dois cards empilhados e um card alto; embaixo,
// dois cards largos.
const TOP_CARDS: CardStyle[] = [
  {
    card: "min-h-[360px] bg-[#3F4324] md:col-span-2 lg:col-span-1 lg:row-span-2",
    ...PHOTO_COLORS,
    large: true,
  },
  {
    card: "bg-[#F8F7F8] lg:col-start-2 lg:row-start-1",
    quote: "text-[#989F43]",
    text: "text-[#292829]",
  },
  {
    card: "bg-[#5B612A] lg:col-start-2 lg:row-start-2",
    quote: "text-[#F0F0D7]",
    text: "text-[#F8F7F8]",
  },
  {
    card: "bg-[#B4BA61] md:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1",
    quote: "text-[#3F4324]",
    text: "text-[#292829]",
  },
];

// Os cards de baixo alternam entre os dois tons claros quando há mais de seis
// depoimentos.
const BOTTOM_CARDS: CardStyle[] = [
  { card: "bg-[#F8F7ED]", quote: "text-[#989F43]", text: "text-[#292829]" },
  { card: "bg-[#F8F7F8]", quote: "text-[#989F43]", text: "text-[#292829]" },
];

const TestimonialCard = ({
  item,
  style,
  order,
}: {
  item: HomeTestimonialI;
  style: CardStyle;
  /** Posição na cascata de entrada. */
  order: number;
}) => {
  const colors = item.image ? PHOTO_COLORS : style;
  // Sobre a foto o texto vai para o pé do card, onde o degradê é mais escuro.
  const atBottom = style.large || !!item.image;

  return (
    // O brilho que segue o mouse vem do Spotlight da seção (spotlight-card).
    <figure
      data-spotlight
      style={revealOrder(order)}
      className={`reveal-item spotlight-card group relative flex flex-col overflow-hidden rounded-lg p-6 font-inter text-sm leading-6 transition-[translate,scale,box-shadow] duration-300 ease-out hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] motion-safe:hover:-translate-y-1.5 motion-safe:hover:scale-[1.02] ${style.card} ${colors.text}`}
    >
      {item.image && (
        <>
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 625px"
            className="object-cover transition-[scale] duration-700 ease-out motion-safe:group-hover:scale-105"
          />
          {/* Card baixo tem pouca altura para o degradê: a foto escurece mais. */}
          <div
            className={`absolute inset-0 bg-[linear-gradient(0deg,#000000_0%,rgba(0,0,0,0)_112.5%)] ${style.large ? "" : "bg-black/40"}`}
          />
        </>
      )}

      <div className="relative flex flex-1 flex-col gap-4">
        <QuoteIcon
          size={style.large ? 40 : 24}
          className={`shrink-0 origin-bottom-left transition-[rotate,scale] duration-300 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-125 ${colors.quote} ${atBottom ? "mt-auto" : ""}`}
        />
        <blockquote>{item.quote}</blockquote>
        <figcaption
          className={`flex items-center gap-2 ${atBottom ? "" : "mt-auto"}`}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#E1E2B4] p-2 text-[#5B612A]">
            <PersonIcon size={32} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-bold">{item.author}</span>
            {item.authorDetail && <span>{item.authorDetail}</span>}
          </span>
        </figcaption>
      </div>
    </figure>
  );
};

/** "O que dizem sobre o SEDES": os depoimentos num mosaico de cards. */
export const UseCasesSection = ({ id, title, items }: Props) => {
  if (!items.length) return null;

  const top = items.slice(0, TOP_CARDS.length);
  const bottom = items.slice(TOP_CARDS.length);

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-[#21240F]">
      <Reveal className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:gap-9 lg:px-20">
        <h2 className="reveal-item pb-2 font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#F8F7F8]">
          {title}
        </h2>

        <Spotlight className="flex flex-col gap-6 lg:gap-9">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[625fr_279.5fr_327.5fr] lg:grid-rows-[minmax(248px,auto)_minmax(248px,auto)]">
            {top.map((item, index) => (
              <TestimonialCard
                key={`${item.author}-${item.quote}`}
                item={item}
                style={TOP_CARDS[index]}
                order={index + 1}
              />
            ))}
          </div>

          {bottom.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[482fr_774fr] lg:auto-rows-[minmax(200px,auto)]">
              {bottom.map((item, index) => (
                <TestimonialCard
                  key={`${item.author}-${item.quote}`}
                  item={item}
                  style={BOTTOM_CARDS[index % BOTTOM_CARDS.length]}
                  order={top.length + index + 1}
                />
              ))}
            </div>
          )}
        </Spotlight>
      </Reveal>
    </section>
  );
};

export default UseCasesSection;
