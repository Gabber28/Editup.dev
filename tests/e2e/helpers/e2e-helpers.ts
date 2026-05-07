import type { Page } from "@playwright/test";
import {
  injectTauriMock,
  setAgentConnected,
  emitSnapshot,
} from "./tauri-mock.js";

export async function gotoApp(page: Page): Promise<void> {
  await injectTauriMock(page);
  await page.goto("/");
}

export async function navigateToEditor(page: Page): Promise<void> {
  await gotoApp(page);
  await page.waitForSelector(".setup-screen");

  const urlInput = page.locator(".setup-input").first();
  await urlInput.fill("http://localhost:3000");
  await page.locator(".setup-btn").first().click();

  await setAgentConnected(page, true);
  await page.waitForSelector('text=Agent connected', { timeout: 5000 });

  const rootInput = page.locator(".setup-input").first();
  await rootInput.fill("C:\\Users\\test\\project");
  await page.locator('button:has-text("Start Editing")').click();

  await page.waitForSelector(".editor-shell", { timeout: 5000 });
  await emitSnapshot(page);
  await page.waitForSelector(".element-identity__tag", { timeout: 5000 });
}

export async function clickApply(page: Page): Promise<void> {
  const btn = page.locator(".apply-bar__btn--primary");
  await btn.waitFor({ state: "visible" });
  await btn.click();
}

export async function waitForToast(page: Page): Promise<void> {
  await page.waitForSelector('[role="alertdialog"]', { timeout: 10_000 });
}

export async function approveToast(page: Page): Promise<void> {
  await page.locator('.toast__btn--primary').click();
}

export async function rejectToast(page: Page): Promise<void> {
  await page.locator('.toast__btn:has-text("Cancel")').click();
}

export async function waitForPhase(
  page: Page,
  text: string,
  timeout = 10_000,
): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout });
}

export async function emitPostEditSnapshot(page: Page): Promise<void> {
  await emitSnapshot(page, { "background-color": "rgb(0, 0, 0)" });
}
