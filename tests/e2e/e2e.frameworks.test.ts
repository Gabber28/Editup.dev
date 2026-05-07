import { test, expect } from "@playwright/test";
import { gotoApp } from "./helpers/e2e-helpers.js";
import {
  injectTauriMock,
  setAgentConnected,
  emitSnapshot,
} from "./helpers/tauri-mock.js";

async function setupEditorWithFramework(
  page: import("@playwright/test").Page,
  framework: string,
  classes: string[] = ["btn"],
): Promise<void> {
  await gotoApp(page);

  const urlInput = page.locator(".setup-input").first();
  await urlInput.fill("http://localhost:3000");
  await page.locator(".setup-btn").first().click();

  await setAgentConnected(page, true);
  await page.waitForSelector("text=Agent connected", { timeout: 5000 });

  const rootInput = page.locator(".setup-input").first();
  await rootInput.fill("C:\\project");
  await page.locator('button:has-text("Start Editing")').click();
  await page.waitForSelector(".editor-shell", { timeout: 5000 });

  await page.evaluate(
    ({ fw, cls }) => {
      const snap = {
        element: {
          tag: "div",
          classes: cls,
          component_name: "Card",
          source_file: `src/Card.${fw === "plain-css" ? "html" : "tsx"}`,
          source_line: 5,
        },
        styling: {
          framework: fw,
          class_to_rule_map: {},
          active_css_variables: {},
        },
        computed_style: {
          "background-color": "rgb(255, 255, 255)",
          color: "rgb(0, 0, 0)",
          "font-size": "14px",
          "margin-top": "0px",
          "padding-top": "16px",
          "border-top-width": "1px",
          display: "block",
          opacity: "1",
          "font-weight": "400",
        },
      };
      const emit = (window as Record<string, unknown>).__TAURI_TEST_EMIT__ as
        (ev: string, p: unknown) => void;
      if (emit) emit("agent_snapshot", snap);
    },
    { fw: framework, cls: classes },
  );

  await page.waitForSelector(".element-identity__tag", { timeout: 5000 });
}

test.describe("E2E frameworks: flow with different styling frameworks", () => {
  test("tailwind framework — element with tailwind classes", async ({ page }) => {
    await setupEditorWithFramework(page, "tailwind", ["bg-white", "p-4", "rounded"]);

    const identity = page.locator(".element-identity__tag");
    await expect(identity).toContainText("div");
    await expect(identity).toContainText(".bg-white");
  });

  test("css-modules framework — element with module classes", async ({ page }) => {
    await setupEditorWithFramework(page, "css-modules", ["card_abc123"]);

    const identity = page.locator(".element-identity__tag");
    await expect(identity).toContainText(".card_abc123");
  });

  test("plain-css framework — HTML file source path", async ({ page }) => {
    await setupEditorWithFramework(page, "plain-css", ["card"]);

    const identity = page.locator(".element-identity");
    await expect(identity).toContainText("Card.html");
  });

  test("styled-components framework renders correctly", async ({ page }) => {
    await setupEditorWithFramework(page, "styled-components", ["sc-abc"]);

    const tabs = page.locator(".panel-tabs");
    await expect(tabs).toBeVisible();

    const colorInputs = page.locator(".panel-content input[type='text']");
    await expect(colorInputs.first()).toBeVisible();
  });

  test("css-variables framework renders correctly", async ({ page }) => {
    await setupEditorWithFramework(page, "css-variables", ["themed"]);

    const identity = page.locator(".element-identity__tag");
    await expect(identity).toContainText("div");
    await expect(identity).toContainText(".themed");
  });

  test("editing works across all frameworks", async ({ page }) => {
    const frameworks = [
      "tailwind", "css-modules", "plain-css",
      "styled-components", "css-variables",
    ];
    for (const fw of frameworks) {
      await setupEditorWithFramework(page, fw);

      const colorInputs = page.locator(".panel-content input[type='text']");
      await colorInputs.first().fill("red");

      const applyBtn = page.locator(".apply-bar__btn--primary");
      await expect(applyBtn).toBeEnabled();
    }
  });
});
