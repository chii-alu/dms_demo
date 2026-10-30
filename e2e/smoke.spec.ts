import { expect, test } from "@playwright/test";

test("landing page links to Manage and Dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MELA", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Manage/ })).toHaveAttribute("href", "/manage");
  await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
});

test("signed-out visitors to /manage are sent to login with a return path", async ({ page }) => {
  await page.goto("/manage/admin/registry");
  await expect(page).toHaveURL(/\/login\?next=%2Fmanage%2Fadmin%2Fregistry$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("signed-out visitors to /dashboard are sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("public form route does not require login", async ({ page }) => {
  // Without a reachable database the page cannot load the form, but it must never send the visitor to login.
  await page.goto("/f/HENT-M-001-REG");
  await expect(page).toHaveURL(/\/f\/HENT-M-001-REG$/);
});
