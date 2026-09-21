import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

interface StateProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function StatePanel({
  kind,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact,
}: StateProps) {
  return (
    <section
      className={`state-panel ${compact ? 'state-panel--compact' : ''}`}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
    >
      <div
        className={`state-panel__icon state-panel__icon--${kind}`}
        aria-hidden="true"
      >
        {kind === 'loading' ? <Spinner /> : kind === 'empty' ? '○' : '!'}
      </div>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Link className="button button--secondary" to={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button className="button button--secondary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function FullPageState(props: StateProps) {
  return (
    <main className="full-page-state">
      <div className="full-page-state__brand">
        <span>B</span> Charcuteria La 61
      </div>
      <StatePanel {...props} />
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
