import { type ReactNode, useEffect } from 'react';

// A panel over the table or the launch screen (the rules, Affichage, the settings, a mode's panel): a dialog on a
// backdrop that closes on a tap beside the panel or on Escape (the owner, 2026-10-25: "Fermer" alone was not enough),
// so every panel dismisses the same way. The end-of-round panel does not take `onClose`: it is left by its buttons.

interface Props {
  labelledBy: string;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
}

export function Overlay({ labelledBy, className, onClose, children }: Props) {
  // On the document, not the dialog: a panel that focuses nothing (a mode's panel) must still close on Escape.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className={className ? `overlay ${className}` : 'overlay'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (onClose && e.key === 'Escape') onClose();
      }}
    >
      {children}
    </div>
  );
}
