"use client";

import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";

const sectionLabel: Partial<Record<PlatformSection, string>> = {
	multicriteria: "Análise Multicritério",
	forecast: "Previsão"
};

export interface ComingSoonContextProps {
	activeSection: PlatformSection;
}

/**
 * ComingSoonContext
 *
 * SidePanel context used for sections that aren't implemented yet.
 *
 * It's based on the existing "Mapa" empty state styling (`EmptyState`), but adapted
 * to fit inside the Platform side panel.
 */
export function ComingSoonContext({ activeSection }: ComingSoonContextProps) {
	return (
		<section className="w-full h-full bg-white flex flex-col">
			<div className="w-full flex-1 min-h-0 flex items-center justify-center px-6 py-10">
				<div className="flex flex-col items-center gap-6">
					<div className="w-[220px] h-[170px] sm:w-[260px] sm:h-[210px] shrink-0">
						<svg width="100%" height="100%" aria-hidden="true">
							<use href="/sprite.svg#empty-state" />
						</svg>
					</div>

					<div className="text-center">
						<div className="text-xs font-semibold tracking-wide text-neutral-500">
							{sectionLabel[activeSection]}
						</div>
						<div className="mt-2 text-lg font-semibold text-neutral-800">
							Em construção
						</div>
					</div>
				</div>
			</div>

			<div className="w-full bg-[#E1E2B4]">
				<div className="w-full flex items-center justify-center p-6 min-h-[120px]">
					<p className="max-w-[320px] text-center font-bold text-[18px] leading-[150%] text-[#777E32]">
						Estamos trabalhando para disponibilizar este conteúdo em breve!
					</p>
				</div>
			</div>
		</section>
	);
}

