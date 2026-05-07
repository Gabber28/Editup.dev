import { test, expect } from "@playwright/test";
import { navigateToEditor } from "./helpers/e2e-helpers.js";

test.describe("E2E layers: clicking layers updates editor", () => {
  test("layers panel shows selected element tag", async ({ page }) => {
    await navigateToEditor(page);

    const layerBtn = page.locator(".layers-panel button").first();
    await expect(layerBtn).toBeVisible();
    await expect(layerBtn).toContainText("button");
  });

  test("selected layer has active styling", async ({ page }) => {
    await navigateToEditor(page);

    const layerBtn = page.locator(".layers-panel button").first();
    const bgColor = await layerBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgColor).not.toBe("transparent");
  });

  test("element identity shows tag and class", async ({ page }) => {
    await navigateToEditor(page);

    const identity = page.locator(".element-identity__tag");
    await expect(identity).toContainText("button");
    await expect(identity).toContainText(".btn");
  });

  test("element identity shows source file path", async ({ page }) => {
    await navigateToEditor(page);

    const identity = page.locator(".element-identity");
    await expect(identity).toContainText("src/components/Button.tsx");
    await expect(identity).toContainText("12");
  });

  test("code box shows source snippet for selected element", async ({ page }) => {
    await navigateToEditor(page);

    const codeBox = page.locator(".code-box");
    await expect(codeBox).toBeVisible();
    await expect(codeBox).toContainText("button");
  });

  test("layers panel visible only in wide mode", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 720 });
    await navigateToEditor(page);

    const aside = page.locator("aside.layers-panel");
    await expect(aside).toBeVisible();

    await page.setViewportSize({ width: 600, height: 720 });
    await expect(aside).not.toBeVisible();
  });
});
