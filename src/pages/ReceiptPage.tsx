import { Link, useParams } from 'react-router-dom';
import { StatePanel } from '../components/States';
import { useResource } from '../hooks/useResource';
import { getReceiptDetail } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';

export function ReceiptPage() {
  const { id = '' } = useParams();
  const { data, error, isLoading } = useResource(() => getReceiptDetail(id), id);
  if (isLoading) return <StatePanel kind="loading" title="Preparando comprobante" />;
  if (error || !data)
    return (
      <StatePanel
        kind="error"
        title="No pudimos cargar el comprobante"
        description={error?.message}
        actionLabel="Volver a ventas"
        actionHref="/ventas"
      />
    );
  const { receipt, items } = data;

  return (
    <div className="receipt-page">
      <div className="receipt-toolbar no-print">
        <Link className="back-link" to="/ventas">
          ← Historial de ventas
        </Link>
        <button
          className="button button--primary"
          type="button"
          onClick={() => window.print()}
        >
          Imprimir / Guardar PDF
        </button>
      </div>
      <article className="receipt" aria-label={`Comprobante ${receipt.receipt_code}`}>
        <header className="receipt__header">
          <div className="receipt__logo">B</div>
          <div>
            <h1>{receipt.bar_name_snapshot}</h1>
            {receipt.bar_identification_snapshot ? (
              <p>{receipt.bar_identification_snapshot}</p>
            ) : null}
            {receipt.bar_address_snapshot ? (
              <p>{receipt.bar_address_snapshot}</p>
            ) : null}
            {receipt.bar_phone_snapshot ? <p>{receipt.bar_phone_snapshot}</p> : null}
          </div>
        </header>
        <div className="receipt__title">
          <div>
            <span>Comprobante</span>
            <strong>{receipt.receipt_code}</strong>
          </div>
          <div>
            <span>Fecha</span>
            <strong>{formatDateTime(receipt.issued_at)}</strong>
          </div>
        </div>
        <dl className="receipt__reference">
          <div>
            <dt>{receipt.reference_type_snapshot === 'table' ? 'Mesa' : 'Cliente'}</dt>
            <dd>{receipt.reference_label_snapshot}</dd>
          </div>
          <div>
            <dt>Moneda</dt>
            <dd>{receipt.currency}</dd>
          </div>
        </dl>
        <table className="receipt__items">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.product_name_snapshot}</strong>
                  {item.sku_snapshot ? <small>{item.sku_snapshot}</small> : null}
                </td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unit_price_snapshot)}</td>
                <td>{formatCurrency(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt__total">
          <span>Total</span>
          <strong>{formatCurrency(receipt.total)}</strong>
        </div>
        <footer className="receipt__footer">
          <strong>Gracias por tu visita</strong>
          <p>Este documento es un comprobante interno de consumo.</p>
        </footer>
      </article>
    </div>
  );
}
