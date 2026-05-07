import { test, expect } from "@playwright/test";
import { navigateToEditor } from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

test.describe("E2E preview: edits update visual in browser", () => {
  test("changing a color value calls preview_style", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("red");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const lastCall = calls[calls.length - 1] as {
      args: { property: string; value: string };
    };
    expect(lastCall.args.value).toBe("red");
  });

  test("changing multiple properties sends multiple preview calls", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("#000");
    await colorInputs.nth(1).fill("#fff");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test("Apply button becomes enabled after changing a value", async ({ page }) => {
    await navigateToEditor(page);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("blue");

    await expect(applyBtn).toBeEnabled();
  });

  test("switching panel tabs shows different property inputs", async ({ page }) => {
    await navigateToEditor(page);

    await expect(page.locator(".panel-tabs__tab--active")).toHaveText("Colors");

    await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
    await expect(page.locator('.panel-tabs__tab:has-text("Spacing")')).toHaveClass(/--active/);

    const spacingInputs = page.locator(".panel-content input[type='text']");
    await expect(spacingInputs.first()).toBeVisible();
  });

  test("preview_style is called with correct property name", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
    const spacingInputs = page.locator(".panel-content input[type='text']");
    await spacingInputs.first().fill("16px");

    const calls = await getInvokeCalls(page, "preview_style");
    const lastCall = calls[calls.length - 1] as {
      args: { property: string; value: string };
    };
    expect(lastCall.args.property).toMatch(/margin|padding/);
    expect(lastCall.args.value).toBe("16px");
  });
});
