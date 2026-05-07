import { test, expect } from "@playwright/test";
import {
  navigateToEditor,
  clickApply,
  waitForToast,
  approveToast,
} from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

test.describe("E2E combined flow: visual + text instructions in same apply", () => {
  test("AI input field is visible and accepts text", async ({ page }) => {
    await navigateToEditor(page);

    const aiInput = page.locator(".ai-input__field");
    await expect(aiInput).toBeVisible();
    await expect(aiInput).toHaveAttribute("placeholder", /describe/i);

    await aiInput.fill("add hover glow effect");
    await expect(aiInput).toHaveValue("add hover glow effect");
  });

  test("text instruction combined with visual change enables Apply", async ({ page }) => {
    await navigateToEditor(page);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();

    const aiInput = page.locator(".ai-input__field");
    await aiInput.fill("add a subtle shadow");

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("#222");

    await expect(applyBtn).toBeEnabled();
  });

  test("combined visual + text triggers apply with both", async ({ page }) => {
    await navigateToEditor(page);

    const colorInputs = page.locator(".panel-content input[type='text']");
    await colorInputs.first().fill("#333");

    const aiInput = page.locator(".ai-input__field");
    await aiInput.fill("increase font size on mobile");

    await clickApply(page);
    await waitForToast(page);
    await approveToast(page);

    await page.waitForSelector("text=Applied", { timeout: 30_000 });

    const commitCalls = await getInvokeCalls(page, "git_auto_commit");
    expect(commitCalls.length).toBe(1);
  });

  test("toast shows file info for combined changes", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("navy");

    const aiInput = page.locator(".ai-input__field");
    await aiInput.fill("add border radius");

    await clickApply(page);
    await waitForToast(page);

    const toast = page.locator('[role="alertdialog"]');
    await expect(toast).toContainText("Apply changes");
    await expect(toast).toContainText("Button.tsx");
  });

  test("AI input clears after successful apply + Done", async ({ page }) => {
    await navigateToEditor(page);

    const aiInput = page.locator(".ai-input__field");
    await aiInput.fill("add animation");

    await page.locator(".panel-content input[type='text']").first().fill("red");
    await clickApply(page);
    await waitForToast(page);
    await approveToast(page);

    await page.waitForSelector("text=Applied", { timeout: 30_000 });
    await page.locator('button:has-text("Done")').click();

    const freshInput = page.locator(".ai-input__field");
    await expect(freshInput).toHaveValue("");
  });
});
