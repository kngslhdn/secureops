const { test, expect } = require('@playwright/test');

test.describe('SECUREOPS public entry page', () => {
  test('renders the release title and main entry choices', async ({ page }) => {
    const sameOriginFailures = [];
    page.on('response', response => {
      if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) {
        sameOriginFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/SECUREOPS.*Security Operations/i);
    await expect(page.locator('#choices')).toBeVisible();
    await expect(page.getByRole('link', { name: /ADMIN CONSOLE/i })).toHaveAttribute('href', /admin/);
    expect(sameOriginFailures, 'same-origin assets should not return HTTP errors').toEqual([]);
  });

  test('does not create horizontal overflow on a mobile viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile viewport only');
    await page.goto('/');
    await expect(page.locator('#choices')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document, 'page should fit the mobile viewport without horizontal scrolling')
      .toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});

test.describe('SECUREOPS admin entry', () => {
  test('serves the admin login document and required form controls', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page).toHaveTitle(/SECUREOPS.*Security Admin/i);
    await expect(page.locator('#loginForm')).toHaveCount(1);
    await expect(page.locator('#email')).toHaveAttribute('type', 'email');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#loginBtn')).toContainText(/SIGN IN/i);
    await expect(page.locator('#googleLoginBtn')).toBeAttached();
  });
});
