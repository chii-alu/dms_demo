import { expect, test } from "@playwright/test";

test("landing page links to Manage and Dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MELA", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Manage/ })).toHaveAttribute("href", "/manage");
  await expect(page.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/dashboard");
});

test("signed-out visitors to /manage are sent to login with a return path", async ({ page }) => {
  await page.goto("/manage/registry");
  await expect(page).toHaveURL(/\/login\?next=%2Fmanage%2Fregistry$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("signed-out visitors to /dashboard are sent to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("public form route is reachable without login", async ({ page }) => {
  await page.goto("/f/HENT-M-001-REG");
  await expect(page.getByText("Form HENT-M-001-REG")).toBeVisible();
});
