import { AboutSection } from "./AboutSection";
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Document } from "@contentful/rich-text-types";
import { BLOCKS } from "@contentful/rich-text-types";

// Mock de dados do Contentful Rich Text - Texto curto
const mockShortText: Document = {
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
  ],
};

// Mock de dados do Contentful Rich Text - Texto longo
const mockLongText: Document = {
  nodeType: BLOCKS.DOCUMENT,
  data: {},
  content: [
    {
      nodeType: BLOCKS.PARAGRAPH,
      data: {},
      content: [
        {
          nodeType: "text",
          value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer gravida mi ut vestibulum vestibulum. Donec a fermentum est. Aliquam efficitur et purus at facilisis. Cras ultricies metus lacus. Duis dictum finibus turpis, quis euismod lorem vehicula quis. Quisque felis ante, egestas in elementum in, ullamcorper sed erat.",
          marks: [],
          data: {},
        },
      ],
    },
    {
      nodeType: BLOCKS.PARAGRAPH,
      data: {},
      content: [
        {
          nodeType: "text",
          value: "Quisque in urna sit amet purus eleifend sagittis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer gravida mi ut vestibulum vestibulum. Donec a fermentum est.",
          marks: [],
          data: {},
        },
      ],
    },
    {
      nodeType: BLOCKS.PARAGRAPH,
      data: {},
      content: [
        {
          nodeType: "text",
          value: "Aliquam efficitur et purus at facilisis. Cras ultricies metus lacus. Duis dictum finibus turpis, quis euismod lorem vehicula quis. Quisque felis ante, egestas in elementum in, ullamcorper sed erat. Quisque in urna sit amet purus eleifend sagittis.",
          marks: [],
          data: {},
        },
      ],
    },
  ],
};

// Mock com texto em negrito
const mockBoldText: Document = {
  nodeType: BLOCKS.DOCUMENT,
  data: {},
  content: [
    {
      nodeType: BLOCKS.PARAGRAPH,
      data: {},
      content: [
        {
          nodeType: "text",
          value: "Teste ",
          marks: [],
          data: {},
        },
        {
          nodeType: "text",
          value: "testando",
          marks: [{ type: "bold" }],
          data: {},
        },
        {
          nodeType: "text",
          value: " testes",
          marks: [],
          data: {},
        },
      ],
    },
  ],
};

const meta = {
  title: "Components/AboutSection",
  component: AboutSection,
  tags: ["autodocs"],
  parameters: {
    
  },
  argTypes: {
    onClick: { action: "clicked" },
  },
} satisfies Meta<typeof AboutSection>;

export default meta;
type Story = StoryObj<typeof meta>;

// Story padrão
export const Default: Story = {
  args: {
    content: {
      sys: {
        id: "1",
      },
      title: "Sobre Nós",
      text: {
        json: mockLongText,
      },
      image: {
        url: "https://picsum.photos/630/320",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    onClick: () => console.log("Ver Mais clicked"),
  },
};

// Título longo
export const LongTitle: Story = {
  args: {
    content: {
      sys: {
        id: "2",
      },
      title: "The People of the Kingdom and Their Amazing Stories",
      text: {
        json: mockShortText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=1",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),

  },
};

// Título curto
export const ShortTitle: Story = {
  args: {
    content: {
      sys: {
        id: "3",
      },
      title: "Sobre",
      text: {
        json: mockLongText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=2",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),

  },
};

// Texto curto
export const ShortContent: Story = {
  args: {
    content: {
      sys: {
        id: "4",
      },
      title: "Nossa Missão",
      text: {
        json: mockShortText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=3",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),

  },
};

// Texto com formatação
export const FormattedText: Story = {
  args: {
    content: {
      sys: {
        id: "5",
      },
      title: "Nossa História",
      text: {
        json: mockBoldText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=4",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),

  },
};


// Com classe customizada
export const CustomClassName: Story = {
  args: {
    content: {
      sys: {
        id: "7",
      },
      title: "Sobre a Empresa",
      text: {
        json: mockLongText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=6",
        title: "About Image",
        width: 630,
        height: 320,
      },
    },
    className: "shadow-lg",
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),

  },
  
};


// Múltiplos parágrafos
export const MultipleParargraphs: Story = {
  args: {
    content: {
      sys: {
        id: "10",
      },
      title: "Nossa Jornada",
      text: {
        json: mockLongText,
      },
      image: {
        url: "https://picsum.photos/630/320?random=8",
        title: "Journey",
        width: 630,
        height: 320,
      },
    },
    onClick: () => alert("Teste do OnClick Raína Raína Testando"),
  },
};