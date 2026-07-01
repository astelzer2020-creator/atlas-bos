import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../src/components/button";

describe("Button", () => {
  it("renders with label text", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("renders primary variant by default", () => {
    render(<Button>Create contact</Button>);
    const button = screen.getByRole("button", { name: "Create contact" });
    expect(button).toHaveClass("bg-brand-600");
  });

  it("shows loading state with aria-busy", () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("applies disabled state and removes from interaction", () => {
    render(<Button disabled>Disabled action</Button>);
    const button = screen.getByRole("button", { name: "Disabled action" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("bg-subtle");
  });

  it("renders danger variant", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-error");
  });
});