import * as React from "react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export type ConfirmDialogVariant = "default" | "danger";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = React.useCallback(() => {
    onConfirm();
    onOpenChange(false);
  }, [onConfirm, onOpenChange]);

  const handleCancel = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleCancel} size="sm" variant="outline">
            {cancelText}
          </Button>
          {variant === "danger" ? (
            <Button onClick={handleConfirm} size="sm" variant="destructive">
              {confirmText}
            </Button>
          ) : (
            <button
              className="neumorph-button rounded-lg px-5 py-1.5 font-vcr text-xs transition-all"
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
