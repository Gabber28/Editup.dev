import { test, expect } from "@playwright/test";
import { navigateToEditor } from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

test.describe("E2E multi-edit: multiple edits generate independent snapshots", () => {
  test("editing colors then switching to spacing keeps both", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("#ff0000");

    await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
    const spacingInputs = page.locator(".panel-content input[type='text']");
    await spacingInputs.first().fill("20px");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const props = calls.map(
      (c) => (c.args as { property: string }).property,
    );
    expect(props.some((p) => p.includes("color") || p.includes("background"))).toBe(true);
    expect(props.some((p) => p.includes("margin") || p.includes("padding"))).toBe(true);
  });

  test("switching back to colors tab preserves edited values", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("hotpink");

    await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
    await page.locator('.panel-tabs__tab:has-text("Colors")').click();

    const firstInput = page.locator(".panel-content input[type='text']").first();
    await expect(firstInput).toHaveValue("hotpink");
  });

  test("all 6 panel tabs are navigable", async ({ page }) => {
    await navigateToEditor(page);

    const panels = ["Colors", "Spacing", "Type", "Border", "Layout", "Effects"];
    for (const panel of panels) {
      await page.locator(`.panel-tabs__tab:has-text("${panel}")`).click();
      await expect(
        page.locator(`.panel-tabs__tab:has-text("${panel}")`),
      ).toHaveClass(/--active/);
    }
  });

  test("Apply button is enabled when any property has changes", async ({ page }) => {
    await navigateToEditor(page);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();

    await page.locator('.panel-tabs__tab:has-text("Effects")').click();
    const inputs = page.locator(".panel-content input[type='text']");
    await inputs.first().fill("0.5");

    await expect(applyBtn).toBeEnabled();
  });

  test("editing across multiple panels sends correct preview calls", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("navy");

    await page.locator('.panel-tabs__tab:has-text("Type")').click();
    const typeInputs = page.locator(".panel-content input[type='text']");
    await typeInputs.first().fill("24px");

    await page.locator('.panel-tabs__tab:has-text("Border")').click();
    const borderInputs = page.locator(".panel-content input[type='text']");
    await borderInputs.first().fill("2px");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});
