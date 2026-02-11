import { AlertTiers } from "../components/AlertTiers/AlertTiers";
import { StatusItemI } from "../utils/interfaces";

export default function Home() {
  const items: StatusItemI[] = [
    {
      id: "1",
      label: "Sem seca",
      value: 43.3,
      color: "bg-[#F0F0D7]",
    },
    {
      id: "2",
      label: "Observação (Watch)",
      value: 24.5,
      color: "bg-[#FECB89]",
    },
    {
      id: "3",
      label: "Atenção (Warning)",
      value: 6,
      color: "bg-[#B52C08] text-[#F8F7F8]"
    },
    {
      id: "4",
      label: "Alerta (Alert)",
      value: 13.2,
      color: "bg-[#B52C08] text-white",
    },
  ];

  return (
    <main className="p-10">
      <AlertTiers items={items} />
    </main>
  );
}