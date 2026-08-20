import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readCredentials, supabasePublishableKey, supabaseUrl } from './environment';

const adminCredentials = readCredentials(
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'el flujo administrativo y la carrera de cierre',
);

type CloseRpcResponse = {
  ok: boolean;
  tab: { id: string; status: string };
  receipt: { id: string; close_request_id: string; receipt_code: string };
};

const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

test('un administrador completa producto, cuenta, consumo, cierre e impresión', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1440x900',
    'El flujo transaccional escribe datos una sola vez; los smoke cubren los tres viewports.',
  );
  test.skip(
    adminCredentials === null,
    'Configurar E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para el flujo administrativo.',
  );
  if (!adminCredentials) return;
  test.setTimeout(120_000);

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const productName = `Producto E2E ${suffix}`;
  const sku = `E2E-${suffix}`;
  const accountLabel = `Mesa E2E ${suffix}`;
  const unitPrice = 2_500;

  await page.goto('/login');
  await page.getByLabel('Correo', { exact: true }).fill(adminCredentials.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(adminCredentials.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Cuentas abiertas', exact: true }),
  ).toBeVisible();

  await page.goto('/inventario');
  await expect(
    page.getByRole('heading', { name: 'Inventario', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Nuevo producto', exact: true }).click();

  const productDialog = page.getByRole('dialog', {
    name: 'Nuevo producto',
    exact: true,
  });
  await productDialog.getByLabel('Nombre', { exact: true }).fill(productName);
  await productDialog.getByLabel(/^Código \/ SKU/).fill(sku);
  await productDialog.getByLabel(/^Precio de venta/).fill(String(unitPrice));
  await productDialog.getByLabel('Existencia inicial', { exact: true }).fill('20');
  await productDialog
    .getByRole('button', { name: 'Guardar producto', exact: true })
    .click();
  await expect(productDialog).toBeHidden();

  await page
    .getByRole('searchbox', { name: 'Buscar producto', exact: true })
    .fill(productName);
  const inventoryRow = page.getByRole('row').filter({ hasText: productName });
  await expect(inventoryRow).toHaveCount(1);
  await expect(
    inventoryRow.getByRole('cell', { name: '20 un.', exact: true }),
  ).toBeVisible();

  await page.goto('/cuentas');
  await page.getByRole('button', { name: '+ Nueva cuenta', exact: true }).click();
  const accountDialog = page.getByRole('dialog', {
    name: 'Abrir una cuenta',
    exact: true,
  });
  await accountDialog
    .getByLabel('Nombre o número de mesa', { exact: true })
    .fill(accountLabel);
  await accountDialog
    .getByRole('button', { name: 'Abrir cuenta', exact: true })
    .click();

  await expect(page).toHaveURL(/\/cuentas\/[0-9a-f-]{36}$/i);
  await expect(
    page.getByRole('heading', { name: accountLabel, exact: true }),
  ).toBeVisible();

  const productOption = () =>
    page.getByRole('button').filter({
      has: page.getByText(productName, { exact: true }),
    });
  await page
    .getByRole('searchbox', { name: 'Buscar producto', exact: true })
    .fill(productName);
  await expect(
    productOption().getByText('20 disponibles', { exact: true }),
  ).toBeVisible();
  await productOption().click();

  const consumptionDialog = page.getByRole('dialog', {
    name: `Agregar ${productName}`,
    exact: true,
  });
  await consumptionDialog
    .getByRole('spinbutton', { name: 'Cantidad', exact: true })
    .fill('3');
  await expect(
    consumptionDialog.getByText('Subtotal', { exact: true }).locator('..'),
  ).toContainText(formatCop(unitPrice * 3));
  await consumptionDialog
    .getByRole('button', { name: 'Agregar a la cuenta', exact: true })
    .click();
  await expect(consumptionDialog).toBeHidden();

  const accumulatedTotal = page
    .getByText('Total acumulado', { exact: true })
    .locator('..');
  const quantityControl = page.getByLabel(`Cantidad de ${productName}`, {
    exact: true,
  });
  await expect(
    productOption().getByText('17 disponibles', { exact: true }),
  ).toBeVisible();
  await expect(quantityControl).toContainText('3');
  await expect(accumulatedTotal).toContainText(formatCop(unitPrice * 3));

  const addOne = quantityControl.getByRole('button', {
    name: 'Sumar uno',
    exact: true,
  });
  await addOne.click();
  await expect(quantityControl).toContainText('4');
  await addOne.click();
  await expect(quantityControl).toContainText('5');
  await expect(
    productOption().getByText('15 disponibles', { exact: true }),
  ).toBeVisible();
  await expect(accumulatedTotal).toContainText(formatCop(unitPrice * 5));

  await page.getByRole('button', { name: 'Cerrar cuenta', exact: true }).click();
  const closeDialog = page.getByRole('dialog', {
    name: 'Cerrar cuenta',
    exact: true,
  });
  await expect(closeDialog).toContainText(formatCop(unitPrice * 5));

  const tabId = new URL(page.url()).pathname.split('/').at(-1);
  expect(tabId).toMatch(/^[0-9a-f-]{36}$/i);
  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data: authData, error: authError } =
    await authClient.auth.signInWithPassword(adminCredentials);
  expect(authError).toBeNull();
  expect(authData.session).not.toBeNull();
  const accessToken = authData.session?.access_token;
  expect(accessToken).toBeTruthy();

  const closeRequestIds = [crypto.randomUUID(), crypto.randomUUID()];
  const closeThroughRest = async (requestId: string) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/close_tab`, {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_tab_id: tabId,
        p_request_id: requestId,
      }),
    });
    const body = (await response.json()) as CloseRpcResponse;
    expect(
      response.ok,
      `close_tab respondió HTTP ${response.status}: ${JSON.stringify(body)}`,
    ).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.tab.id).toBe(tabId);
    expect(body.tab.status).toBe('closed');
    return body;
  };

  const [firstClose, secondClose] = await Promise.all(
    closeRequestIds.map(closeThroughRest),
  );
  expect(firstClose.receipt.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(secondClose.receipt.id).toBe(firstClose.receipt.id);
  expect(secondClose.receipt.receipt_code).toBe(firstClose.receipt.receipt_code);
  expect(closeRequestIds).toContain(firstClose.receipt.close_request_id);
  expect(secondClose.receipt.close_request_id).toBe(
    firstClose.receipt.close_request_id,
  );

  await closeDialog
    .getByRole('button', { name: 'Confirmar y cerrar', exact: true })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/comprobantes/${firstClose.receipt.id}$`, 'i'),
  );
  const receipt = page.getByRole('article', { name: /^Comprobante / });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText(accountLabel);
  await expect(receipt).toContainText('COP');
  const receiptRow = receipt.getByRole('row').filter({ hasText: productName });
  await expect(receiptRow.getByRole('cell').nth(1)).toHaveText('5');
  await expect(receiptRow.getByRole('cell').nth(3)).toHaveText(
    formatCop(unitPrice * 5),
  );
  await expect(
    receipt.getByText('Total', { exact: true }).last().locator('..'),
  ).toContainText(formatCop(unitPrice * 5));

  await page.evaluate(() => {
    const browserRuntime = globalThis as typeof globalThis & {
      print: () => void;
      sessionStorage: { setItem: (key: string, value: string) => void };
    };
    browserRuntime.print = () => {
      browserRuntime.sessionStorage.setItem('e2e-print-called', 'true');
    };
  });
  await page
    .getByRole('button', { name: 'Imprimir / Guardar PDF', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const browserRuntime = globalThis as typeof globalThis & {
          sessionStorage: { getItem: (key: string) => string | null };
        };
        return browserRuntime.sessionStorage.getItem('e2e-print-called');
      }),
    )
    .toBe('true');
});
