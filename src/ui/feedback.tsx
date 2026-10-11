import { CircleCheckBig, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

type ToastTone = 'success' | 'info' | 'warning' | 'danger';
interface ToastInput {
  message: ReactNode;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}
interface ToastItem extends ToastInput {
  id: number;
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface FeedbackApi {
  toast: (input: ToastInput) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_ICON = { success: CircleCheckBig, info: Info, warning: TriangleAlert, danger: OctagonAlert };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...input, id }]);
      window.setTimeout(() => dismiss(id), input.duration ?? (input.action ? 8000 : 4500));
    },
    [dismiss],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }, [pending]);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
    const dialog = dialogRef.current;
    if (dialog?.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    returnFocus.current?.focus?.();
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone ?? 'success'];
          return (
            <div key={t.id} className={`toast toast--${t.tone ?? 'success'}`} role="status">
              <Icon size={18} aria-hidden className="toast__icon" />
              <div className="toast__message">{t.message}</div>
              {t.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X size={15} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onCancel={(e) => {
          e.preventDefault();
          settle(false);
        }}
      >
        {pending && (
          <div className="dialog__panel">
            <h2 id="confirm-title" className="dialog__title">
              {pending.title}
            </h2>
            <div id="confirm-message" className="dialog__message">
              {pending.message}
            </div>
            <div className="dialog__actions">
              <Button variant="secondary" onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={pending.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)} autoFocus>
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}
