// End-to-end: a staff admin creates a session, a participant registers through the public form,
// and the test deletes the session afterwards. Runs only when E2E_EMAIL and E2E_PASSWORD are set,
// because it writes to the database. Use a test session in a test project, never real data.
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run the registration flow.");

test("register through the public form, then clean up", async ({ page }) => {
  const title = `E2E ${new Date().toISOString().slice(0, 19)}`;
  const participant = `e2e-${Date.now()}@mela.test`;

  // Sign in.
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/manage/);

  // Create a session under Masterclass (an open intervention).
  await page.getByRole("link", { name: /Masterclass/ }).first().click();
  await page.getByRole("button", { name: "New session" }).click();
  await page.getByLabel(/Session title/).fill(title);
  await page.getByLabel(/Session dates/).fill("2099-06-01");
  await page.getByRole("button", { name: "Create session and forms" }).click();
  await expect(page).toHaveURL(/\/manage\/sessions\/[0-9a-f-]+\/forms/);
  const sessionUrl = page.url().replace(/\/forms.*$/, "");

  // Open the registration form and read its code.
  const code = (await page.locator("text=/^[A-Z]+-[A-Z]+-\\d{3}-REG$/").first().textContent())!.trim();
  await page.getByLabel("Registration form status").selectOption("open");

  // Register through the public form.
  await page.goto(`/f/${code}`);
  await page.getByLabel(/Full name/).fill("E2E Participant");
  await page.getByLabel(/Email address/).fill(participant);
  await page.getByLabel(/Phone number/).fill("+250 780000000");
  await page.getByLabel("Female", { exact: true }).check();
  await page.getByLabel("18–24", { exact: true }).check();
  await page.getByLabel(/Country of residence/).fill("Rwanda");
  await page.getByLabel("Student", { exact: true }).check();
  await page.getByLabel("No", { exact: true }).check();
  await page.getByLabel(/I consent/).check();
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByText("You are registered.")).toBeVisible();

  // Clean up: delete the test session (its registrations go with it).
  await page.goto(`${sessionUrl}/details`);
  await page.getByRole("button", { name: "Delete session" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete session" }).click();
  await expect(page).toHaveURL(/\/manage\/interventions\//);
});
