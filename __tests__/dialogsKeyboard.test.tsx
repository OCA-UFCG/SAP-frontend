import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfoModal } from "@/components/InfoModal/InfoModal";
import CriteriaModal from "@/components/Amfe/CriteriaModal/CriteriaModal";
import { IndexCatalogGuideModal } from "@/components/IndexCatalog/IndexCatalogGuideModal";
import { UserAuth } from "@/components/UserAuth/UserAuth";
import { useAuth } from "@/contexts/AuthContext";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

/** Abre o diálogo por um botão, como a plataforma faz, e devolve o botão. */
function InfoModalHost() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ver informações
      </button>
      <InfoModal
        card={{ id: 1, title: "Índice", description: "Sobre", fileRef: "x" }}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function GuideModalHost() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ajuda
      </button>
      {open && <IndexCatalogGuideModal onClose={() => setOpen(false)} />}
    </>
  );
}

function pressEscape() {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
}

function openWith(name: string) {
  const opener = screen.getByRole("button", { name });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("dialogs keyboard behaviour", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "user@test.com" },
      loading: false,
      error: "",
      signIn: vi.fn(),
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });
  afterEach(cleanup);

  it("InfoModal takes focus, closes on Escape and gives focus back", () => {
    render(<InfoModalHost />);
    const opener = openWith("Ver informações");

    const dialog = screen.getByRole("dialog", {
      name: "Informações sobre Índice",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();

    pressEscape();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("InfoModal no longer renders a 'Saiba mais' link without destination", () => {
    render(<InfoModalHost />);
    openWith("Ver informações");
    // O `fileRef` é o id da camada, não um endereço: o link não levava a nada.
    expect(screen.queryByText("Saiba mais")).toBeNull();
  });

  it("CriteriaModal is a labelled dialog with checkboxes and closes on Escape", () => {
    render(
      <CriteriaModal
        options={[
          { id: "a", name: "Chuva" },
          { id: "b", name: "Seca" },
        ]}
        defaultSelected={["a"]}
      >
        {(open) => (
          <button type="button" onClick={open}>
            Editar critérios
          </button>
        )}
      </CriteriaModal>,
    );
    const opener = openWith("Editar critérios");

    expect(
      screen.getByRole("dialog", { name: "Adicionar ou editar critérios" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Pesquisar critérios" }),
    ).toHaveFocus();

    const chuva = screen.getByRole("checkbox", { name: "Chuva" });
    const seca = screen.getByRole("checkbox", { name: "Seca" });
    expect(chuva).toHaveAttribute("aria-checked", "true");
    // A única marcada não pode sair (mínimo de um critério).
    expect(chuva).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(seca);
    expect(seca).toHaveAttribute("aria-checked", "true");

    pressEscape();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("IndexCatalogGuideModal keeps Tab inside the dialog", () => {
    render(<GuideModalHost />);
    openWith("Ajuda");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(buttons[0]).toHaveFocus();
  });

  it("UserAuth menu closes on Escape and returns focus to the user button", () => {
    render(<UserAuth />);
    const opener = openWith("Menu do usuário");

    expect(
      screen.getByRole("dialog", { name: "Status do usuário" }),
    ).toHaveFocus();

    pressEscape();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
