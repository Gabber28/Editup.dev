import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import {
  SetupScreen,
  type SetupScreenProps,
} from "@/components/setup-screen.js";
import type { RootCheck } from "@/types/project-root.js";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

function makeProps(
  overrides: Partial<SetupScreenProps> = {}
): SetupScreenProps {
  return {
    proxyPort: 9200,
    agentConnected: true,
    targetOrigin: "http://localhost:3000",
    onConnect: vi.fn(),
    onReady: vi.fn(),
    onCancel: vi.fn(),
    error: null,
    loading: false,
    ...overrides,
  };
}

function answerWith(check: RootCheck): void {
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === "validate_project_root") return check as never;
    return null as never;
  });
}

function typeRoot(value: string): void {
  fireEvent.change(screen.getByPlaceholderText(/project root path/), {
    target: { value },
  });
}

const status = (): HTMLElement => screen.getByRole("status");
const startButton = (): HTMLButtonElement =>
  screen.getByRole("button", { name: "Start Editing" }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  invokeMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Runs the debounce timer and lets the pending invoke settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("SetupScreen project root verdict", () => {
  it("asks for the project root and names the running origin", () => {
    render(<SetupScreen {...makeProps()} />);
    expect(screen.getByRole("heading", { name: "Project root" })).toBeTruthy();
    expect(
      screen.getByText(/Add the root folder of the project running at/)
    ).toBeTruthy();
  });

  it("shows no banner before a root is typed", () => {
    render(<SetupScreen {...makeProps()} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("places the verdict under the hint and above the button", async () => {
    answerWith({ verdict: "not_found", message: "Folder not found: C:\\nope" });
    const { container } = render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\nope");
    await settle();
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());

    const card = container.querySelector(".setup-card");
    const order = Array.from(card?.children ?? []);
    const at = (el: Element | null): number =>
      el ? order.indexOf(el) : Number.NaN;

    expect(at(status())).toBeGreaterThan(
      at(container.querySelector(".setup-hint"))
    );
    expect(at(status())).toBeLessThan(at(startButton()));
  });

  it("hides the banner again when the root is cleared", async () => {
    answerWith({ verdict: "ok", message: "" });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\project");
    await settle();
    expect(screen.queryByRole("status")).not.toBeNull();

    typeRoot("");
    await settle();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("turns orange and names the missing folder", async () => {
    answerWith({ verdict: "not_found", message: "Folder not found: C:\\nope" });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\nope");
    await settle();

    await waitFor(() => {
      expect(status().className).toContain("setup-status--warn");
    });
    expect(status().textContent).toContain("Folder not found");
    expect(status().className).not.toContain("setup-status--ok");
  });

  it("blocks Start Editing when the folder does not exist", async () => {
    answerWith({ verdict: "not_found", message: "Folder not found: C:\\nope" });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\nope");
    await settle();

    await waitFor(() => expect(startButton().disabled).toBe(true));
  });

  it("warns when the folder is not the root of the running project", async () => {
    answerWith({
      verdict: "mismatch",
      message:
        "Not the root of the project at http://localhost:3000 — it loads /src/main.tsx, which does not exist in this folder.",
    });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\some\\other\\project");
    await settle();

    await waitFor(() => {
      expect(status().className).toContain("setup-status--warn");
    });
    expect(status().textContent).toContain("Not the root of the project");
    // A mismatch is a warning, not a block: a monorepo root is still workable.
    expect(startButton().disabled).toBe(false);
  });

  it("warns when the root could not be confirmed", async () => {
    answerWith({
      verdict: "unverified",
      message:
        "Could not confirm this is the root of the project at http://localhost:3000.",
    });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\maybe");
    await settle();

    await waitFor(() => {
      expect(status().className).toContain("setup-status--warn");
    });
    expect(status().textContent).toContain("Could not confirm");
  });

  it("keeps the green banner for a verified root", async () => {
    answerWith({ verdict: "ok", message: "" });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("C:\\project");
    await settle();

    await waitFor(() => {
      expect(status().className).toContain("setup-status--ok");
    });
    expect(status().textContent).toBe("Agent connected");
    expect(startButton().disabled).toBe(false);
  });

  it("passes the connected origin to the validator", async () => {
    answerWith({ verdict: "ok", message: "" });
    render(<SetupScreen {...makeProps()} />);
    typeRoot("  C:\\project  ");
    await settle();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("validate_project_root", {
        path: "C:\\project",
        origin: "http://localhost:3000",
      });
    });
  });

  it("surfaces a failure from onReady instead of doing nothing", async () => {
    answerWith({ verdict: "ok", message: "" });
    const onReady = vi.fn().mockRejectedValue(new Error("not a directory"));
    render(<SetupScreen {...makeProps({ onReady })} />);
    typeRoot("C:\\project");
    await settle();
    await act(async () => {
      fireEvent.click(startButton());
    });

    await waitFor(() => {
      expect(screen.getByText(/not a directory/)).toBeTruthy();
    });
  });
});
