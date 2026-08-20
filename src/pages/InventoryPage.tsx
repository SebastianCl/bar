import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { Modal } from '../components/Modal';
import { PageHeader, Spinner, StatePanel } from '../components/States';
import { useToast } from '../components/toast-context';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useResource } from '../hooks/useResource';
import { createProduct, listProducts, setStock, updateProduct } from '../lib/api';
import type { Product } from '../lib/database.types';
import { normalizeError } from '../lib/errors';
import { formatCurrency } from '../lib/format';
import { createIntentId } from '../lib/intent';
import { productSchema, stockAdjustmentSchema } from '../lib/schemas';

type ProductDraft = {
  name: string;
  sku: string;
  salePrice: string;
  initialStock: string;
  isActive: boolean;
};
const emptyDraft: ProductDraft = {
  name: '',
  sku: '',
  salePrice: '',
  initialStock: '0',
  isActive: true,
};

export function InventoryPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin';
  const { notify } = useToast();
  const isOnline = useOnlineStatus();
  const {
    data: products,
    error,
    isLoading,
    reload,
  } = useResource(() => listProducts());
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [countedStock, setCountedStock] = useState('');
  const [reason, setReason] = useState('Conteo físico');
  const createIntentRef = useRef<string | null>(null);
  const stockIntentRef = useRef<string | null>(null);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CO');
    return (products ?? []).filter(
      (product) =>
        (showInactive || product.is_active) &&
        (!term ||
          product.name.toLocaleLowerCase('es-CO').includes(term) ||
          product.sku?.toLocaleLowerCase('es-CO').includes(term)),
    );
  }, [products, search, showInactive]);

  const openCreate = () => {
    createIntentRef.current = createIntentId();
    setEditing(null);
    setDraft(emptyDraft);
    setFormError('');
    setEditorOpen(true);
  };
  const openEdit = (product: Product) => {
    createIntentRef.current = null;
    setEditing(product);
    setDraft({
      name: product.name,
      sku: product.sku ?? '',
      salePrice: String(product.current_price),
      initialStock: String(product.stock_quantity),
      isActive: product.is_active,
    });
    setFormError('');
    setEditorOpen(true);
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const parsed = productSchema.safeParse({
      name: draft.name,
      sku: draft.sku,
      salePrice: draft.salePrice,
      isActive: draft.isActive,
    });
    const initialStock = Number(draft.initialStock);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }
    if (!editing && (!Number.isInteger(initialStock) || initialStock < 0)) {
      setFormError('La existencia inicial debe ser un entero mayor o igual a cero.');
      return;
    }
    setPending(true);
    try {
      if (editing) await updateProduct(editing.id, parsed.data);
      else {
        const requestId = (createIntentRef.current ??= createIntentId());
        await createProduct({ ...parsed.data, initialStock }, requestId);
        createIntentRef.current = null;
      }
      notify(editing ? 'Producto actualizado.' : 'Producto creado.', 'success');
      setEditorOpen(false);
      reload();
    } catch (caught) {
      setFormError(normalizeError(caught).message);
    } finally {
      setPending(false);
    }
  };

  const saveStock = async (event: FormEvent) => {
    event.preventDefault();
    if (!stockProduct) return;
    setFormError('');
    const quantity = Number(countedStock);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setFormError('La existencia contada debe ser un entero mayor o igual a cero.');
      return;
    }
    if (quantity === stockProduct.stock_quantity) {
      setFormError('La existencia ya coincide con el conteo.');
      return;
    }
    const parsed = stockAdjustmentSchema.safeParse({
      quantityDelta: quantity - stockProduct.stock_quantity,
      reason,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Revisa el ajuste.');
      return;
    }
    setPending(true);
    try {
      const requestId = (stockIntentRef.current ??= createIntentId());
      await setStock(stockProduct.id, quantity, parsed.data.reason, requestId);
      stockIntentRef.current = null;
      notify('Existencia ajustada.', 'success');
      setStockProduct(null);
      reload();
    } catch (caught) {
      setFormError(normalizeError(caught).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Inventario"
        description={
          canEdit
            ? 'Administra precios y existencias sin perder el historial de ventas.'
            : 'Consulta precios y existencias disponibles.'
        }
        actions={
          canEdit ? (
            <button
              className="button button--primary"
              onClick={openCreate}
              disabled={!isOnline}
            >
              + Nuevo producto
            </button>
          ) : undefined
        }
      />
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Buscar producto</span>
          <input
            type="search"
            placeholder="Buscar por nombre o código"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Mostrar inactivos
        </label>
      </div>
      {isLoading ? (
        <StatePanel kind="loading" title="Cargando inventario" />
      ) : error ? (
        <StatePanel
          kind="error"
          title="No pudimos cargar el inventario"
          description={error.message}
          actionLabel="Reintentar"
          onAction={reload}
        />
      ) : visibleProducts.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No hay productos para mostrar"
          description="Crea un producto o cambia los filtros."
        />
      ) : (
        <div className="data-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Existencia</th>
                  <th>Estado</th>
                  {canEdit ? (
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td data-label="Producto">
                      <strong>{product.name}</strong>
                      <small>{product.sku || 'Sin código'}</small>
                    </td>
                    <td data-label="Precio">{formatCurrency(product.current_price)}</td>
                    <td data-label="Existencia">
                      <span
                        className={`stock-badge ${product.stock_quantity <= 3 ? 'stock-badge--low' : ''}`}
                      >
                        {product.stock_quantity} un.
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span
                        className={`status-badge ${product.is_active ? 'status-badge--active' : 'status-badge--inactive'}`}
                      >
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canEdit ? (
                      <td className="row-actions">
                        <button
                          className="text-button"
                          onClick={() => openEdit(product)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            stockIntentRef.current = createIntentId();
                            setStockProduct(product);
                            setCountedStock(String(product.stock_quantity));
                            setReason('Conteo físico');
                            setFormError('');
                          }}
                          disabled={!isOnline}
                        >
                          Ajustar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal
        open={editorOpen}
        onClose={() => {
          if (!pending) {
            createIntentRef.current = null;
            setEditorOpen(false);
          }
        }}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        description={
          editing
            ? 'El nuevo precio no modifica ventas anteriores.'
            : 'Registra el producto y su existencia inicial.'
        }
      >
        <form className="form-grid" onSubmit={saveProduct}>
          <label className="field field--wide">
            <span>Nombre</span>
            <input
              value={draft.name}
              onChange={(event) => {
                if (!editing) createIntentRef.current = createIntentId();
                setDraft({ ...draft, name: event.target.value });
              }}
              autoFocus
            />
          </label>
          <label className="field">
            <span>
              Código / SKU <small>Opcional</small>
            </span>
            <input
              value={draft.sku}
              onChange={(event) => {
                if (!editing) createIntentRef.current = createIntentId();
                setDraft({ ...draft, sku: event.target.value });
              }}
            />
          </label>
          <label className="field">
            <span>Precio de venta</span>
            <div className="input-prefix">
              <span>$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.salePrice}
                onChange={(event) => {
                  if (!editing) createIntentRef.current = createIntentId();
                  setDraft({ ...draft, salePrice: event.target.value });
                }}
              />
            </div>
          </label>
          {!editing ? (
            <label className="field">
              <span>Existencia inicial</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={draft.initialStock}
                onChange={(event) => {
                  createIntentRef.current = createIntentId();
                  setDraft({ ...draft, initialStock: event.target.value });
                }}
              />
            </label>
          ) : (
            <label className="switch-control">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft({ ...draft, isActive: event.target.checked })
                }
              />
              <span />
              Producto activo
            </label>
          )}
          {formError ? (
            <div className="alert alert--error field--wide" role="alert">
              {formError}
            </div>
          ) : null}
          <div className="modal-actions field--wide">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                createIntentRef.current = null;
                setEditorOpen(false);
              }}
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={pending || !isOnline}>
              {pending ? (
                <>
                  <Spinner />
                  Guardando…
                </>
              ) : (
                'Guardar producto'
              )}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(stockProduct)}
        onClose={() => {
          if (!pending) {
            stockIntentRef.current = null;
            setStockProduct(null);
          }
        }}
        title="Ajustar existencia"
        description={
          stockProduct
            ? `${stockProduct.name} · actual: ${stockProduct.stock_quantity} unidades`
            : undefined
        }
        size="small"
      >
        <form className="form-stack" onSubmit={saveStock}>
          <label className="field">
            <span>Existencia contada</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={countedStock}
              onChange={(event) => {
                stockIntentRef.current = createIntentId();
                setCountedStock(event.target.value);
              }}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Motivo</span>
            <input
              value={reason}
              onChange={(event) => {
                stockIntentRef.current = createIntentId();
                setReason(event.target.value);
              }}
              maxLength={180}
            />
          </label>
          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}
          <div className="modal-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                stockIntentRef.current = null;
                setStockProduct(null);
              }}
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={pending || !isOnline}>
              {pending ? (
                <>
                  <Spinner />
                  Ajustando…
                </>
              ) : (
                'Confirmar ajuste'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
