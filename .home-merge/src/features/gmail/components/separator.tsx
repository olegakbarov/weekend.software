import { separatorClasses } from "../format";

type GmailSeparatorProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function GmailSeparator({
  orientation = "horizontal",
  className,
}: GmailSeparatorProps) {
  return (
    <div
      aria-orientation={orientation}
      className={separatorClasses(orientation, className)}
      role="separator"
    />
  );
}
