import { Badge } from "@/components/Badge/Badge";
import { ThematicAxisI } from "@/utils/interfaces";

type Labels = {
  sedesHere: string;
  actionsLabel: string;
  executorLabel: string;
  partnersLabel: string;
  actionsSuffix: string;
};

type Props = {
  axis: ThematicAxisI;
  title: string;
  description?: string;
  executor: string;
  labels: Labels;
};

export const ThematicAxisCard = ({
  axis,
  title,
  description,
  executor,
  labels,
}: Props) => {
  if (axis.isSedesAxis) {
    return (
      <div className="flex h-full flex-col gap-4 rounded-lg bg-[#59403A] p-6">
        <div className="flex flex-col items-start gap-2">
          <Badge label={labels.sedesHere} variant="primary" />
          <h4 className="text-[22px] font-bold leading-tight text-[#F8F7F8]">
            {title}
          </h4>
          {description && (
            <p className="text-xs leading-normal text-[#E8E2D9]">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-end gap-2">
          <span className="text-5xl font-extrabold leading-none text-[#B4BA61]">
            {axis.actionsCount}
          </span>
          <span className="text-base text-[#F8F7ED]">
            {labels.actionsLabel}
          </span>
        </div>

        <div className="border-t border-white/15" />

        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-[#D3C5B5]">
            {labels.executorLabel}
          </span>
          <span className="text-base font-bold text-[#F8F7F8]">
            {executor} <span className="text-[#D3C5B5]">·</span>{" "}
            <span className="text-[#B4BA61]">
              {axis.executorActionsCount} {labels.actionsSuffix}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-[#D3C5B5]">
            {labels.partnersLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            {axis.partners.map((partner) => (
              <Badge key={partner} label={partner} variant="accent" size="sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg bg-[#E8E2D9] p-4">
      <h4 className="min-h-[42px] text-sm font-bold leading-normal text-[#2C1E1C]">
        {title}
      </h4>

      <div className="flex gap-8 text-xs font-bold">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#2C1E1C]">{labels.actionsLabel}</span>
          <span className="whitespace-nowrap text-[#5B612A]">
            {axis.actionsCount} {labels.actionsSuffix}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[#2C1E1C]">{labels.executorLabel}</span>
          <span className="whitespace-nowrap text-[#292829]">
            {executor}{" "}
            <span className="text-[#5B612A]">
              · {axis.executorActionsCount} {labels.actionsSuffix}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-[#2C1E1C]">
          {labels.partnersLabel}
        </span>
        <div className="flex flex-wrap gap-2">
          {axis.partners.map((partner) => (
            <Badge key={partner} label={partner} variant="subtle" size="sm" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThematicAxisCard;
