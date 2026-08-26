import { CriteriaCardI } from "@/utils/amfeInterfaces";
import InputForm from "./InputForm";
import { useWatch } from "react-hook-form";

const CriteriaCard = ({ fields, control, setValue }: CriteriaCardI) => {
  const watchedCriteria = useWatch({
    control,
    name: "criteria",
  });

  const sum = (watchedCriteria || []).reduce((acc, item) => {
    return acc + (Number(item?.value) || 0);
  }, 0);

  const normalize = (value: number, min: number, max: number) => {
    return (value - min) / (max - min);
  };

  const handleNormalizeCriteria = () => {
    for (let index = 0; index < fields.length; index++) {
      const normalizedValue = normalize(fields[index].value, 0, 1);
      setValue(`criteria.${index}.value`, normalizedValue);
    }
  };

  const isValid = 1 === sum;

  return (
    <div className="mt-3 items-start rounded-lg border border-neutral-200 p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {fields.map((field, index) => (
          <div key={index}>
            <InputForm
              fieldLabel={field.name}
              inputProps={{
                placeholder: `Valor de ${field.name}`,
                type: "number",
                step: 0.1,
                max: 1,
                onBlur: () => {
                  if (!isValid) handleNormalizeCriteria();
                },
              }}
              formProps={{
                name: `criteria.${index}.value`,
                control: control,
              }}
            />
          </div>
        ))}
      </div>
      <div
        className={`mt-4 rounded-md p-3 text-sm font-medium transition-colors ${isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} `}
      >
        Soma dos critérios: {sum.toFixed(2)}
      </div>
    </div>
  );
};

export default CriteriaCard;
