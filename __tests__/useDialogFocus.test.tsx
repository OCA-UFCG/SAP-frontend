import { useRef, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface FakeDialogProps {
  onClose?: () => void;
  trapFocus?: boolean;
  autofocusSecond?: boolean;
}

/** Um botão que abre um diálogo com três botões, como os modais da plataforma. */
function FakeDialogHost({
  onClose = () => {},
  trapFocus,
  autofocusSecond = false,
}: FakeDialogProps) {
  const [open, setOpen] = useState(false);
  const [renders, setRenders] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && (
        <FakeDialog
          trapFocus={trapFocus}
          autofocusSecond={autofocusSecond}
          // Uma função nova a cada render, como fazem os componentes reais.
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          onRerender={() => setRenders(renders + 1)}
        />
      )}
    </>
  );
}

function FakeDialog({
  onClose,
  trapFocus,
  autofocusSecond,
  onRerender,
}: Required<Pick<FakeDialogProps, "onClose" | "autofocusSecond">> & {
  trapFocus?: boolean;
  onRerender: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onClose, trapFocus });
  return (
    <div ref={dialogRef} role="dialog" aria-label="Diálogo" tabIndex={-1}>
      <button type="button" onClick={onRerender}>
        Primeiro
      </button>
      <button type="button" data-autofocus={autofocusSecond || undefined}>
        Segundo
      </button>
      <button type="button" onClick={onClose}>
        Último
      </button>
    </div>
  );
}

function openDialog() {
  const opener = screen.getByRole("button", { name: "Abrir" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("useDialogFocus", () => {
  afterEach(cleanup);

  it("moves focus into the dialog when it opens", () => {
    render(<FakeDialogHost />);
    openDialog();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("prefers the element marked with data-autofocus", () => {
    render(<FakeDialogHost autofocusSecond />);
    openDialog();
    expect(screen.getByRole("button", { name: "Segundo" })).toHaveFocus();
  });

  it("wraps Tab from the last control to the first and Shift+Tab back", () => {
    render(<FakeDialogHost />);
    openDialog();
    const first = screen.getByRole("button", { name: "Primeiro" });
    const last = screen.getByRole("button", { name: "Último" });

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("sends Shift+Tab from the dialog itself to the last control", () => {
    render(<FakeDialogHost />);
    openDialog();
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    });
    expect(screen.getByRole("button", { name: "Último" })).toHaveFocus();
  });

  it("lets Tab leave a non-modal popover", () => {
    render(<FakeDialogHost trapFocus={false} />);
    openDialog();
    const last = screen.getByRole("button", { name: "Último" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    // Sem o trap, o hook não intercepta: o navegador seguiria para fora.
    expect(last).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", () => {
    const onClose = vi.fn();
    render(<FakeDialogHost onClose={onClose} />);
    const opener = openDialog();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("does not steal focus from a field clicked outside when the dialog closes", () => {
    function HostWithField() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <input aria-label="Campo de fora" onFocus={() => setOpen(false)} />
          {open && (
            <FakeDialog
              onClose={() => setOpen(false)}
              autofocusSecond={false}
              onRerender={() => {}}
            />
          )}
        </>
      );
    }
    render(<HostWithField />);
    openDialog();
    const field = screen.getByRole("textbox", { name: "Campo de fora" });
    // Clicar no campo fora do menu foca o campo e fecha o menu.
    act(() => field.focus());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(field).toHaveFocus();
  });

  it("keeps focus where it is when the dialog re-renders with a new onClose", () => {
    render(<FakeDialogHost />);
    openDialog();
    const first = screen.getByRole("button", { name: "Primeiro" });
    first.focus();
    // O clique re-renderiza o diálogo; o foco não pode voltar para o início.
    fireEvent.click(first);
    expect(first).toHaveFocus();
  });
});
