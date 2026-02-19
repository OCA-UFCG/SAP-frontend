import Image from "next/image";

export function PartnersSection() {
  return (
    <section className="w-full bg-[#F6F7F6]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-20 py-12 flex flex-col md:min-h-[328px]">

        {/* Texto */}
        <div className="flex flex-col gap-6 w-full max-w-5xl text-center md:text-left items-center md:items-start">
          <h2 className="text-2xl md:text-3xl font-semibold text-[#292829]">
            Parceiros
          </h2>

          <p className="text-base leading-relaxed text-[#292829] max-w-2xl">
            Conheça nossos parceiros aos quais em colaboração conosco nos apoiam no desenvolvimento do Sistema de Alerta Precoce.
          </p>
        </div>

        {/* Logos */}
        <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 mt-8 md:mt-10 lg:mt-12">
          <img src="/partners/oca.png" className="h-[78px] w-auto object-contain" />
          <img src="/partners/insa.png" className="h-[79px] w-auto object-contain" />
          <img src="/partners/mma.png" className="h-[78px] w-auto object-contain" />
          <img src="/partners/bndes.png" className="h-[78px] w-auto object-contain" />
          <img src="/partners/ufcg.png" className="h-[78px] w-auto object-contain" />
        </div>

      </div>
    </section>
  );
}
