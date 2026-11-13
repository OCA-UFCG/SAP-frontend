/**
 * A língua da pergunta, para lembrar o modelo de responder nela. Só o pedido
 * no prompt não bastava: o prompt, as ferramentas e os dados são todos em
 * português, e o Haiku respondia em português a 3 de 4 perguntas em inglês ou
 * espanhol. O lembrete vai junto da pergunta enviada ao modelo; a pessoa não o
 * vê e ele não fica gravado na conversa.
 */

// Palavras comuns que só aparecem numa das três línguas.
const PALAVRAS: Record<"en" | "es" | "pt", Set<string>> = {
  en: new Set(
    "the is are was what which how who why where when will would does do did of and with for there in on it this that right now rain drought municipalities municipality priority very high low most state states than".split(
      " ",
    ),
  ),
  es: new Set(
    "el los las del y en es son cuál cuáles qué cómo dónde cuándo va llover más lo hay sequía municipios municipio mayor menor estado estados prioridad muy pobreza lluvia".split(
      " ",
    ),
  ),
  pt: new Set(
    "o os da do das dos em no na nos nas é são qual quais que como onde quando vai chover mais seca município municípios maior menor não está estão tem prioridade muito pobreza chuva e".split(
      " ",
    ),
  ),
};

export function linguaDa(texto: string): "en" | "es" | "pt" {
  const palavras = texto.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const conta = (l: keyof typeof PALAVRAS) =>
    palavras.filter((p) => PALAVRAS[l].has(p)).length;
  const pt = conta("pt");
  const en = conta("en");
  const es = conta("es") + (/[¿¡ñ]/.test(texto) ? 2 : 0);
  if (en >= 2 && en > pt && en > es) return "en";
  if (es >= 2 && es > pt && es > en) return "es";
  return "pt";
}

// Explícito sobre os dados em português: com "(Responde en español.)" só, uma
// pergunta de previsão (muita saída de ferramenta) ainda saiu em português.
const LEMBRETE = {
  en: "(Write the whole answer in English, even though the tools and data are in Portuguese.)",
  es: "(Escribe toda la respuesta en español, no en portugués, aunque las herramientas y los datos estén en portugués.)",
};

/** A pergunta como vai para o modelo: com o lembrete, se não for português. */
export function paraOModelo(pergunta: string) {
  const l = linguaDa(pergunta);
  return l === "pt" ? pergunta : `${pergunta}\n\n${LEMBRETE[l]}`;
}
