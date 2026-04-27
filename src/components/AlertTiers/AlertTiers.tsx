"use client";

import { Pie, PieChart, Sector, Tooltip } from "recharts";
import { StatusItemI } from "../../utils/interfaces";
import { StatusRow } from "../StatusRow/StatusRow";

type TooltipPayloadShape = {
  payload?: {
    label?: string;
  };
};

type Props = {
  items: StatusItemI[];
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
    <div className="w-full p-4 bg-[#F6F7F6] border border-[#E4E5E2] rounded-lg flex flex-col gap-6">
      <h1 className="text-xl font-bold ">Monitoramento de Seca na região</h1>

      <div className="flex flex-col md:flex-row justify-between items-center gap-12">
        <PieChart width={279} height={279}>
          <Pie
            data={items}
            dataKey="value"
            cx="50%"
            cy="50%"
            outerRadius={139}
            strokeWidth={0}
            isAnimationActive
            shape={(props: PieShapeProps) => {
              const {
                cx,
                cy,
                innerRadius,
                outerRadius,
                startAngle,
                endAngle,
                index,
              } = props;
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
          <Tooltip
            labelFormatter={() => ""}
            formatter={(value, _name, props) => {
              const { payload } = props as unknown as TooltipPayloadShape;
              const label = payload?.label ?? "";
              return `${label} - ${value}%`;
            }}
            contentStyle={{ borderRadius: 8 }}
          />
        </PieChart>

        <div className="flex flex-col gap-2 w-full">
          {items.map((item) => (
            <StatusRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};
