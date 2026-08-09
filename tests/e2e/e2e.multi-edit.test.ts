import { test, expect } from "@playwright/test";
import { navigateToEditor, openPanel } from "./helpers/e2e-helpers.js";
import { getInvokeCalls } from "./helpers/tauri-mock.js";

const firstTextInput = (page: import("@playwright/test").Page) =>
  page.locator(".panel-content input[type='text']").first();

test.describe("E2E multi-edit: multiple edits generate independent snapshots", () => {
  test("editing spacing then switching to effects keeps both", async ({
    page,
  }) => {
    await navigateToEditor(page);

    await openPanel(page, "Spacing");
    await firstTextInput(page).fill("20px");

    await openPanel(page, "Effects");
    await firstTextInput(page).fill("0.5");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const props = calls.map((c) => (c.args as { property: string }).property);
    expect(
      props.some((p) => p.includes("margin") || p.includes("padding"))
    ).toBe(true);
    expect(
      props.some((p) => p.includes("opacity") || p.includes("shadow"))
    ).toBe(true);
  });

  test("switching back to a panel preserves edited values", async ({
    page,
  }) => {
    await navigateToEditor(page);

    await openPanel(page, "Spacing");
    await firstTextInput(page).fill("18px");

    await openPanel(page, "Effects");
    await openPanel(page, "Spacing");

    await expect(firstTextInput(page)).toHaveValue("18px");
  });

  test("every panel in the bar is navigable", async ({ page }) => {
    await navigateToEditor(page);

    // Derived from the section registry, so the bar is whatever applies to the
    // selected element — a <button> with text: universals + Typography + Link.
    const tabs = page.locator(".panel-tabs__tab");
    const labels = await tabs.allTextContents();
    expect(labels).toEqual([
      "Layout",
      "Spacing",
      "Effects",
      "Colors",
      "Borders",
      "Typography",
      "Link",
      "Source",
    ]);

    for (const label of labels) {
      await openPanel(page, label);
      await expect(
        page.locator(`.panel-tabs__tab:has-text("${label}")`)
      ).toHaveClass(/--active/);
    }
  });

  test("Apply button is enabled when any property has changes", async ({
    page,
  }) => {
    await navigateToEditor(page);

    const applyBtn = page.locator(".apply-bar__btn--primary");
    await expect(applyBtn).toBeDisabled();

    await openPanel(page, "Effects");
    await firstTextInput(page).fill("0.5");

    await expect(applyBtn).toBeEnabled();
  });

  test("editing across multiple panels sends correct preview calls", async ({
    page,
  }) => {
    await navigateToEditor(page);

    await openPanel(page, "Spacing");
    await firstTextInput(page).fill("6px");

    await openPanel(page, "Typography");
    await firstTextInput(page).fill("24px");

    await openPanel(page, "Borders");
    await firstTextInput(page).fill("2px");

    const calls = await getInvokeCalls(page, "preview_style");
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});
