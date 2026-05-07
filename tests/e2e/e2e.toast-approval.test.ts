import { test, expect } from "@playwright/test";
import {
  navigateToEditor,
  clickApply,
  waitForToast,
  approveToast,
  rejectToast,
} from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

test.describe("E2E toast approval: approve, reject, and express mode", () => {
  test("toast shows plan summary and file count", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("red");
    await clickApply(page);

    await waitForToast(page);
    const toast = page.locator('[role="alertdialog"]');
    await expect(toast).toContainText("Apply changes");
    await expect(toast).toContainText("1 file");
    await expect(toast).toContainText("Button.tsx");
  });

  test("clicking Apply in toast proceeds to execution", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("red");
    await clickApply(page);
    await waitForToast(page);
    await approveToast(page);

    await page.waitForSelector("text=Applied", { timeout: 30_000 });
  });

  test("clicking Cancel rejects without executing", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("red");
    await clickApply(page);
    await waitForToast(page);
    await rejectToast(page);

    await page.waitForTimeout(1000);
    const commitCalls = await getInvokeCalls(page, "git_auto_commit");
    expect(commitCalls.length).toBe(0);
  });

  test("Enter key approves the toast", async ({ page }) => {
    await navigateToEditor(page);

    await page.locator(".panel-content input[type='text']").first().fill("red");
    await clickApply(page);
    await waitForToast(page);
    await page.keyboard.press("Enter");

    await page.waitForSelector("text=Applied", { timeout: 30_000 });
  });

  test("express mode toggle is visible for pro plan", async ({ page }) => {
    await navigateToEditor(page);

    const express = page.locator(".apply-bar__express");
    await expect(express).toBeVisible();
    await expect(express).toContainText("Express");
  });

  test("express mode checkbox toggles", async ({ page }) => {
    await navigateToEditor(page);

    const checkbox = page.locator(".apply-bar__express input[type='checkbox']");
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });
});
