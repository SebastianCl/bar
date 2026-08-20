import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { Spinner, StatePanel } from '../components/States';
import { useToast } from '../components/toast-context';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useResource } from '../hooks/useResource';
import {
  addConsumption,
  cancelEmptyTab,
  closeTab,
  getTabDetail,
  listProducts,
  setTabItemQuantity,
  voidTabItem,
} from '../lib/api';
import type { Product, TabItem } from '../lib/database.types';
import { normalizeError } from '../lib/errors';
import { formatCurrency, formatDateTime } from '../lib/format';
import { createIntentId } from '../lib/intent';
import { consumptionSchema } from '../lib/schemas';

export function AccountDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const isOnline = useOnlineStatus();
  const { data, error, isLoading, reload, setData } = useResource(async () => {
    const [detail, products] = await Promise.all([
      getTabDetail(id),
      listProducts({ activeOnly: true }),
    ]);
    return { ...detail, products };
  }, id);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [pendingAction, setPendingAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [voidingItem, setVoidingItem] = useState<TabItem | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const addIntentRef = useRef<string | null>(null);
  const quantityIntentsRef = useRef(new Map<string, string>());
  const voidIntentRef = useRef<string | null>(null);
  const closeIntentRef = useRef<string | null>(null);
  const cancelIntentRef = useRef<string | null>(null);

  const activeItems = data?.items.filter((item) => item.voided_at === null) ?? [];
  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase('es-CO');
    return (data?.products ?? []).filter(
      (product) =>
        !term ||
        product.name.toLocaleLowerCase('es-CO').includes(term) ||
        product.sku?.toLocaleLowerCase('es-CO').includes(term),
    );
  }, [data?.products, productSearch]);
  const tabOpen = data?.tab.status === 'open';

  const addProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;
    setActionError('');
    const parsed = consumptionSchema.safeParse({
      productId: selectedProduct.id,
      quantity,
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? 'Revisa la cantidad.');
      return;
    }
    setPendingAction('add');
    try {
      const requestId = (addIntentRef.current ??= createIntentId());
      const result = await addConsumption(
        id,
        parsed.data.productId,
        parsed.data.quantity,
        requestId,
      );
      setData((current) => {
        if (!current) return current;
        const hasItem = current.items.some((item) => item.id === result.item.id);
        const items = hasItem
          ? current.items.map((item) =>
              item.id === result.item.id ? result.item : item,
            )
          : [...current.items, result.item];
        return {
          ...current,
          tab: result.tab,
          items,
          products: current.products.map((product) =>
            product.id === result.product.id ? result.product : product,
          ),
          total: result.total,
        };
      });
      addIntentRef.current = null;
      notify(`${selectedProduct.name} agregado.`, 'success');
      setSelectedProduct(null);
      setQuantity('1');
      reload();
    } catch (caught) {
      setActionError(normalizeError(caught).message);
    } finally {
      setPendingAction('');
    }
  };

  const changeQuantity = async (item: TabItem, nextQuantity: number) => {
    if (nextQuantity < 1) return;
    setActionError('');
    setPendingAction(item.id);
    const intentKey = `${item.id}:${item.quantity}:${nextQuantity}`;
    const requestId = quantityIntentsRef.current.get(intentKey) ?? createIntentId();
    quantityIntentsRef.current.set(intentKey, requestId);
    try {
      const result = await setTabItemQuantity(item.id, nextQuantity, requestId);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((currentItem) =>
          currentItem.id === result.item.id ? result.item : currentItem,
        );
        return {
          ...current,
          tab: result.tab,
          items,
          products: current.products.map((product) =>
            product.id === result.product.id ? result.product : product,
          ),
          total: result.total,
        };
      });
      quantityIntentsRef.current.delete(intentKey);
      reload();
    } catch (caught) {
      notify(normalizeError(caught).message, 'error');
    } finally {
      setPendingAction('');
    }
  };

  const confirmVoid = async () => {
    if (!voidingItem) return;
    setPendingAction('void');
    try {
      const requestId = (voidIntentRef.current ??= createIntentId());
      const result = await voidTabItem(voidingItem.id, requestId);
      setData((current) => {
        if (!current) return current;
        const items = current.items.map((item) =>
          item.id === result.item.id ? result.item : item,
        );
        return {
          ...current,
          tab: result.tab,
          items,
          products: current.products.map((product) =>
            product.id === result.product.id ? result.product : product,
          ),
          total: result.total,
        };
      });
      voidIntentRef.current = null;
      notify('Consumo anulado y existencia restituida.', 'success');
      setVoidingItem(null);
      reload();
    } catch (caught) {
      setActionError(normalizeError(caught).message);
    } finally {
      setPendingAction('');
    }
  };

  const finishTab = async () => {
    setPendingAction('close');
    setActionError('');
    try {
      const requestId = (closeIntentRef.current ??= createIntentId());
      const result = await closeTab(id, requestId);
      closeIntentRef.current = null;
      notify('Cuenta cerrada correctamente.', 'success');
      navigate(`/comprobantes/${result.receipt.id}`, { replace: true });
    } catch (caught) {
      setActionError(normalizeError(caught).message);
    } finally {
      setPendingAction('');
    }
  };

  const cancelTab = async () => {
    setPendingAction('cancel');
    try {
      const requestId = (cancelIntentRef.current ??= createIntentId());
      await cancelEmptyTab(id, requestId);
      cancelIntentRef.current = null;
      notify('Cuenta vacía cancelada.', 'success');
      navigate('/cuentas', { replace: true });
    } catch (caught) {
      notify(normalizeError(caught).message, 'error');
    } finally {
      setPendingAction('');
    }
  };

  if (isLoading) return <StatePanel kind="loading" title="Cargando cuenta" />;
  if (error || !data)
    return (
      <StatePanel
        kind="error"
        title="No pudimos cargar la cuenta"
        description={error?.message}
        actionLabel="Volver a cuentas"
        actionHref="/cuentas"
      />
    );

  return (
    <div className="account-detail">
      <header className="detail-header">
        <div>
          <Link className="back-link" to="/cuentas">
            ← Cuentas abiertas
          </Link>
          <p className="eyebrow">
            {data.tab.reference_type === 'table' ? 'Mesa' : 'Cliente'}
          </p>
          <h1>{data.tab.reference_label}</h1>
          <p className="muted">Abierta {formatDateTime(data.tab.opened_at)}</p>
        </div>
        <div className="detail-header__total">
          <span>Total acumulado</span>
          <strong>{formatCurrency(data.total)}</strong>
          <span className={`status-badge status-badge--${data.tab.status}`}>
            {data.tab.status === 'open'
              ? 'Abierta'
              : data.tab.status === 'closed'
                ? 'Cerrada'
                : 'Cancelada'}
          </span>
        </div>
      </header>
      {actionError ? (
        <div className="alert alert--error" role="alert">
          {actionError}
        </div>
      ) : null}
      <div className="account-workspace">
        <section className="bill-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Consumos</p>
              <h2>Detalle de la cuenta</h2>
            </div>
            <span>{activeItems.length} líneas</span>
          </div>
          {activeItems.length === 0 ? (
            <StatePanel
              compact
              kind="empty"
              title="Todavía no hay consumos"
              description="Selecciona un producto para agregarlo."
            />
          ) : (
            <div className="bill-list">
              {activeItems.map((item) => (
                <article className="bill-line" key={item.id}>
                  <div className="bill-line__main">
                    <strong>{item.product_name_snapshot}</strong>
                    <small>
                      {formatCurrency(item.unit_price_snapshot)} c/u
                      {item.sku_snapshot ? ` · ${item.sku_snapshot}` : ''}
                    </small>
                  </div>
                  <div
                    className="quantity-control"
                    aria-label={`Cantidad de ${item.product_name_snapshot}`}
                  >
                    <button
                      type="button"
                      aria-label="Restar uno"
                      disabled={
                        !tabOpen ||
                        !isOnline ||
                        pendingAction === item.id ||
                        item.quantity <= 1
                      }
                      onClick={() => void changeQuantity(item, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>
                      {pendingAction === item.id ? <Spinner /> : item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Sumar uno"
                      disabled={!tabOpen || !isOnline || pendingAction === item.id}
                      onClick={() => void changeQuantity(item, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong className="bill-line__total">
                    {formatCurrency(item.line_total)}
                  </strong>
                  <button
                    className="icon-button icon-button--danger"
                    type="button"
                    aria-label={`Anular ${item.product_name_snapshot}`}
                    disabled={!tabOpen || !isOnline}
                    onClick={() => {
                      voidIntentRef.current = createIntentId();
                      setVoidingItem(item);
                      setActionError('');
                    }}
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="bill-summary">
            <span>Total</span>
            <strong>{formatCurrency(data.total)}</strong>
          </div>
          {tabOpen ? (
            <div className="bill-actions">
              {activeItems.length === 0 ? (
                <button
                  className="button button--danger-ghost"
                  disabled={!isOnline || pendingAction === 'cancel'}
                  onClick={() => void cancelTab()}
                >
                  {pendingAction === 'cancel' ? 'Cancelando…' : 'Cancelar cuenta vacía'}
                </button>
              ) : null}
              <button
                className="button button--primary button--large"
                disabled={!isOnline || activeItems.length === 0}
                onClick={() => {
                  closeIntentRef.current = createIntentId();
                  setCloseOpen(true);
                  setActionError('');
                }}
              >
                Cerrar cuenta
              </button>
            </div>
          ) : null}
        </section>
        <section className="product-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Inventario</p>
              <h2>Agregar producto</h2>
            </div>
          </div>
          <label className="search-field search-field--full">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar producto</span>
            <input
              type="search"
              placeholder="Buscar producto o código"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
          </label>
          <div className="product-picker">
            {visibleProducts.length === 0 ? (
              <p className="muted product-picker__empty">
                No hay productos disponibles.
              </p>
            ) : (
              visibleProducts.map((product) => (
                <button
                  className="product-option"
                  type="button"
                  key={product.id}
                  disabled={!tabOpen || !isOnline || product.stock_quantity < 1}
                  onClick={() => {
                    addIntentRef.current = createIntentId();
                    setSelectedProduct(product);
                    setQuantity('1');
                    setActionError('');
                  }}
                >
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.stock_quantity > 0
                        ? `${product.stock_quantity} disponibles`
                        : 'Agotado'}
                    </small>
                  </span>
                  <strong>{formatCurrency(product.current_price)}</strong>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <Modal
        open={Boolean(selectedProduct)}
        onClose={() => {
          if (!pendingAction) {
            addIntentRef.current = null;
            setSelectedProduct(null);
          }
        }}
        title={`Agregar ${selectedProduct?.name ?? ''}`}
        description={
          selectedProduct
            ? `${selectedProduct.stock_quantity} unidades disponibles · ${formatCurrency(selectedProduct.current_price)} cada una`
            : undefined
        }
        size="small"
      >
        <form className="form-stack" onSubmit={addProduct}>
          <label className="field">
            <span>Cantidad</span>
            <input
              type="number"
              min="1"
              max={selectedProduct?.stock_quantity}
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                addIntentRef.current = createIntentId();
                setQuantity(event.target.value);
              }}
              autoFocus
            />
          </label>
          {actionError ? (
            <div className="alert alert--error" role="alert">
              {actionError}
            </div>
          ) : null}
          <div className="calculated-total">
            <span>Subtotal</span>
            <strong>
              {formatCurrency(
                (selectedProduct?.current_price ?? 0) * (Number(quantity) || 0),
              )}
            </strong>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                addIntentRef.current = null;
                setSelectedProduct(null);
              }}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              disabled={!isOnline || pendingAction === 'add'}
            >
              {pendingAction === 'add' ? (
                <>
                  <Spinner />
                  Agregando…
                </>
              ) : (
                'Agregar a la cuenta'
              )}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(voidingItem)}
        onClose={() => {
          if (!pendingAction) {
            voidIntentRef.current = null;
            setVoidingItem(null);
          }
        }}
        title="Anular consumo"
        description="La cantidad se devolverá al inventario."
        size="small"
      >
        <p>
          ¿Deseas anular{' '}
          <strong>
            {voidingItem?.quantity} × {voidingItem?.product_name_snapshot}
          </strong>
          ?
        </p>
        {actionError ? (
          <div className="alert alert--error" role="alert">
            {actionError}
          </div>
        ) : null}
        <div className="modal-actions">
          <button
            className="button button--ghost"
            onClick={() => {
              voidIntentRef.current = null;
              setVoidingItem(null);
            }}
          >
            Conservar
          </button>
          <button
            className="button button--danger"
            disabled={!isOnline || pendingAction === 'void'}
            onClick={() => void confirmVoid()}
          >
            {pendingAction === 'void' ? (
              <>
                <Spinner />
                Anulando…
              </>
            ) : (
              'Sí, anular'
            )}
          </button>
        </div>
      </Modal>
      <Modal
        open={closeOpen}
        onClose={() => {
          if (!pendingAction) {
            closeIntentRef.current = null;
            setCloseOpen(false);
          }
        }}
        title="Cerrar cuenta"
        description="Esta acción genera el comprobante y bloquea nuevos consumos."
        size="small"
      >
        <div className="close-summary">
          <span>{data.tab.reference_label}</span>
          <strong>{formatCurrency(data.total)}</strong>
          <small>
            {activeItems.reduce((sum, item) => sum + item.quantity, 0)} unidades
          </small>
        </div>
        {actionError ? (
          <div className="alert alert--error" role="alert">
            {actionError}
          </div>
        ) : null}
        <div className="modal-actions">
          <button
            className="button button--ghost"
            onClick={() => {
              closeIntentRef.current = null;
              setCloseOpen(false);
            }}
          >
            Volver
          </button>
          <button
            className="button button--primary"
            disabled={!isOnline || pendingAction === 'close'}
            onClick={() => void finishTab()}
          >
            {pendingAction === 'close' ? (
              <>
                <Spinner />
                Cerrando…
              </>
            ) : (
              'Confirmar y cerrar'
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
