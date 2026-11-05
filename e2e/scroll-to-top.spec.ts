import { test, expect } from "@playwright/test";

async function clientNavigate(page: import("@playwright/test").Page, href: string) {
  // Prefer a visible link; fall back to injecting a Next <a> click via history push + click.
  const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
  if (await link.count()) {
    await link.click();
    return;
  }
  await page.evaluate((to) => {
    const a = document.createElement("a");
    a.href = to;
    a.setAttribute("data-scroll-test", "1");
    document.body.appendChild(a);
    a.click();
  }, href);
}

test.describe("scroll to top on navigation", () => {
  test("client navigations always land at scrollY 0", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#main-content, main").first()).toBeVisible({
      timeout: 20_000,
    });

    // Scroll deep into the tall home (hero scrub) so mid-page would stick without reset.
    await page.evaluate(() => {
      window.scrollTo(0, Math.max(document.body.scrollHeight, 4000));
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);

    // Client-side nav via footer (visible after scroll) or injected link.
    await clientNavigate(page, "/products");
    await page.waitForURL(/\/products/, { timeout: 20_000 });
    await page.waitForTimeout(500);
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 })
      .toBe(0);

    // Scroll products, then navigate to cart — must reset again.
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    await clientNavigate(page, "/cart");
    await page.waitForURL(/\/cart/, { timeout: 20_000 });
    await page.waitForTimeout(500);
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 })
      .toBe(0);

    // Back to home from a scrolled cart — must be at top (hero start), not footer.
    await page.evaluate(() => window.scrollTo(0, 600));
    await clientNavigate(page, "/");
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
    await page.waitForTimeout(500);
    await expect
      .poll(async () => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 })
      .toBe(0);
  });
});
