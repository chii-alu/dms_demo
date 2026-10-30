import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Dialog } from "./Dialog";

afterEach(cleanup);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Test dialog">
        <input aria-label="First" />
        <button type="button">Last</button>
      </Dialog>
    </>
  );
}

describe("Dialog focus", () => {
  it("moves focus into the dialog, keeps Tab inside, and returns focus on close", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(screen.getByLabelText("First"));
    // Tab from the last control wraps to the first tab stop inside the dialog (the close button).
    const dialog = screen.getByRole("dialog");
    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("does not reset focus when the parent re-renders with a new close handler", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} title="Stable">
        <input aria-label="Name" />
      </Dialog>,
    );
    const name = screen.getByLabelText("Name");
    name.focus();
    rerender(
      <Dialog open onClose={() => onClose()} title="Stable">
        <input aria-label="Name" />
      </Dialog>,
    );
    expect(document.activeElement).toBe(name);
  });
});
