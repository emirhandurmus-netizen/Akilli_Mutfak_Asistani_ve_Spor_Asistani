const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.UI_SMOKE_BASE_URL || 'http://localhost:8082';
const ADMIN_EMAIL = process.env.UI_SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.UI_SMOKE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('UI_SMOKE_ADMIN_EMAIL and UI_SMOKE_ADMIN_PASSWORD must be set for admin UI smoke tests.');
}

async function openHome(page) {
  const criticalConsoleErrors = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      (text.includes('ERR_FILE_NOT_FOUND') ||
        text.includes('No suitable URL request handler') ||
        text.includes('Unhandled promise rejection'))
    ) {
      criticalConsoleErrors.push(text);
    }
  });

  await page.goto(BASE_URL);
  await expect(page.getByText('Gunluk Besin Takibi')).toBeVisible({
    timeout: 30000,
  });
  expect(criticalConsoleErrors, 'critical console errors').toEqual([]);
}

test('home nutrition history opens', async ({ page }) => {
  await openHome(page);
  await page.getByText('Gecmis', { exact: true }).click();
  await expect(page.getByText('Besin gecmisi')).toBeVisible();
});

test('assistant modal opens and quick questions render', async ({ page }) => {
  await openHome(page);
  await page.getByText('AI ile konus').click();
  await expect(page.getByText('AI ile Sohbet')).toBeVisible();
  await expect(page.getByText('AI nasil calisiyor?')).toBeVisible();
  await expect(page.getByText('Besin takibi nasil yenilenir?')).toBeVisible();
});

test('kitchen and sports screens open from home cards', async ({ page }) => {
  await openHome(page);
  await page.getByText('Akilli Mutfak').last().click();
  await expect(page.getByText('Akilli Mutfak Asistani')).toBeVisible();
  await expect(page.getByText('AI ile tarif olustur')).toBeVisible();

  await page.goto(BASE_URL);
  await expect(page.getByText('Gunluk Besin Takibi')).toBeVisible();
  await page.getByText('Spor').last().click();
  await expect(page.getByText('AI Spor ve Saglik Kocu', { exact: true })).toBeVisible();
  await expect(page.getByText('AI ile plan olustur')).toBeVisible();
});

test('recipe detail does not show other AI recipes button', async ({ page }) => {
  await openHome(page);
  await page.getByText('Akilli Mutfak').last().click();
  await expect(page.getByText('Onerilen Tarifler')).toBeVisible();
  await page.getByText('Detay', { exact: true }).first().click();
  await expect(page.getByText('Diger AI tarifleri', { exact: true })).toHaveCount(0);
});

test('sports plan detail renders a web video frame', async ({ page }) => {
  test.setTimeout(90000);
  await openHome(page);
  await page.getByText('Spor').last().click();
  await expect(page.getByText('AI Spor ve Saglik Kocu', { exact: true })).toBeVisible();
  await page.getByText('AI ile plan olustur').click();
  await expect(page.getByText('Egzersiz videosu').first()).toBeVisible({
    timeout: 90000,
  });
  await expect(page.locator('iframe').first()).toBeVisible();
});

test('admin can log in and open admin panel', async ({ page }) => {
  await openHome(page);
  await page.locator('div[tabindex]').first().click();
  await expect(page.getByText('Giris yap', { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder('E-posta').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Sifre').fill(ADMIN_PASSWORD);
  await page.getByText('Giris yap', { exact: true }).last().click();
  await expect(page.getByText('Merhaba', { exact: true })).toBeVisible({
    timeout: 30000,
  });

  await page.locator('div[tabindex]').first().click();
  await expect(page.getByText('Ayarlar', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin paneli', { exact: true })).toBeVisible();
  await page.getByText('Admin paneli', { exact: true }).click();
  await expect(page.getByPlaceholder('https://')).toBeVisible();
});
