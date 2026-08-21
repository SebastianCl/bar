import type { PostgrestError } from '@supabase/supabase-js';
import { AppError, normalizeError, requireOnline } from './errors';
import { bogotaDayRange } from './format';
import { createIntentId } from './intent';
import { getSupabase } from './supabase';
import type {
  AppRole,
  BarSettings,
  OpenTabSummary,
  Product,
  Profile,
  Receipt,
  ReceiptItem,
  ReferenceType,
  Tab,
  TabItem,
} from './database.types';
import type { OpenTabInput, ProductInput } from './schemas';
import { isDummyMode } from './env';
import {
  dummyAddConsumption,
  dummyBarSettings,
  dummyCancelTab,
  dummyCloseTab,
  dummyCreateProduct,
  dummyGetReceipt,
  dummyGetTabDetail,
  dummyListOpenTabs,
  dummyListProducts,
  dummyListReceipts,
  dummyOpenTab,
  dummyProfile,
  dummySetItemQuantity,
  dummySetStock,
  dummyUpdateProduct,
  dummyVoidItem,
} from './dummy-store';

export interface TabDetail {
  tab: Tab;
  items: TabItem[];
  total: number;
}

export interface ReceiptDetail {
  receipt: Receipt;
  items: ReceiptItem[];
}

export interface RpcEnvelope {
  ok?: boolean;
  code?: string;
  message?: string;
  error?: { code?: string; message?: string } | string;
  [key: string]: unknown;
}

function appCodeFromRpc(
  code: string | undefined,
): ConstructorParameters<typeof AppError>[0] {
  const normalized = code?.toUpperCase();
  if (normalized?.includes('STOCK')) return 'OUT_OF_STOCK';
  if (normalized?.includes('CLOSED')) return 'ACCOUNT_CLOSED';
  if (normalized?.includes('VALIDATION')) return 'VALIDATION';
  if (normalized?.includes('UNAUTHENTICATED')) return 'AUTH_REQUIRED';
  if (normalized?.includes('FORBIDDEN') || normalized?.includes('PERMISSION'))
    return 'FORBIDDEN';
  if (normalized?.includes('NOT_FOUND')) return 'NOT_FOUND';
  if (normalized?.includes('CONFLICT') || normalized?.includes('DUPLICATE'))
    return 'CONFLICT';
  return 'UNKNOWN';
}

function unwrapRpc<T>(data: unknown, error: PostgrestError | null): T {
  if (error) throw normalizeError(error);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError(
      'UNKNOWN',
      'La base de datos devolvió una respuesta inesperada.',
    );
  }

  const envelope = data as RpcEnvelope;
  if (envelope.ok === false) {
    const nestedError = typeof envelope.error === 'object' ? envelope.error : undefined;
    const code = envelope.code ?? nestedError?.code;
    const message =
      envelope.message ??
      nestedError?.message ??
      (typeof envelope.error === 'string' ? envelope.error : undefined) ??
      'No fue posible completar la operación.';
    throw new AppError(appCodeFromRpc(code), message);
  }

  return envelope as T;
}

function moneyFromDatabase(value: unknown): number {
  const numeric =
    typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) {
    throw new AppError('UNKNOWN', 'La base de datos devolvió un total inesperado.');
  }
  return numeric;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (isDummyMode()) return userId === dummyProfile.id ? dummyProfile : null;
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, role, is_active, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw normalizeError(error, 'No fue posible validar tu acceso.');
  return data;
}

export async function listProducts(options?: {
  activeOnly?: boolean;
}): Promise<Product[]> {
  if (isDummyMode()) return dummyListProducts(options?.activeOnly);
  let query = getSupabase()
    .from('products')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true });

  if (options?.activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw normalizeError(error, 'No fue posible cargar el inventario.');
  return data ?? [];
}

export async function listOpenTabs(): Promise<OpenTabSummary[]> {
  if (isDummyMode()) return dummyListOpenTabs();
  const { data, error } = await getSupabase()
    .from('open_tabs_summary')
    .select('*')
    .order('opened_at', { ascending: true });

  if (error) throw normalizeError(error, 'No fue posible cargar las cuentas abiertas.');
  return data ?? [];
}

export async function getBarSettings(): Promise<BarSettings | null> {
  if (isDummyMode()) return dummyBarSettings;
  const { data, error } = await getSupabase()
    .from('bar_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error)
    throw normalizeError(error, 'No fue posible cargar la información del bar.');
  return data;
}

export async function getTabDetail(tabId: string): Promise<TabDetail> {
  if (isDummyMode()) return dummyGetTabDetail(tabId);
  const [tabResult, itemsResult, summaryResult, receiptResult] = await Promise.all([
    getSupabase().from('tabs').select('*').eq('id', tabId).maybeSingle(),
    getSupabase()
      .from('tab_items')
      .select('*')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: true }),
    getSupabase()
      .from('open_tabs_summary')
      .select('total')
      .eq('id', tabId)
      .maybeSingle(),
    getSupabase().from('receipts').select('total').eq('tab_id', tabId).maybeSingle(),
  ]);

  if (tabResult.error)
    throw normalizeError(tabResult.error, 'No fue posible cargar la cuenta.');
  if (!tabResult.data)
    throw new AppError('NOT_FOUND', 'La cuenta solicitada no existe.');
  if (itemsResult.error)
    throw normalizeError(itemsResult.error, 'No fue posible cargar los consumos.');
  if (summaryResult.error)
    throw normalizeError(
      summaryResult.error,
      'No fue posible cargar el total de la cuenta.',
    );
  if (receiptResult.error)
    throw normalizeError(
      receiptResult.error,
      'No fue posible cargar el total de la cuenta.',
    );

  const items = itemsResult.data ?? [];
  const authoritativeTotal =
    summaryResult.data?.total ?? receiptResult.data?.total ?? 0;
  const total = moneyFromDatabase(authoritativeTotal);
  return { tab: tabResult.data, items, total };
}

export interface ReceiptPage {
  items: Receipt[];
  hasMore: boolean;
}

export async function listReceipts(
  options: {
    pageSize?: number;
    offset?: number;
    search?: string;
    date?: string;
  } = {},
): Promise<ReceiptPage> {
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  if (isDummyMode()) {
    let rows = dummyListReceipts();
    const search = options.search?.trim().toLocaleLowerCase('es-CO');
    if (search)
      rows = rows.filter(
        (row) =>
          row.receipt_code.toLocaleLowerCase('es-CO').includes(search) ||
          row.reference_label_snapshot.toLocaleLowerCase('es-CO').includes(search),
      );
    const dayRange = options.date ? bogotaDayRange(options.date) : null;
    if (dayRange)
      rows = rows.filter(
        (row) => row.issued_at >= dayRange.start && row.issued_at < dayRange.end,
      );
    const page = rows.slice(offset, offset + pageSize);
    return { items: page, hasMore: offset + pageSize < rows.length };
  }
  let query = getSupabase()
    .from('receipts')
    .select('*')
    .order('issued_at', { ascending: false })
    .order('id', { ascending: false });

  const search = options.search?.trim().replace(/[^\p{L}\p{N}\s#-]/gu, ' ');
  if (search) {
    query = query.or(
      `receipt_code.ilike.%${search}%,reference_label_snapshot.ilike.%${search}%`,
    );
  }

  const dayRange = options.date ? bogotaDayRange(options.date) : null;
  if (dayRange)
    query = query.gte('issued_at', dayRange.start).lt('issued_at', dayRange.end);

  const { data, error } = await query.range(offset, offset + pageSize);

  if (error)
    throw normalizeError(error, 'No fue posible cargar el historial de ventas.');
  const rows = data ?? [];
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function getReceiptDetail(receiptId: string): Promise<ReceiptDetail> {
  if (isDummyMode()) return dummyGetReceipt(receiptId);
  const [receiptResult, itemsResult] = await Promise.all([
    getSupabase().from('receipts').select('*').eq('id', receiptId).maybeSingle(),
    getSupabase()
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('id', { ascending: true }),
  ]);

  if (receiptResult.error)
    throw normalizeError(receiptResult.error, 'No fue posible cargar el comprobante.');
  if (!receiptResult.data)
    throw new AppError('NOT_FOUND', 'El comprobante solicitado no existe.');
  if (itemsResult.error)
    throw normalizeError(
      itemsResult.error,
      'No fue posible cargar el detalle del comprobante.',
    );

  return { receipt: receiptResult.data, items: itemsResult.data ?? [] };
}

export async function openTab(
  input: OpenTabInput,
  requestId = createIntentId(),
): Promise<Tab> {
  requireOnline();
  if (isDummyMode()) return dummyOpenTab(input, requestId);
  const referenceType: ReferenceType = input.tableLabel ? 'table' : 'customer';
  const referenceLabel = input.tableLabel || input.customerName;
  const { data, error } = await getSupabase().rpc('open_tab', {
    p_reference_type: referenceType,
    p_reference_label: referenceLabel,
    p_request_id: requestId,
  });
  return unwrapRpc<{ tab: Tab }>(data, error).tab;
}

export async function createProduct(
  input: ProductInput & { initialStock: number },
  requestId = createIntentId(),
): Promise<Product> {
  requireOnline();
  if (isDummyMode()) return dummyCreateProduct(input);
  const { data, error } = await getSupabase().rpc('create_product', {
    p_sku: input.sku || null,
    p_name: input.name,
    p_price: input.salePrice,
    p_opening_stock: input.initialStock,
    p_request_id: requestId,
  });
  return unwrapRpc<{ product: Product }>(data, error).product;
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
): Promise<Product> {
  requireOnline();
  if (isDummyMode()) return dummyUpdateProduct(productId, input);
  const { data, error } = await getSupabase().rpc('update_product', {
    p_product_id: productId,
    p_sku: input.sku || null,
    p_name: input.name,
    p_price: input.salePrice,
    p_is_active: input.isActive,
  });
  return unwrapRpc<{ product: Product }>(data, error).product;
}

export async function setStock(
  productId: string,
  quantity: number,
  reason: string,
  requestId = createIntentId(),
): Promise<Product> {
  requireOnline();
  if (isDummyMode()) return dummySetStock(productId, quantity);
  const { data, error } = await getSupabase().rpc('set_stock', {
    p_product_id: productId,
    p_counted_quantity: quantity,
    p_reason: reason,
    p_request_id: requestId,
  });
  return unwrapRpc<{ product: Product }>(data, error).product;
}

export async function addConsumption(
  tabId: string,
  productId: string,
  quantity: number,
  requestId = createIntentId(),
): Promise<{ tab: Tab; item: TabItem; product: Product; total: number }> {
  requireOnline();
  if (isDummyMode()) return dummyAddConsumption(tabId, productId, quantity, requestId);
  const { data, error } = await getSupabase().rpc('add_consumption', {
    p_tab_id: tabId,
    p_product_id: productId,
    p_quantity: quantity,
    p_request_id: requestId,
  });
  const result = unwrapRpc<{
    tab: Tab;
    item: TabItem;
    product: Product;
    total: number | string;
  }>(data, error);
  return { ...result, total: moneyFromDatabase(result.total) };
}

export async function setTabItemQuantity(
  itemId: string,
  quantity: number,
  requestId = createIntentId(),
): Promise<{ tab: Tab; item: TabItem; product: Product; total: number }> {
  requireOnline();
  if (isDummyMode()) return dummySetItemQuantity(itemId, quantity);
  const { data, error } = await getSupabase().rpc('set_tab_item_quantity', {
    p_item_id: itemId,
    p_new_quantity: quantity,
    p_request_id: requestId,
  });
  const result = unwrapRpc<{
    tab: Tab;
    item: TabItem;
    product: Product;
    total: number | string;
  }>(data, error);
  return { ...result, total: moneyFromDatabase(result.total) };
}

export async function voidTabItem(
  itemId: string,
  requestId = createIntentId(),
): Promise<{ tab: Tab; item: TabItem; product: Product; total: number }> {
  requireOnline();
  if (isDummyMode()) return dummyVoidItem(itemId);
  const { data, error } = await getSupabase().rpc('void_tab_item', {
    p_item_id: itemId,
    p_request_id: requestId,
  });
  const result = unwrapRpc<{
    tab: Tab;
    item: TabItem;
    product: Product;
    total: number | string;
  }>(data, error);
  return { ...result, total: moneyFromDatabase(result.total) };
}

export async function cancelEmptyTab(
  tabId: string,
  requestId = createIntentId(),
): Promise<Tab> {
  requireOnline();
  if (isDummyMode()) return dummyCancelTab(tabId);
  const { data, error } = await getSupabase().rpc('cancel_empty_tab', {
    p_tab_id: tabId,
    p_request_id: requestId,
  });
  return unwrapRpc<{ tab: Tab }>(data, error).tab;
}

export async function closeTab(
  tabId: string,
  requestId = createIntentId(),
): Promise<{ tab: Tab; receipt: Receipt; items: ReceiptItem[] }> {
  requireOnline();
  if (isDummyMode()) return dummyCloseTab(tabId, requestId);
  const { data, error } = await getSupabase().rpc('close_tab', {
    p_tab_id: tabId,
    p_request_id: requestId,
  });
  return unwrapRpc(data, error);
}

export function canManageInventory(role: AppRole): boolean {
  return role === 'admin';
}
