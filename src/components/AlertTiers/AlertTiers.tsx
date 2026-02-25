'use client';

import { Pie, PieChart, Sector } from 'recharts';
import { StatusItemI } from "../../utils/interfaces";
import { StatusRow } from "../StatusRow/StatusRow";

type Props = {
  items: StatusItemI[];
  //onToggle: (id: string, checked: boolean) => void;
};

type PieShapeProps = {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  index: number;
};

export const AlertTiers = ({ items }: Props) => {
  return (
    <div className="w-[793px] p-4 bg-[#F6F7F6] border border-[#E4E5E2] rounded-[8px] flex flex-col gap-6">
      
      <h1 className="text-[18px] font-bold leading-[18px] tracking-[-0.006em] text-[#292829] font-['Open_Sans']">
        CDI
      </h1>

      <div className="flex flex-row justify-between items-start gap-[50px]">

        {/* Gráfico */}
        <PieChart width={279} height={279}>
          <Pie
            data={items}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={139}
            strokeWidth={0}
            shape={(props: PieShapeProps) => {
              const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, index } = props;
              return (
                <Sector
                  cx={cx}
                  cy={cy}
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  fill={items[index].color}
                />
              );
            }}
          />
        </PieChart>

        {/* Lista */}
        <div className="flex flex-col gap-2 w-[432px]">
          {items.map((item) => (
            <StatusRow key={item.id} item={item} />
          ))}
        </div>

      </div>
    </div>
  );
};