"use client";

import {
  createContext,
  forwardRef,
  use,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { cn } from "../lib/cn";
import { useIcon } from "../lib/icon-context";
import { springs } from "../lib/springs";
import { useShape } from "../lib/shape-context";
import { Button } from "../components/button";

const DialogOpenContext = createContext(false);

function Dialog({
  children,
  open: controlledOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps): React.JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = onOpenChange ?? setUncontrolledOpen;

  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "lg";
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size = "sm", ...props }, ref) => {
    const XIcon = useIcon("x");
    const open = use(DialogOpenContext);
    const shape = useShape();
    const shouldReduceMotion = useReducedMotion();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);

    const handleExitComplete = (): void => {
      if (!open) setMounted(false);
    };

    if (!mounted) return null;

    return (
      <DialogPrimitive.Portal forceMount>
        <LazyMotion features={domAnimation}>
          <DialogPrimitive.Overlay asChild forceMount>
            <m.div
              className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: open ? 1 : 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : open
                    ? springs.slow
                    : springs.moderate
              }
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
            <m.div
              className={cn(
                "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)]",
                "bg-card border border-border/60",
                "shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                "p-6 focus:outline-none",
                size === "sm" && "max-w-[400px]",
                size === "lg" && "max-w-[540px]",
                shape.container,
                className,
              )}
              initial={
                shouldReduceMotion
                  ? false
                  : { opacity: 0, scale: 0.97, x: "-50%", y: "-50%" }
              }
              animate={{
                opacity: open ? 1 : 0,
                scale: shouldReduceMotion ? 1 : open ? 1 : 0.97,
                x: "-50%",
                y: "-50%",
              }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : open
                    ? springs.slow
                    : springs.moderate
              }
              onAnimationComplete={handleExitComplete}
            >
              {children}
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Close"
                  className="absolute right-3 top-3 size-7 px-0"
                >
                  <XIcon size={14} strokeWidth={1.5} />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
            </m.div>
          </DialogPrimitive.Content>
        </LazyMotion>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />;
}

function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("flex justify-end gap-2 mt-6", className)} {...props} />;
}

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[16px] text-foreground leading-tight", className)}
    style={{ fontVariationSettings: "'wght' 700" }}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
export type { DialogContentProps };
