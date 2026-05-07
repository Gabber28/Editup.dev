import { test, expect } from "@playwright/test";
import {
  navigateToEditor,
  clickApply,
  waitForToast,
  approveToast,
} from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

async function completeApplyFlow(page: import("@playwright/test").Page): Promise<void> {
  await page.locator(".panel-content input[type='text']").first().fill("red");
  await clickApply(page);
  await waitForToast(page);
  await approveToast(page);
  await page.waitForSelector("text=Applied", { timeout: 30_000 });
}

test.describe("E2E revert: Revert button executes git revert", () => {
  test("Revert button appears after successful apply", async ({ page }) => {
    await navigateToEditor(page);
    await completeApplyFlow(page);

    const revertBtn = page.locator('button:has-text("Revert")');
    await expect(revertBtn).toBeVisible();
  });

  test("clicking Revert calls git_revert", async ({ page }) => {
    await navigateToEditor(page);
    await completeApplyFlow(page);

    await page.locator('button:has-text("Revert")').click();

    const revertCalls = await getInvokeCalls(page, "git_revert");
    expect(revertCalls.length).toBe(1);
  });

  test("after revert, state returns to idle", async ({ page }) => {
    await navigateToEditor(page);
    await completeApplyFlow(page);

    await page.locator('button:has-text("Revert")').click();

    await page.waitForSelector(".apply-bar__btn--primary", { timeout: 5000 });
    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeVisible();
    await expect(applyBtn).toContainText("Apply");
  });

  test("commit hash is displayed in completed state", async ({ page }) => {
    await navigateToEditor(page);
    await completeApplyFlow(page);

    await expect(page.locator("text=abc1234def")).toBeVisible();
  });

  test("Done button resets without reverting", async ({ page }) => {
    await navigateToEditor(page);
    await completeApplyFlow(page);

    await page.locator('button:has-text("Done")').click();

    const revertCalls = await getInvokeCalls(page, "git_revert");
    expect(revertCalls.length).toBe(0);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeVisible();
    await expect(applyBtn).toBeDisabled();
  });
});
