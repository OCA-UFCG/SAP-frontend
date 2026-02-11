import Image from "next/image";

export function PartnersSection() {
  return (
    <section className="w-full bg-[#F6F7F6] py-12 px-20">
      <div
        className="
          max-w-360
          h-82
          flex
          flex-col
          gap-6
          opacity-100
          py-12
          px-20
        "
      >
        {/* Frame interno (título + texto) */}
        <div
          className="
            mx-auto
            w-full
            max-w-7xl
            h-29
            flex
            flex-col
            gap-6
          "
        >
          {/* Título */}
          <h2 className="w-33.75 h-11">
            <span
              className="
                block
                w-33.75
                h-9
                font-inter
                font-semibold
                text-[30px]
                leading-9
                tracking-[-0.0075em]
                text-[#292829]
              "
            >
              Parceiros
            </span>
          </h2>

          {/* Texto */}
          <div className="w-308.25 h-12">
            <p
              className="
                w-308.25
                h-6
                font-inter
                font-medium
                text-[16px]
                leading-[150%]
                tracking-[0]
                text-[#292829]
              "
            >
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
            width={121}
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
      </div>
    </section>
  );
}