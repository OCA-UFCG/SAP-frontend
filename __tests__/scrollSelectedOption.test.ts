import { describe, expect, it } from "vitest";
import { scrollSelectedOptionIntoView } from "@/utils/scrollSelectedOption";

function listboxWithSelectedAt(offsetTop: number | null) {
  const listbox = document.createElement("div");
  Object.defineProperty(listbox, "clientHeight", { value: 256 });
  for (let index = 0; index < 20; index += 1) {
    const option = document.createElement("button");
    option.setAttribute("role", "option");
    const selected = offsetTop !== null && index === 10;
    option.setAttribute("aria-selected", String(selected));
    Object.defineProperty(option, "offsetTop", {
      value: selected ? offsetTop : index * 36,
    });
    Object.defineProperty(option, "offsetHeight", { value: 36 });
    listbox.append(option);
  }
  return listbox;
}

describe("scrollSelectedOptionIntoView", () => {
  it("centers the selected option inside the list", () => {
    const listbox = listboxWithSelectedAt(400);

    scrollSelectedOptionIntoView(listbox);

    expect(listbox.scrollTop).toBe(400 - (256 - 36) / 2);
  });

  it("leaves the list at the top when nothing is selected", () => {
    const listbox = listboxWithSelectedAt(null);

    scrollSelectedOptionIntoView(listbox);

    expect(listbox.scrollTop).toBe(0);
  });

  it("ignores a list that is not mounted", () => {
    expect(() => scrollSelectedOptionIntoView(null)).not.toThrow();
  });
});
