import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TabsSection from "./TabSection";
import { Document, BLOCKS } from "@contentful/rich-text-types";
import { TabsSectionI } from "@/utils/interfaces";

const mockRichText: Document = {
  nodeType: BLOCKS.DOCUMENT,
  data: {},
  content: [
    {
      nodeType: BLOCKS.PARAGRAPH,
      data: {},
      content: [
        {
          nodeType: "text",
          value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer gravida mi ut vestibulum vestibulum.",
          marks: [],
          data: {},
        },
      ],
    },
    {
      nodeType: BLOCKS.UL_LIST,
      data: {},
      content: [
        {
          nodeType: BLOCKS.LIST_ITEM,
          data: {},
          content: [
            {
              nodeType: BLOCKS.PARAGRAPH,
              data: {},
              content: [{ nodeType: "text", value: "Item de lista 01", marks: [], data: {} }],
            },
          ],
        },
      ],
    },
  ],
};


const mockTabsData: TabsSectionI[] = [
  {
    title: "Sociedade e comunidades",
    text: { json: mockRichText },
    image: {
      url: "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=1000",
      title: "Sociedade",
    },
    includeInAboutSap: false,
  },
  {
    title: "Técnicos e pesquisadores",
    text: { json: mockRichText },
    image: {
      url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1000",
      title: "Técnicos",
    },
    includeInAboutSap: false,
  },
  {
    title: "Gestão pública",
    text: { json: mockRichText },
    image: {
      url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000",
      title: "Gestão",
    },
    includeInAboutSap: false,
  },
];

const meta: Meta<typeof TabsSection> = {
  title: "Components/TabsSection",
  component: TabsSection,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TabsSection>;

export const Default: Story = {
  args: {
    contentData: mockTabsData, 
  },
};

export const Mobile: Story = {
  args: {
    contentData: mockTabsData, 
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};