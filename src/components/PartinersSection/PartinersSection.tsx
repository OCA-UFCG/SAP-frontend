import Image from "next/image";

export function PartnersSection() {
  return (
    <section className="w-[1440px] h-[328px] opacity-100 gap-6 pt-12 pr-20 pb-12 pl-20 bg-[#F6F7F6]">
      <div
        className="w-[1280px] h-[116px] opacity-100 gap-6">
        {/* Título */}
        <h2 className="w-[135px] h-[44px] opacity-100 gap-2.5 pb-2">
          <span
            className="w-[135px] h-[36px] font-semibold text-[30px] leading-[36px] tracking-[-0.75%] text-[#292829] opacity-100">
            Parceiros
          </span>
        </h2>
        {/* Texto */}
        <div className="w-[1233px] h-[48px] opacity-100 gap-6">
          <p
            className="w-[1233px] h-[24px] font-medium text-[16px] leading-[150%] tracking-normal text-[#292829] opacity-100">
            Conheça nossos parceiros aos quais em colaboração conosco nos apoiam
            no desenvolvimento do Sistema de Alerta Precoce.
          </p>
        </div>
      </div>

      {/* Logos dos parceiros */}
      <div
        className="
            mx-auto
            flex
            items-center
            gap-8
          "
      >
        {/* Logo OCA */}
        <img
          src="/partners/oca.png"
          alt="OCA"
          width={78}
          height={78}
        />

        {/* Logo INSA */}
        <img
          src="/partners/insa.png"
          alt="INSA"
          width={221}
          height={79}
        />

        {/* Logo MMA */}
        <img
          src="/partners/mma.png"
          alt="MMA"
          width={319}
          height={78}
          className="rounded-lg"
        />

        {/* Logo BNDES */}
        <img
          src="/partners/bndes.png"
          alt="BNDES"
          width={270}
          height={78}
        />

        {/* Logo UFCG */}
        <img
          src="/partners/ufcg.png"
          alt="UFCG"
          width={248}
          height={78}
        />
      </div>

    </section>
  );
}