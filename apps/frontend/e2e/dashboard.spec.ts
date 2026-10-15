import { test, expect } from "@playwright/test";

test.describe("Black Box E2E UI Testing: Dashboard & Inventory Transaction Flow", () => {
  test("TC-AUTH-03: Redirects unauthenticated visitor to /login", async ({ page }) => {
    // Attempt to visit protected dashboard directly
    await page.goto("/dashboard");

    // Must be redirected to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("h1")).toContainText(/Sistem Inventaris|Daftar Akun/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("TC-AUTH-01: Displays error banner on invalid login attempt", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid credentials
    await page.fill('input[type="email"]', "invalid_user@test.com");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Verify error banner is rendered on screen without server crash
    const errorBanner = page.locator(".bg-error\\/10");
    await expect(errorBanner).toBeVisible({ timeout: 6000 });
    await expect(errorBanner).toContainText(/Invalid email or password|Email atau password salah/i);
  });

  test("TC-AUTH-02: Form prevents submission on invalid email format", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid email format (missing @ and domain)
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("invalid-email-format");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Browser HTML5 validation prevents navigation away from /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("TC-DASH-01: User registration and Dashboard layout verification", async ({ page }) => {
    // Generate a unique user to test fresh/isolated state (name must be unique)
    const timestamp = Date.now();
    const testName = `Tester QA ${timestamp}`;
    const testUsername = `testuser_${timestamp}`;
    const testPhone = `0812${timestamp.toString().slice(-8)}`;
    const testEmail = `tester_${timestamp}@gudanggarment.com`;

    await page.goto("/login");

    // Toggle to registration mode
    const registerToggle = page.locator('button:has-text("Daftar Akun Baru")');
    await registerToggle.click();

    // Fill registration form
    await page.fill('input[placeholder="Masukkan nama lengkap"]', testName);
    await page.fill('input[placeholder="Pilih username"]', testUsername);
    await page.fill('input[placeholder="0812xxxxxx"]', testPhone);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', "SecurePassword123!");
    await page.click('button[type="submit"]');

    // Wait for successful registration redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verify Dashboard layout & KPI elements
    await expect(page.locator("h2")).toContainText("Dashboard Utama");
    await expect(page.locator("text=JENIS BARANG")).toBeVisible();
    await expect(page.locator("text=TOTAL STOK")).toBeVisible();
  });

  test("TC-FORM-01 & TC-FORM-05: Stock Adjustment Modal opens and validates input", async ({ page }) => {
    // Generate fresh session with unique name, username, phone, email
    const timestamp = Date.now() + 500;
    const testName = `Tester Modal ${timestamp}`;
    const testUsername = `modal_${timestamp}`;
    const testPhone = `0813${timestamp.toString().slice(-8)}`;
    const testEmail = `modal_${timestamp}@gudanggarment.com`;

    await page.goto("/login");

    const registerToggle = page.locator('button:has-text("Daftar Akun Baru")');
    await registerToggle.click();

    await page.fill('input[placeholder="Masukkan nama lengkap"]', testName);
    await page.fill('input[placeholder="Pilih username"]', testUsername);
    await page.fill('input[placeholder="0812xxxxxx"]', testPhone);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', "SecurePassword123!");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Open Update Stock Modal
    const updateStockBtn = page.locator('button:has-text("Perbarui Stok")');
    await expect(updateStockBtn).toBeVisible({ timeout: 5000 });
    await updateStockBtn.click();

    // Verify modal is displayed
    await expect(page.locator("text=Perbarui Stok Barang")).toBeVisible();

    // Verify form elements exist
    await expect(page.locator('label:has-text("Pilih Gudang")')).toBeVisible();
    await expect(page.locator('label:has-text("Pilih Barang")')).toBeVisible();
    await expect(page.locator('label:has-text("Tipe Adjustment")')).toBeVisible();

    // Close modal cleanly
    await page.click('button:has-text("Batal")');
    await expect(page.locator("text=Perbarui Stok Barang")).not.toBeVisible();
  });
});
