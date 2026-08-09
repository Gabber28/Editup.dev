import { test, expect } from "@playwright/test";
import { navigateToEditor } from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

/**
 * Spacing is the simplest panel to drive: plain text inputs that emit on every
 * change. Layout (the first tab) commits its rotation field only on Enter/blur,
 * and Colors is a swatch + popover, so neither is a good generic probe.
 */
async function openSpacing(
  page: import("@playwright/test").Page
): Promise<void> {
  await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
}

test.describe("E2E preview: edits update visual in browser", () => {
  test("changing a property value calls preview_style", async ({ page }) => {
    await navigateToEditor(page);
    await openSpacing(page);

    const inputs = page.locator(".panel-content input[type='text']");
    await inputs.first().fill("12px");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const lastCall = calls[calls.length - 1] as {
      args: { property: string; value: string };
    };
    expect(lastCall.args.value).toBe("12px");
  });

  test("changing multiple properties sends multiple preview calls", async ({
    page,
  }) => {
    await navigateToEditor(page);
    await openSpacing(page);

    const inputs = page.locator(".panel-content input[type='text']");
    await inputs.first().fill("4px");
    await inputs.nth(1).fill("8px");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test("Apply button becomes enabled after changing a value", async ({
    page,
  }) => {
    await navigateToEditor(page);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();

    await openSpacing(page);
    const inputs = page.locator(".panel-content input[type='text']");
    await inputs.first().fill("10px");

    await expect(applyBtn).toBeEnabled();
  });

  test("switching panel tabs shows different property inputs", async ({
    page,
  }) => {
    await navigateToEditor(page);

    // Tabs follow the section registry order, which starts with Layout.
    await expect(page.locator(".panel-tabs__tab--active")).toHaveText("Layout");

    await page.locator('.panel-tabs__tab:has-text("Spacing")').click();
    await expect(
      page.locator('.panel-tabs__tab:has-text("Spacing")')
    ).toHaveClass(/--active/);

    const spacingInputs = page.locator(".panel-content input[type='text']");
    await expect(spacingInputs.first()).toBeVisible();
  });

  test("preview_style is called with correct property name", async ({
    page,
  }) => {
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
