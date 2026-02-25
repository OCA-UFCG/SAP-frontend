import { AboutSection } from "../components/AboutSection/AboutSection";
import { PartnersSection } from "../components/PartnersSection/PartnersSection";
import { getContent } from "../utils/contentful";
import type {
  AboutSectionI,
  PartnerI,
  SectionHeaderI,
} from "../utils/interfaces";
import { GET_HOME_PAGE } from "../utils/queries";

export const revalidate = 3600;

interface IHomeContent {
  aboutCollection: { items: AboutSectionI[] };
  cabealhoSeesCollection: { items: SectionHeaderI[] };
  partnersCollection: { items: PartnerI[] };
}

export default async function Home() {
  const {
    aboutCollection,
    cabealhoSeesCollection,
    partnersCollection,
  }: IHomeContent = await getContent<IHomeContent>(GET_HOME_PAGE);

  if (!aboutCollection?.items?.length) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>Conteúdo não encontrado.</p>
      </div>
    );
  }

  const content = aboutCollection.items[0];
  const partnersHeader = cabealhoSeesCollection?.items?.[0];
  const partners = partnersCollection?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <AboutSection content={content} />

      {partnersHeader && (
        <PartnersSection header={partnersHeader} partners={partners} />
      )}
    </div>
  );
}
