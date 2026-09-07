import { useLayoutEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import "./confirmation-dialog.css";

/** Explicit confirmation, with Cancel as the safe default focus target. */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled = false,
  returnFocusId,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm(): void;
  disabled?: boolean;
  returnFocusId?: string;
}) {
  const initiatingFocusId = useRef(returnFocusId);
  useLayoutEffect(() => {
    // Closing may clear the parent's dialog metadata before Radix restores focus.
    if (open) initiatingFocusId.current = returnFocusId;
  }, [open, returnFocusId]);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="confirmation-dialog"
        onCloseAutoFocus={(event) => {
          const target = initiatingFocusId.current
            ? document.getElementById(initiatingFocusId.current)
            : null;
          if (target) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <span className="confirmation-icon">
          <ShieldAlert aria-hidden="true" />
        </span>
        <div className="confirmation-heading">
          <span className="eyebrow">BEFORE YOU CONTINUE</span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </div>
        <div className="confirmation-actions">
          <AlertDialogCancel className="confirmation-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="confirmation-confirm"
            disabled={disabled}
            onClick={() => {
              if (!disabled) onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
