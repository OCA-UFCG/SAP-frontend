export const EmptyState = () => {
  return (
    <section className="w-full h-full bg-white flex flex-col">
      <div className="w-full flex-1 min-h-0 flex items-center justify-center px-6 py-10 md:py-16">
        <div className="w-full max-w-[1440px] flex justify-center">
          <div className="w-[260px] h-[210px] sm:w-[320px] sm:h-[260px] lg:w-[445px] lg:h-[360px] shrink-0">
            <svg width="100%" height="100%" aria-hidden="true">
              <use href="/sprite.svg#empty-state" />
            </svg>
          </div>
        </div>
      </div>

      <div className="w-full bg-[#E1E2B4]">
        <div className="w-full max-w-[1440px] mx-auto flex items-center justify-center p-[36px] min-h-[168px]">
          <p className="max-w-[656px] text-center font-bold text-[22px] sm:text-[28px] lg:text-[32px] leading-[150%] text-[#777E32]">
            Estamos trabalhando para disponibilizar este conteúdo em breve!
          </p>
        </div>
      </div>
    </section>
  );
};
