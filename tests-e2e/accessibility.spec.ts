import { expect, test } from "@playwright/test";
import { swimToFirstDiscovery } from "./helpers";

test("the comfort panel is operable from the keyboard", async ({ page }) => {
  await page.goto("/?reset=1");
  await page.keyboard.press("KeyO");
  await expect(page.getByTestId("settings-panel")).toBeVisible();

  // Arrow keys steer the camera during a dive, but they must still adjust the
  // field-of-view slider when it holds focus.
  const fov = page.locator("#opt-fov");
  await fov.focus();
  const fovBefore = Number(await fov.inputValue());
  await page.keyboard.press("ArrowRight");
  await expect(fov).toHaveValue(String(fovBefore + 1));
  await expect(page.locator("#opt-fov-value")).toHaveText(String(fovBefore + 1));

  // Space is the ascend key, but it must still toggle a focused checkbox.
  const bob = page.locator("#opt-bob");
  await bob.focus();
  const bobBefore = await bob.isChecked();
  await page.keyboard.press("Space");
  expect(await bob.isChecked()).toBe(!bobBefore);
});

test("the panel still closes with its shortcut while a control has focus", async ({ page }) => {
  await page.goto("/?reset=1");
  const panel = page.getByTestId("settings-panel");

  await page.keyboard.press("KeyO");
  await expect(panel).toBeVisible();

  // Focus lands on a control as soon as the player clicks or tabs to one; the
  // panel must not become impossible to dismiss with the key that opened it.
  await page.locator("#settings-calm").focus();
  await page.keyboard.press("KeyO");
  await expect(panel).toBeHidden();
});

test("the dive still responds to the keyboard after using the comfort panel", async ({ page }) => {
  await page.goto("/?reset=1");

  await page.keyboard.press("KeyO");
  // Clicking leaves the button focused; the dive keys must come back anyway.
  await page.locator("#settings-calm").click();
  await page.keyboard.press("KeyO");
  await expect(page.getByTestId("settings-panel")).toBeHidden();

  await swimToFirstDiscovery(page);
});

test("browser and OS shortcuts are not hijacked by the dive keys", async ({ page }) => {
  await page.goto("/?reset=1");

  // Copy is Ctrl+C on Linux/Windows and Cmd+C on macOS; neither is the Codex.
  await page.keyboard.press("Control+KeyC");
  await page.keyboard.press("Meta+KeyC");
  await expect(page.getByTestId("codex")).toBeHidden();

  // The unmodified key still works.
  await page.keyboard.press("KeyC");
  await expect(page.getByTestId("codex")).toBeVisible();
});

test("look sensitivity is adjustable and survives a reload", async ({ page }) => {
  // Two full page boots in one test, and Wave 8 tripled the world the boot
  // builds — under SwiftShader that outruns the default 60 s the same way
  // the volume-slider spec always has. Same remedy, same reasoning.
  test.setTimeout(120_000);
  await page.goto("/?reset=1");
  await page.keyboard.press("KeyO");

  const sensitivity = page.locator("#opt-sensitivity");
  await expect(sensitivity).toHaveValue("1");
  await sensitivity.fill("1.5");
  await expect(page.locator("#opt-sensitivity-value")).toHaveText("1.5");

  await page.goto("/");
  await page.keyboard.press("KeyO");
  await expect(page.locator("#opt-sensitivity")).toHaveValue("1.5");
});

test("holding a shortcut key toggles its panel only once", async ({ page }) => {
  await page.goto("/?reset=1");
  const overlay = page.getByTestId("sanctuary-overlay");

  await page.keyboard.press("KeyV");
  await expect(overlay).toBeVisible();

  // Keyboard auto-repeat fires further keydown events while the key is held;
  // they must not flip the sanctuary back and forth.
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV", repeat: true }));
    }
  });
  await expect(overlay).toBeVisible();
});
