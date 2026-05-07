import { test, expect } from "@playwright/test";
import { navigateToEditor } from "./helpers/e2e-helpers.js";

test.describe("E2E responsive editor: 3 width modes", () => {
  test("wide mode (>900px) shows layers panel as sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await navigateToEditor(page);

    const shell = page.locator(".editor-shell");
    await expect(shell).toHaveAttribute("data-mode", "wide");

    const layers = page.locator("aside.layers-panel");
    await expect(layers).toBeVisible();

    const codeBox = page.locator(".code-box");
    await expect(codeBox).toBeVisible();
  });

  test("medium mode (500-900px) hides layers sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 720 });
    await navigateToEditor(page);

    const shell = page.locator(".editor-shell");
    await expect(shell).toHaveAttribute("data-mode", "medium");

    const layers = page.locator("aside.layers-panel");
    await expect(layers).not.toBeVisible();

    const codeBox = page.locator(".code-box");
    await expect(codeBox).toBeVisible();
  });

  test("narrow mode (<500px) hides layers and code box", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await navigateToEditor(page);

    const shell = page.locator(".editor-shell");
    await expect(shell).toHaveAttribute("data-mode", "narrow");

    const layers = page.locator("aside.layers-panel");
    await expect(layers).not.toBeVisible();

    const codeBox = page.locator(".code-box");
    await expect(codeBox).not.toBeVisible();
  });

  test("resizing dynamically switches mode", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await navigateToEditor(page);

    await expect(page.locator(".editor-shell")).toHaveAttribute("data-mode", "wide");

    await page.setViewportSize({ width: 600, height: 720 });
    await expect(page.locator(".editor-shell")).toHaveAttribute("data-mode", "medium");

    await page.setViewportSize({ width: 350, height: 720 });
    await expect(page.locator(".editor-shell")).toHaveAttribute("data-mode", "narrow");
  });

  test("AI input is visible in all modes", async ({ page }) => {
    for (const width of [1200, 700, 350]) {
      await page.setViewportSize({ width, height: 720 });
      await navigateToEditor(page);

      const aiInput = page.locator(".ai-input__field");
      await expect(aiInput).toBeVisible();
    }
  });

  test("apply bar is visible in all modes", async ({ page }) => {
    for (const width of [1200, 700, 350]) {
      await page.setViewportSize({ width, height: 720 });
      await navigateToEditor(page);

      const applyBar = page.locator(".apply-bar");
      await expect(applyBar).toBeVisible();
    }
  });

  test("panel tabs are visible in all modes", async ({ page }) => {
    for (const width of [1200, 700, 350]) {
      await page.setViewportSize({ width, height: 720 });
      await navigateToEditor(page);

      const tabs = page.locator(".panel-tabs");
      await expect(tabs).toBeVisible();
    }
  });
});
