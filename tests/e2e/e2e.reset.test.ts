import { test, expect } from "@playwright/test";
import {
  navigateToEditor,
  clickApply,
  waitForToast,
  approveToast,
} from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

test.describe("E2E reset: reset removes overrides", () => {
  test("Done button resets to idle state after apply", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("red");
    await clickApply(page);

    await waitForToast(page);
    await approveToast(page);

    await page.waitForSelector("text=Applied", { timeout: 30_000 });

    await page.locator('button:has-text("Done")').click();

    const resetCalls = await getInvokeCalls(page, "reset_overrides");
    expect(resetCalls.length).toBeGreaterThanOrEqual(1);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();
  });

  test("rejecting toast returns to idle without applying", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("green");
    await clickApply(page);

    await waitForToast(page);
    await page.locator('.toast__btn:has-text("Cancel")').click();

    const commitCalls = await getInvokeCalls(page, "git_auto_commit");
    expect(commitCalls.length).toBe(0);
  });

  test("Escape key dismisses toast and cancels apply", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("blue");
    await clickApply(page);

    await waitForToast(page);
    await page.keyboard.press("Escape");

    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();
  });
});
