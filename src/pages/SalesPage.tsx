import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Spinner, StatePanel } from '../components/States';
import { useResource } from '../hooks/useResource';
import { listReceipts } from '../lib/api';
import { normalizeError } from '../lib/errors';
import { formatCurrency, formatDateTime, toBogotaDateKey } from '../lib/format';

const PAGE_SIZE = 50;

export function SalesPage() {
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [filters, setFilters] = useState({ search: '', date: '' });
  const {
    data: receiptPage,
    error,
    isLoading,
    reload,
    setData,
  } = useResource(
    () => listReceipts({ pageSize: PAGE_SIZE, ...filters }),
    `${filters.search}|${filters.date}`,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');

  const visible = useMemo(() => {
    const term = filters.search.trim().toLocaleLowerCase('es-CO');
    return (receiptPage?.items ?? []).filter((receipt) => {
      const matchesReference =
        !term ||
        receipt.receipt_code.toLocaleLowerCase('es-CO').includes(term) ||
        receipt.reference_label_snapshot.toLocaleLowerCase('es-CO').includes(term);
      return (
        matchesReference &&
        (!filters.date || toBogotaDateKey(receipt.issued_at) === filters.date)
      );
    });
  }, [filters, receiptPage?.items]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setLoadMoreError('');
    setFilters({ search: search.trim(), date });
  };

  const clearFilters = () => {
    setSearch('');
    setDate('');
    setLoadMoreError('');
    setFilters({ search: '', date: '' });
  };

  const loadMore = async () => {
    if (!receiptPage || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreError('');
    try {
      const nextPage = await listReceipts({
        pageSize: PAGE_SIZE,
        offset: receiptPage.items.length,
        ...filters,
      });
      setData((current) => {
        if (!current) return nextPage;
        const knownIds = new Set(current.items.map((receipt) => receipt.id));
        return {
          items: [
            ...current.items,
            ...nextPage.items.filter((receipt) => !knownIds.has(receipt.id)),
          ],
          hasMore: nextPage.hasMore,
        };
      });
    } catch (caught) {
      setLoadMoreError(
        normalizeError(caught, 'No fue posible cargar más ventas.').message,
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Historial"
        title="Ventas"
        description="Consulta cuentas cerradas y vuelve a imprimir sus comprobantes."
      />
      <form className="toolbar" onSubmit={applyFilters}>
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Buscar venta</span>
          <input
            type="search"
            placeholder="Buscar comprobante, mesa o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="date-filter">
          <span>Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button className="button button--secondary" type="submit">
          Buscar
        </button>
        {filters.search || filters.date ? (
          <button className="button button--ghost" type="button" onClick={clearFilters}>
            Limpiar
          </button>
        ) : null}
        <button className="button button--ghost" type="button" onClick={reload}>
          Actualizar
        </button>
      </form>
      {isLoading ? (
        <StatePanel kind="loading" title="Cargando ventas" />
      ) : error ? (
        <StatePanel
          kind="error"
          title="No pudimos cargar las ventas"
          description={error.message}
          actionLabel="Reintentar"
          onAction={reload}
        />
      ) : visible.length === 0 ? (
        <StatePanel
          kind="empty"
          title={
            filters.search || filters.date
              ? 'No hay coincidencias'
              : 'Todavía no hay ventas'
          }
          description={
            filters.search || filters.date
              ? 'Prueba con otra referencia o fecha.'
              : 'Las cuentas cerradas aparecerán aquí.'
          }
        />
      ) : (
        <div className="data-card">
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Mesa / cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((receipt) => (
                  <tr key={receipt.id}>
                    <td data-label="Comprobante">
                      <strong>{receipt.receipt_code}</strong>
                    </td>
                    <td data-label="Mesa / cliente">
                      {receipt.reference_label_snapshot}
                    </td>
                    <td data-label="Fecha">{formatDateTime(receipt.issued_at)}</td>
                    <td data-label="Total">
                      <strong>{formatCurrency(receipt.total)}</strong>
                    </td>
                    <td className="row-actions">
                      <Link className="text-button" to={`/comprobantes/${receipt.id}`}>
                        Ver comprobante →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!isLoading && !error && receiptPage?.hasMore ? (
        <div className="pagination-bar">
          <span>Mostrando {receiptPage.items.length} ventas</span>
          <button
            className="button button--secondary"
            type="button"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? (
              <>
                <Spinner />
                Cargando…
              </>
            ) : (
              'Cargar más'
            )}
          </button>
        </div>
      ) : null}
      {loadMoreError ? (
        <div className="alert alert--error" role="alert">
          {loadMoreError}
        </div>
      ) : null}
    </>
  );
}
