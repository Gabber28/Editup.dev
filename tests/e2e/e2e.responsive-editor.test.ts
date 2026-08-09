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
  });

  test("medium mode (500-900px) hides layers sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 720 });
    await navigateToEditor(page);

    const shell = page.locator(".editor-shell");
    await expect(shell).toHaveAttribute("data-mode", "medium");

    const layers = page.locator("aside.layers-panel");
    await expect(layers).not.toBeVisible();
  });

  test("narrow mode (<500px) hides layers", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 720 });
    await navigateToEditor(page);

    const shell = page.locator(".editor-shell");
    await expect(shell).toHaveAttribute("data-mode", "narrow");

    const layers = page.locator("aside.layers-panel");
    await expect(layers).not.toBeVisible();
  });

  // The source snippet moved behind a "Source" button in the top bar, so it is
  // no longer tied to the width mode — it shows in any mode once selected.
  test("source snippet opens from the Source tab", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await navigateToEditor(page);

    await expect(page.locator(".code-box")).not.toBeVisible();

    await page.locator(".panel-tabs__tab", { hasText: "Source" }).click();
    await expect(page.locator(".code-box")).toBeVisible();
  });

  test("resizing dynamically switches mode", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await navigateToEditor(page);

    await expect(page.locator(".editor-shell")).toHaveAttribute(
      "data-mode",
      "wide"
    );

    await page.setViewportSize({ width: 600, height: 720 });
    await expect(page.locator(".editor-shell")).toHaveAttribute(
      "data-mode",
      "medium"
    );

    await page.setViewportSize({ width: 350, height: 720 });
    await expect(page.locator(".editor-shell")).toHaveAttribute(
      "data-mode",
      "narrow"
    );
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
