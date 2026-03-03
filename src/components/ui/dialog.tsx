import { XIcon } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DialogProps = {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used within <Dialog>.");
  }
  return ctx;
}

function Dialog({ children, open, defaultOpen = false, onOpenChange }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const resolvedOpen = open ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open]
  );

  const value = React.useMemo(
    () => ({ open: resolvedOpen, setOpen }),
    [resolvedOpen, setOpen]
  );

  return (
    <DialogContext.Provider value={value}>
      <div data-slot="dialog">{children}</div>
    </DialogContext.Provider>
  );
}

function mergeHandlers<TEvent>(
  first?: (event: TEvent) => void,
  second?: (event: TEvent) => void
): (event: TEvent) => void {
  return (event: TEvent) => {
    first?.(event);
    second?.(event);
  };
}

function DialogTrigger({
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();

  if (asChild && React.isValidElement(props.children)) {
    const child = props.children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, {
      ...child.props,
      onClick: mergeHandlers(child.props.onClick, () => setOpen(true)),
    });
  }

  const { onClick, children, ...rest } = props;
  return (
    <button
      data-slot="dialog-trigger"
      onClick={mergeHandlers(onClick, () => setOpen(true))}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

function DialogPortal({ children }: { children?: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function DialogClose({
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();

  if (asChild && React.isValidElement(props.children)) {
    const child = props.children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, {
      ...child.props,
      onClick: mergeHandlers(child.props.onClick, () => setOpen(false)),
    });
  }

  const { onClick, children, ...rest } = props;
  return (
    <button
      data-slot="dialog-close"
      onClick={mergeHandlers(onClick, () => setOpen(false))}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen } = useDialogContext();
  if (!open) return null;

  const { onClick, ...rest } = props;
  return (
    <div
      className={cn("fixed inset-0 z-40 bg-black/60 backdrop-blur-sm", className)}
      data-slot="dialog-overlay"
      onClick={mergeHandlers(onClick, () => setOpen(false))}
      {...rest}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const { open, setOpen } = useDialogContext();

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <DialogOverlay className="absolute inset-0" />
        <div
          className={cn(
            "relative z-50 grid w-full max-w-lg gap-4 rounded border border-border bg-card p-6 shadow-lg",
            className
          )}
          data-slot="dialog-content"
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {children}
          {showCloseButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogClose className="absolute top-4 right-4 select-none rounded opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none">
                  <XIcon className="h-4 w-4" />
                </DialogClose>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-vcr text-[12px]">CLOSE</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-semibold text-lg leading-none", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
