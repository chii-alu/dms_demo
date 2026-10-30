import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreviewDialog } from "./PreviewDialog";
import type { FieldSpec } from "@/lib/forms/fields";

const fields: FieldSpec[] = [
  { id: "name", label: "Full name", type: "text", required: true },
  { id: "stage", label: "Stage", type: "single", required: true, options: ["Idea", "Scaling"] },
];

afterEach(cleanup);

describe("PreviewDialog", () => {
  it("says nothing is saved and rejects a blank required answer", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PreviewDialog open onClose={() => {}} title="Registration form" description="Session" fields={fields} />);

    expect(screen.getByText(/Nothing is saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByRole("alert").textContent).toContain("Some answers need attention.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("accepts a complete set of answers without saving anything", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PreviewDialog open onClose={() => {}} title="Registration form" description="Session" fields={fields} />);

    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Aline" } });
    fireEvent.click(screen.getByLabelText("Idea"));
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByRole("status").textContent).toContain("All required answers are valid.");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
