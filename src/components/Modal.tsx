import { useEffect, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  testid: string;
  children: ReactNode;
  busy?: boolean;
  size?: 'sm' | 'md';
}

/** Native <dialog>: focus trap, Escape and inert background come from the platform. */
export function Modal({ open, onClose, title, testid, children, busy, size = 'md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="modal modal-bottom sm:modal-middle"
      aria-labelledby={`${testid}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      {open && (
        <div data-testid={testid} className={`modal-box rounded-xl p-0 ${size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg'}`}>
          <div className="flex items-center justify-between border-b border-base-300 px-5 py-3">
            <h2 id={`${testid}-title`} className="text-base font-semibold">{title}</h2>
            <button type="button" className="btn btn-ghost btn-sm btn-square" aria-label="Close dialog" onClick={onClose} disabled={busy}>
              <IconClose className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
