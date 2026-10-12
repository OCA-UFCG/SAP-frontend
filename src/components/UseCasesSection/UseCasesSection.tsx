import { HomeCarousel } from "@/components/HomeCarousel/HomeCarousel";
import { QuoteIcon } from "@/components/HomeIcons/HomeIcons";
import { HomeTestimonialI } from "@/utils/interfaces";

type Props = {
  id?: string;
  title: string;
  items: HomeTestimonialI[];
};

/** "O que dizem sobre o SEDES": um card por depoimento. */
export const UseCasesSection = ({ id, title, items }: Props) => {
  if (!items.length) return null;

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-[#21240F]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:px-20">
        <h2 className="pb-2 font-open-sans text-[30px] font-semibold leading-9 tracking-[-0.0075em] text-[#F8F7F8]">
          {title}
        </h2>

        <HomeCarousel variant="dark">
          {items.map((item) => (
            <figure
              key={`${item.author}-${item.quote}`}
              className="flex h-full flex-col rounded-lg bg-[#F8F7F8] p-6 font-inter text-sm leading-6 text-[#292829]"
            >
              <QuoteIcon size={20} className="mb-3 -ml-1 text-[#989F43]" />
              <blockquote>{item.quote}</blockquote>
              <figcaption className="mt-auto pt-4">
                <span className="block font-semibold">{item.author}</span>
                {item.authorDetail && (
                  <span className="block">{item.authorDetail}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </HomeCarousel>
      </div>
    </section>
  );
};

export default UseCasesSection;
