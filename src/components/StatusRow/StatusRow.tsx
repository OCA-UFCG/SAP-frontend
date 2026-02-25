import { StatusItemI } from "../../utils/interfaces";

type Props = {
  item: StatusItemI;
  //onToggle: (id: string, checked: boolean) => void;
};

export const StatusRow = ({ item }: Props) => {
  return (
    <div className="flex justify-between items-center h-[40px] pl-2 pr-0 bg-white rounded-[8px] gap-4 w-[432px]">

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.checked}
           //onChange={(e) => onToggle(item.id, e.target.checked)}         
          readOnly
          className="w-4 h-4 rounded-[4px] accent-[#5B612A]"
        />
        <span className="text-[14px] font-semibold leading-6 text-[#292829] font-['Open_Sans']">
          {item.label}
        </span>
      </div>

      <div
        style={{ backgroundColor: item.color, color: item.textColor ?? '#292829' }}
        className="flex items-center justify-center w-[68px] h-[40px] rounded-[8px] text-[16px] font-semibold font-['Open_Sans']"
      >
        {item.value}%
      </div>

    </div>
  );
};