import { ChangeEvent } from "react";
import { StatusItemI } from "../../utils/interfaces";
import { getContrastTextColor } from "@/utils/functions";

type Props = {
  item: StatusItemI;
  onToggle?: (id: string, checked: boolean) => void;
};

export const StatusRow = ({ item, onToggle }: Props) => {

  const handleToggle = (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
    if (onToggle) {
      onToggle(item.id, e.target.checked)
    }
  }

  return (
    <div className="flex justify-between items-center min-h-10 pl-2 pr-0 bg-white rounded-lg gap-4 w-full">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.checked}
           onChange={handleToggle}         
          readOnly
          className="w-4 h-4 rounded-sm accent-[#5B612A]"
        />
        <span className="text-[14px] font-semibold">
          {item.label}
        </span>
      </div>

      <div
        style={{ backgroundColor: item.color, color: getContrastTextColor(item.color) }}
        className="flex items-center justify-center min-w-17 min-h-10 rounded-lg text-[16px] font-semibold font-['Open_Sans']"
      >
        {item.value}%
      </div>

    </div>
  );
};