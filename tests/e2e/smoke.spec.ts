import { expect, test, type Page } from '@playwright/test';
import { readCredentials } from './environment';

const staffCredentials = readCredentials(
  'E2E_EMAIL',
  'E2E_PASSWORD',
  'el smoke autenticado de staff',
);

async function signInAsStaff(page: Page) {
  if (!staffCredentials) return;
  await page.goto('/');
  await page.getByLabel(/correo/i).fill(staffCredentials.email);
  await page.getByLabel(/contraseña/i).fill(staffCredentials.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /cerrar sesión|salir/i }),
  ).toBeVisible();
}

test('la aplicación carga sin una pantalla fatal', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByText(/configuración inválida/i)).toHaveCount(0);
});

test('un empleado de preview puede iniciar sesión', async ({ page }) => {
  test.skip(
    staffCredentials === null,
    'Configurar E2E_EMAIL y E2E_PASSWORD para este flujo.',
  );
  if (!staffCredentials) return;

  await signInAsStaff(page);
});

test('el modal de cuenta conserva el foco y cierra con teclado', async ({ page }) => {
  test.skip(
    staffCredentials === null,
    'Configurar E2E_EMAIL y E2E_PASSWORD para este flujo.',
  );
  if (!staffCredentials) return;

  await signInAsStaff(page);
  await page.getByRole('button', { name: '+ Nueva cuenta', exact: true }).click();

  const dialog = page.getByRole('dialog', {
    name: 'Abrir una cuenta',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Cerrar', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('radio', { name: 'Mesa', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
