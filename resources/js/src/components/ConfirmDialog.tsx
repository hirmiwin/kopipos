import { useId } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  danger = true,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const messageId = useId();
  const errorId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      describedBy={error ? `${messageId} ${errorId}` : messageId}
      footer={
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={busy}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-message" id={messageId}>{message}</p>
      <p
        className="confirm-error"
        id={errorId}
        role="alert"
        style={{ visibility: error ? 'visible' : 'hidden' }}
      >
        {error || ' '}
      </p>
    </Modal>
  );
}
