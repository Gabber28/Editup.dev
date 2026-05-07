import { test, expect } from "@playwright/test";
import {
  gotoApp,
  navigateToEditor,
  clickApply,
  waitForToast,
  approveToast,
} from "./helpers/e2e-helpers.js";
import {
  setAgentConnected,
  emitSnapshot,
  getInvokeCalls,
} from "./helpers/tauri-mock.js";

test.describe("E2E full flow: proxy → edit → plan → toast → execute → commit", () => {
  test("setup screen shows and connects", async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator(".setup-title")).toHaveText("EditUp");
    await expect(page.locator(".setup-input").first()).toBeVisible();
  });

  test("transitions from setup to editor after agent connection", async ({ page }) => {
    await gotoApp(page);

    const urlInput = page.locator(".setup-input").first();
    await urlInput.fill("http://localhost:3000");
    await page.locator(".setup-btn").first().click();

    const calls = await getInvokeCalls(page, "set_target_origin");
    expect(calls.length).toBeGreaterThanOrEqual(1);

    await setAgentConnected(page, true);
    await page.waitForSelector("text=Agent connected", { timeout: 5000 });

    const rootInput = page.locator(".setup-input").first();
    await rootInput.fill("C:\\Users\\test\\project");
    await page.locator('button:has-text("Start Editing")').click();

    await page.waitForSelector(".editor-shell", { timeout: 5000 });
    await emitSnapshot(page);
    await expect(page.locator(".element-identity__tag")).toBeVisible();
  });

  test("complete flow: edit → plan → approve → execute → commit", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("rgb(0, 0, 0)");

    const previewCalls = await getInvokeCalls(page, "preview_style");
    expect(previewCalls.length).toBeGreaterThanOrEqual(1);

    await clickApply(page);

    await waitForToast(page);
    const toast = page.locator('[role="alertdialog"]');
    await expect(toast).toBeVisible();
    await expect(toast.locator("text=Apply changes")).toBeVisible();
    await expect(toast.locator("text=1 file")).toBeVisible();

    await approveToast(page);

    await page.waitForSelector("text=Applied", { timeout: 30_000 });
    await expect(page.locator("text=abc1234def")).toBeVisible();

    const commitCalls = await getInvokeCalls(page, "git_auto_commit");
    expect(commitCalls.length).toBe(1);

    await expect(page.locator('button:has-text("Revert")')).toBeVisible();
    await expect(page.locator('button:has-text("Done")')).toBeVisible();
  });
});
