import type {
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
import { AppError } from './errors';

const STORAGE_KEY = 'bar:dummy-state:v1';
export const DUMMY_USER_ID = '00000000-0000-4000-8000-000000000001';

interface DummyState {
  products: Product[];
  tabs: Tab[];
  tabItems: TabItem[];
  receipts: Receipt[];
  receiptItems: ReceiptItem[];
  nextReceiptNumber: number;
  nextReceiptItemId: number;
}

const isoMinutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();
const id = () => crypto.randomUUID();

export const dummyProfile: Profile = {
  id: DUMMY_USER_ID,
  display_name: 'Administrador Demo',
  role: 'admin',
  is_active: true,
  created_at: isoMinutesAgo(10_000),
  updated_at: isoMinutesAgo(10_000),
};

export const dummyBarSettings: BarSettings = {
  id: 1,
  bar_name: 'Bar La Esquina · Demo',
  identification: 'Datos de demostración',
  address: 'Calle 10 # 20-30, Bogotá',
  phone: '300 555 0101',
  currency: 'COP',
  locale: 'es-CO',
  timezone: 'America/Bogota',
  receipt_prefix: 'REC',
  updated_at: isoMinutesAgo(10_000),
  updated_by: DUMMY_USER_ID,
};

function initialState(): DummyState {
  const products: Product[] = [
    [
      '10000000-0000-4000-8000-000000000001',
      'Cerveza Club Colombia',
      'CER-001',
      6500,
      28,
      true,
    ],
    [
      '10000000-0000-4000-8000-000000000002',
      'Cerveza Poker',
      'CER-002',
      5000,
      42,
      true,
    ],
    [
      '10000000-0000-4000-8000-000000000003',
      'Aguardiente Antioqueño',
      'LIC-001',
      85000,
      7,
      true,
    ],
    ['10000000-0000-4000-8000-000000000004', 'Coca-Cola', 'GAS-001', 4500, 19, true],
    ['10000000-0000-4000-8000-000000000005', 'Agua con gas', 'AGU-001', 4000, 0, true],
    [
      '10000000-0000-4000-8000-000000000006',
      'Producto descontinuado',
      'OLD-001',
      3500,
      3,
      false,
    ],
  ].map(([productId, name, sku, price, stock, active]) => ({
    id: productId as string,
    name: name as string,
    sku: sku as string,
    current_price: price as number,
    stock_quantity: stock as number,
    is_active: active as boolean,
    created_by: DUMMY_USER_ID,
    updated_by: DUMMY_USER_ID,
    created_at: isoMinutesAgo(20_000),
    updated_at: isoMinutesAgo(60),
  }));

  const openTabId = '20000000-0000-4000-8000-000000000001';
  const emptyTabId = '20000000-0000-4000-8000-000000000002';
  const closedTabId = '20000000-0000-4000-8000-000000000003';
  const tabs: Tab[] = [
    makeTab(openTabId, 'table', 'Mesa 4', 'open', 95),
    makeTab(emptyTabId, 'customer', 'Laura (cuenta vacía)', 'open', 25),
    makeTab(closedTabId, 'customer', 'Carlos Pérez', 'closed', 1440, 1380),
  ];
  const tabItems: TabItem[] = [
    makeItem('30000000-0000-4000-8000-000000000001', openTabId, products[0]!, 3, 88),
    makeItem('30000000-0000-4000-8000-000000000002', openTabId, products[3]!, 2, 72),
    makeItem(
      '30000000-0000-4000-8000-000000000003',
      closedTabId,
      products[1]!,
      4,
      1420,
    ),
    makeItem(
      '30000000-0000-4000-8000-000000000004',
      closedTabId,
      products[3]!,
      2,
      1410,
    ),
  ];
  const receipt: Receipt = {
    id: '40000000-0000-4000-8000-000000000001',
    receipt_number: 1,
    receipt_code: 'REC-000001',
    tab_id: closedTabId,
    reference_type_snapshot: 'customer',
    reference_label_snapshot: 'Carlos Pérez',
    bar_name_snapshot: dummyBarSettings.bar_name,
    bar_identification_snapshot: dummyBarSettings.identification,
    bar_address_snapshot: dummyBarSettings.address,
    bar_phone_snapshot: dummyBarSettings.phone,
    issued_at: isoMinutesAgo(1380),
    issued_by: DUMMY_USER_ID,
    total: 29000,
    currency: 'COP',
    close_request_id: '50000000-0000-4000-8000-000000000001',
  };
  const receiptItems = tabItems
    .filter((item) => item.tab_id === closedTabId)
    .map((item, index) => ({
      id: index + 1,
      receipt_id: receipt.id,
      source_tab_item_id: item.id,
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      sku_snapshot: item.sku_snapshot,
      unit_price_snapshot: item.unit_price_snapshot,
      quantity: item.quantity,
      line_total: item.line_total,
    }));
  return {
    products,
    tabs,
    tabItems,
    receipts: [receipt],
    receiptItems,
    nextReceiptNumber: 2,
    nextReceiptItemId: 3,
  };
}

function makeTab(
  tabId: string,
  type: ReferenceType,
  label: string,
  status: Tab['status'],
  openedMinutes: number,
  closedMinutes?: number,
): Tab {
  const closed = status === 'closed';
  return {
    id: tabId,
    reference_type: type,
    reference_label: label,
    status,
    opened_at: isoMinutesAgo(openedMinutes),
    opened_by: DUMMY_USER_ID,
    closed_at: closed ? isoMinutesAgo(closedMinutes ?? 0) : null,
    closed_by: closed ? DUMMY_USER_ID : null,
    cancelled_at: null,
    cancelled_by: null,
    open_request_id: id(),
    created_at: isoMinutesAgo(openedMinutes),
    updated_at: isoMinutesAgo(closedMinutes ?? openedMinutes),
  };
}

function makeItem(
  itemId: string,
  tabId: string,
  product: Product,
  quantity: number,
  minutes: number,
): TabItem {
  return {
    id: itemId,
    tab_id: tabId,
    product_id: product.id,
    quantity,
    product_name_snapshot: product.name,
    sku_snapshot: product.sku,
    unit_price_snapshot: product.current_price,
    line_total: product.current_price * quantity,
    created_by: DUMMY_USER_ID,
    created_at: isoMinutesAgo(minutes),
    updated_by: DUMMY_USER_ID,
    updated_at: isoMinutesAgo(minutes),
    voided_at: null,
    voided_by: null,
    void_reason: null,
    add_request_id: id(),
  };
}

function read(): DummyState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw)
    try {
      return JSON.parse(raw) as DummyState;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  const state = initialState();
  write(state);
  return state;
}
function write(state: DummyState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function totalFor(state: DummyState, tabId: string) {
  return state.tabItems
    .filter((item) => item.tab_id === tabId && !item.voided_at)
    .reduce((sum, item) => sum + item.line_total, 0);
}
function requireTab(state: DummyState, tabId: string) {
  const tab = state.tabs.find((row) => row.id === tabId);
  if (!tab) throw new AppError('NOT_FOUND', 'La cuenta no existe.');
  return tab;
}
function requireOpenTab(state: DummyState, tabId: string) {
  const tab = requireTab(state, tabId);
  if (tab.status !== 'open')
    throw new AppError('ACCOUNT_CLOSED', 'La cuenta ya está cerrada.');
  return tab;
}
function requireProduct(state: DummyState, productId: string) {
  const product = state.products.find((row) => row.id === productId);
  if (!product) throw new AppError('NOT_FOUND', 'El producto no existe.');
  return product;
}

export function resetDummyData() {
  localStorage.removeItem(STORAGE_KEY);
  return read();
}
export function dummyListProducts(activeOnly = false) {
  return read()
    .products.filter((p) => !activeOnly || p.is_active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export function dummyListOpenTabs(): OpenTabSummary[] {
  const state = read();
  return state.tabs
    .filter((t) => t.status === 'open')
    .map((t) => ({
      id: t.id,
      reference_type: t.reference_type,
      reference_label: t.reference_label,
      status: t.status,
      opened_at: t.opened_at,
      opened_by: t.opened_by,
      total: totalFor(state, t.id),
      item_count: state.tabItems.filter((i) => i.tab_id === t.id && !i.voided_at)
        .length,
    }));
}
export function dummyGetTabDetail(tabId: string) {
  const state = read();
  const tab = requireTab(state, tabId);
  return {
    tab,
    items: state.tabItems.filter((i) => i.tab_id === tabId),
    total:
      tab.status === 'closed'
        ? (state.receipts.find((r) => r.tab_id === tabId)?.total ?? 0)
        : totalFor(state, tabId),
  };
}
export function dummyListReceipts() {
  return [...read().receipts].sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}
export function dummyGetReceipt(receiptId: string) {
  const state = read();
  const receipt = state.receipts.find((r) => r.id === receiptId);
  if (!receipt) throw new AppError('NOT_FOUND', 'El comprobante no existe.');
  return {
    receipt,
    items: state.receiptItems.filter((i) => i.receipt_id === receiptId),
  };
}
export function dummyOpenTab(input: OpenTabInput, requestId: string) {
  const state = read();
  const type: ReferenceType = input.tableLabel ? 'table' : 'customer';
  const label = input.tableLabel || input.customerName;
  if (
    type === 'table' &&
    state.tabs.some(
      (t) =>
        t.status === 'open' &&
        t.reference_type === 'table' &&
        t.reference_label.toLocaleLowerCase('es') === label.toLocaleLowerCase('es'),
    )
  )
    throw new AppError('CONFLICT', 'Ya existe una cuenta abierta para esta mesa.');
  const tab = makeTab(id(), type, label, 'open', 0);
  tab.open_request_id = requestId;
  state.tabs.push(tab);
  write(state);
  return tab;
}
export function dummyCreateProduct(input: ProductInput & { initialStock: number }) {
  const state = read();
  const now = new Date().toISOString();
  const product: Product = {
    id: id(),
    name: input.name,
    sku: input.sku || null,
    current_price: input.salePrice,
    stock_quantity: input.initialStock,
    is_active: input.isActive,
    created_by: DUMMY_USER_ID,
    updated_by: DUMMY_USER_ID,
    created_at: now,
    updated_at: now,
  };
  state.products.push(product);
  write(state);
  return product;
}
export function dummyUpdateProduct(productId: string, input: ProductInput) {
  const state = read();
  const product = requireProduct(state, productId);
  Object.assign(product, {
    name: input.name,
    sku: input.sku || null,
    current_price: input.salePrice,
    is_active: input.isActive,
    updated_by: DUMMY_USER_ID,
    updated_at: new Date().toISOString(),
  });
  write(state);
  return product;
}
export function dummySetStock(productId: string, quantity: number) {
  const state = read();
  const product = requireProduct(state, productId);
  product.stock_quantity = quantity;
  product.updated_at = new Date().toISOString();
  write(state);
  return product;
}
export function dummyAddConsumption(
  tabId: string,
  productId: string,
  quantity: number,
  requestId: string,
) {
  const state = read();
  const tab = requireOpenTab(state, tabId);
  const product = requireProduct(state, productId);
  if (product.stock_quantity < quantity)
    throw new AppError(
      'OUT_OF_STOCK',
      `Solo quedan ${product.stock_quantity} unidades.`,
    );
  const item = makeItem(id(), tabId, product, quantity, 0);
  item.add_request_id = requestId;
  product.stock_quantity -= quantity;
  state.tabItems.push(item);
  write(state);
  return { tab, item, product, total: totalFor(state, tabId) };
}
export function dummySetItemQuantity(itemId: string, quantity: number) {
  const state = read();
  const item = state.tabItems.find((row) => row.id === itemId);
  if (!item) throw new AppError('NOT_FOUND', 'El consumo no existe.');
  const tab = requireOpenTab(state, item.tab_id);
  const product = requireProduct(state, item.product_id);
  const difference = quantity - item.quantity;
  if (difference > product.stock_quantity)
    throw new AppError(
      'OUT_OF_STOCK',
      `Solo quedan ${product.stock_quantity} unidades.`,
    );
  product.stock_quantity -= difference;
  item.quantity = quantity;
  item.line_total = quantity * item.unit_price_snapshot;
  item.updated_at = new Date().toISOString();
  write(state);
  return { tab, item, product, total: totalFor(state, tab.id) };
}
export function dummyVoidItem(itemId: string) {
  const state = read();
  const item = state.tabItems.find((row) => row.id === itemId);
  if (!item) throw new AppError('NOT_FOUND', 'El consumo no existe.');
  const tab = requireOpenTab(state, item.tab_id);
  const product = requireProduct(state, item.product_id);
  if (!item.voided_at) {
    product.stock_quantity += item.quantity;
    item.voided_at = new Date().toISOString();
    item.voided_by = DUMMY_USER_ID;
    item.void_reason = 'Anulado en modo demo';
  }
  write(state);
  return { tab, item, product, total: totalFor(state, tab.id) };
}
export function dummyCancelTab(tabId: string) {
  const state = read();
  const tab = requireOpenTab(state, tabId);
  if (state.tabItems.some((i) => i.tab_id === tabId && !i.voided_at))
    throw new AppError('VALIDATION', 'Solo puedes cancelar una cuenta vacía.');
  tab.status = 'cancelled';
  tab.cancelled_at = new Date().toISOString();
  tab.cancelled_by = DUMMY_USER_ID;
  write(state);
  return tab;
}
export function dummyCloseTab(tabId: string, requestId: string) {
  const state = read();
  const existing = state.receipts.find((r) => r.tab_id === tabId);
  if (existing)
    return {
      tab: requireTab(state, tabId),
      receipt: existing,
      items: state.receiptItems.filter((i) => i.receipt_id === existing.id),
    };
  const tab = requireOpenTab(state, tabId);
  const active = state.tabItems.filter((i) => i.tab_id === tabId && !i.voided_at);
  if (!active.length)
    throw new AppError(
      'VALIDATION',
      'La cuenta está vacía; cancélala en lugar de cerrarla.',
    );
  const now = new Date().toISOString();
  const number = state.nextReceiptNumber++;
  const receipt: Receipt = {
    id: id(),
    receipt_number: number,
    receipt_code: `REC-${String(number).padStart(6, '0')}`,
    tab_id: tab.id,
    reference_type_snapshot: tab.reference_type,
    reference_label_snapshot: tab.reference_label,
    bar_name_snapshot: dummyBarSettings.bar_name,
    bar_identification_snapshot: dummyBarSettings.identification,
    bar_address_snapshot: dummyBarSettings.address,
    bar_phone_snapshot: dummyBarSettings.phone,
    issued_at: now,
    issued_by: DUMMY_USER_ID,
    total: totalFor(state, tabId),
    currency: 'COP',
    close_request_id: requestId,
  };
  const items = active.map((item) => ({
    id: state.nextReceiptItemId++,
    receipt_id: receipt.id,
    source_tab_item_id: item.id,
    product_id: item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    sku_snapshot: item.sku_snapshot,
    unit_price_snapshot: item.unit_price_snapshot,
    quantity: item.quantity,
    line_total: item.line_total,
  }));
  tab.status = 'closed';
  tab.closed_at = now;
  tab.closed_by = DUMMY_USER_ID;
  state.receipts.push(receipt);
  state.receiptItems.push(...items);
  write(state);
  return { tab, receipt, items };
}
