export const EmptyState = () => {
  return (
    <section className="w-full flex justify-center">
      <div className="w-full max-w-[1440px] flex flex-col items-center justify-center gap-[80px] py-[120px]">

        <div className="w-[445px] h-[360px] shrink-0">
          <svg width="100%" height="100%" aria-hidden="true">
            <use href="/sprite.svg#empty-state" />
          </svg>
        </div>

        <div className="w-full bg-[#E1E2B4] flex items-center justify-center p-[36px] min-h-[168px]">
          <p className="max-w-[656px] text-center font-bold text-[32px] leading-[150%] text-[#777E32]">
            Estamos trabalhando para disponibilizar este conteúdo em breve!
          </p>
        </div>

      </div>
    </section>
  )
}