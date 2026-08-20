import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { PageHeader, Spinner, StatePanel } from '../components/States';
import { useToast } from '../components/toast-context';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useResource } from '../hooks/useResource';
import { listOpenTabs, openTab } from '../lib/api';
import { normalizeError } from '../lib/errors';
import { formatCurrency, formatRelativeTime } from '../lib/format';
import { createIntentId } from '../lib/intent';
import { openTabSchema } from '../lib/schemas';

export function AccountsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const isOnline = useOnlineStatus();
  const { data: tabs, error, isLoading, reload } = useResource(listOpenTabs);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [referenceType, setReferenceType] = useState<'table' | 'customer'>('table');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const openIntentRef = useRef<string | null>(null);

  const startOpenIntent = () => {
    openIntentRef.current = createIntentId();
    setFormError('');
    setModalOpen(true);
  };

  const cancelOpenIntent = () => {
    openIntentRef.current = null;
    setFormError('');
    setModalOpen(false);
  };

  const visibleTabs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-CO');
    return (tabs ?? []).filter(
      (tab) => !term || tab.reference_label?.toLocaleLowerCase('es-CO').includes(term),
    );
  }, [search, tabs]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const input = {
      tableLabel: referenceType === 'table' ? label : '',
      customerName: referenceType === 'customer' ? label : '',
    };
    const parsed = openTabSchema.safeParse(input);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Revisa la referencia.');
      return;
    }
    setPending(true);
    const requestId = (openIntentRef.current ??= createIntentId());
    try {
      const tab = await openTab(parsed.data, requestId);
      notify('Cuenta abierta correctamente.', 'success');
      openIntentRef.current = null;
      setModalOpen(false);
      setLabel('');
      reload();
      navigate(`/cuentas/${tab.id}`);
    } catch (caught) {
      setFormError(normalizeError(caught, 'No fue posible abrir la cuenta.').message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Cuentas abiertas"
        description="Registra consumos y consulta el total de cada mesa o cliente."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={startOpenIntent}
            disabled={!isOnline}
          >
            + Nueva cuenta
          </button>
        }
      />
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Buscar cuenta</span>
          <input
            type="search"
            placeholder="Buscar mesa o cliente"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className="button button--ghost" type="button" onClick={reload}>
          Actualizar
        </button>
      </div>
      {isLoading ? (
        <StatePanel kind="loading" title="Cargando cuentas" />
      ) : error ? (
        <StatePanel
          kind="error"
          title="No pudimos cargar las cuentas"
          description={error.message}
          actionLabel="Reintentar"
          onAction={reload}
        />
      ) : visibleTabs.length === 0 ? (
        <StatePanel
          kind="empty"
          title={search ? 'No hay coincidencias' : 'No hay cuentas abiertas'}
          description={
            search
              ? 'Prueba con otra búsqueda.'
              : 'Abre una cuenta para comenzar a registrar consumos.'
          }
          actionLabel={!search && isOnline ? 'Abrir primera cuenta' : undefined}
          onAction={!search && isOnline ? startOpenIntent : undefined}
        />
      ) : (
        <div className="account-grid">
          {visibleTabs.map((tab) =>
            tab.id ? (
              <Link className="account-card" to={`/cuentas/${tab.id}`} key={tab.id}>
                <div className="account-card__top">
                  <span className="reference-icon" aria-hidden="true">
                    {tab.reference_type === 'table' ? 'M' : 'C'}
                  </span>
                  <span className="status-badge status-badge--open">Abierta</span>
                </div>
                <div>
                  <p className="account-card__type">
                    {tab.reference_type === 'table' ? 'Mesa' : 'Cliente'}
                  </p>
                  <h2>{tab.reference_label}</h2>
                </div>
                <div className="account-card__meta">
                  <span>{tab.item_count ?? 0} productos</span>
                  <span>{tab.opened_at ? formatRelativeTime(tab.opened_at) : '—'}</span>
                </div>
                <div className="account-card__total">
                  <span>Total</span>
                  <strong>{formatCurrency(tab.total)}</strong>
                </div>
              </Link>
            ) : null,
          )}
        </div>
      )}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (!pending) {
            cancelOpenIntent();
          }
        }}
        title="Abrir una cuenta"
        description="Identifícala por mesa o por el nombre del cliente."
        size="small"
      >
        <form className="form-stack" onSubmit={submit}>
          <fieldset className="segmented">
            <legend className="sr-only">Tipo de referencia</legend>
            <label className={referenceType === 'table' ? 'segmented__active' : ''}>
              <input
                type="radio"
                name="type"
                value="table"
                checked={referenceType === 'table'}
                onChange={() => {
                  openIntentRef.current = createIntentId();
                  setReferenceType('table');
                }}
              />
              Mesa
            </label>
            <label className={referenceType === 'customer' ? 'segmented__active' : ''}>
              <input
                type="radio"
                name="type"
                value="customer"
                checked={referenceType === 'customer'}
                onChange={() => {
                  openIntentRef.current = createIntentId();
                  setReferenceType('customer');
                }}
              />
              Cliente
            </label>
          </fieldset>
          <label className="field">
            <span>
              {referenceType === 'table'
                ? 'Nombre o número de mesa'
                : 'Nombre del cliente'}
            </span>
            <input
              value={label}
              onChange={(event) => {
                openIntentRef.current = createIntentId();
                setLabel(event.target.value);
              }}
              placeholder={referenceType === 'table' ? 'Ej. Terraza 4' : 'Ej. Andrea'}
              autoFocus
              maxLength={100}
            />
          </label>
          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}
          <div className="modal-actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={cancelOpenIntent}
              disabled={pending}
            >
              Cancelar
            </button>
            <button className="button button--primary" disabled={pending || !isOnline}>
              {pending ? (
                <>
                  <Spinner />
                  Abriendo…
                </>
              ) : (
                'Abrir cuenta'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
