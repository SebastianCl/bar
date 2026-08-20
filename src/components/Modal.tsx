import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  size = 'medium',
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'small' | 'medium' | 'large';
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
    >
      <div className="modal__surface">
        <header className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}
