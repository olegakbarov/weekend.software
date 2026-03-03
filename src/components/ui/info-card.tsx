import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from "@/lib/utils/safe-local-storage";

interface InfoCardTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface InfoCardDescriptionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const InfoCardTitle = React.memo(
  ({ children, className, ...props }: InfoCardTitleProps) => {
    return (
      <div className={cn("mb-1 font-medium", className)} {...props}>
        {children}
      </div>
    );
  }
);
InfoCardTitle.displayName = "InfoCardTitle";

const InfoCardDescription = React.memo(
  ({ children, className, ...props }: InfoCardDescriptionProps) => {
    return (
      <div
        className={cn("text-muted-foreground leading-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
InfoCardDescription.displayName = "InfoCardDescription";

interface CommonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface InfoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  storageKey?: string;
  dismissType?: "once" | "forever";
}

type InfoCardContentProps = CommonCardProps;
type InfoCardFooterProps = CommonCardProps;
type InfoCardDismissProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  onDismiss?: () => void;
};
type InfoCardActionProps = CommonCardProps;

const InfoCardContent = React.memo(
  ({ children, className, ...props }: InfoCardContentProps) => {
    return (
      <div className={cn("flex flex-col gap-1 text-xs", className)} {...props}>
        {children}
      </div>
    );
  }
);
InfoCardContent.displayName = "InfoCardContent";

const InfoCardContext = createContext<{
  isHovered: boolean;
  onDismiss: () => void;
}>({
  isHovered: false,
  // biome-ignore lint/suspicious/noEmptyBlockStatements: default noop
  onDismiss: () => {},
});

function InfoCard({
  children,
  className,
  storageKey,
  dismissType = "once",
}: InfoCardProps) {
  if (dismissType === "forever" && !storageKey) {
    throw new Error(
      'A storageKey must be provided when using dismissType="forever"'
    );
  }

  const [isHovered, setIsHovered] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined" || dismissType === "once") return false;
    return dismissType === "forever" && storageKey
      ? safeLocalStorageGetItem(storageKey) === "dismissed"
      : false;
  });

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (dismissType === "forever" && storageKey) {
      safeLocalStorageSetItem(storageKey, "dismissed");
    }
  }, [storageKey, dismissType]);

  const cardContextValue = useMemo(
    () => ({
      isHovered,
      onDismiss: handleDismiss,
    }),
    [isHovered, handleDismiss]
  );

  if (isDismissed) {
    return null;
  }

  return (
    <InfoCardContext.Provider value={cardContextValue}>
      <div
        className={cn(
          "group rounded-lg border p-3",
          "bg-card",
          "border-border",
          "transition-opacity duration-200",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
    </InfoCardContext.Provider>
  );
}

const InfoCardFooter = ({ children, className }: InfoCardFooterProps) => {
  const { isHovered } = useContext(InfoCardContext);

  return (
    <div
      className={cn(
        "mt-2 flex justify-between text-muted-foreground text-xs",
        "overflow-hidden transition-opacity duration-150",
        isHovered ? "max-h-20 opacity-100" : "max-h-0 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
};

const InfoCardDismiss = React.memo(
  ({ children, className, onDismiss, ...props }: InfoCardDismissProps) => {
    const { onDismiss: contextDismiss } = useContext(InfoCardContext);

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onDismiss?.();
      contextDismiss();
    };

    return (
      <div
        className={cn("transition-colors hover:text-foreground", className)}
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);
InfoCardDismiss.displayName = "InfoCardDismiss";

const InfoCardAction = React.memo(
  ({ children, className, ...props }: InfoCardActionProps) => {
    return (
      <div
        className={cn("transition-colors hover:text-foreground", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
InfoCardAction.displayName = "InfoCardAction";

export {
  InfoCard,
  InfoCardTitle,
  InfoCardDescription,
  InfoCardContent,
  InfoCardFooter,
  InfoCardDismiss,
  InfoCardAction,
};
