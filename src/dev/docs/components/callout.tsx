import { Info, AlertTriangle, Sparkles } from "lucide-react";

export type CalloutKind = "info" | "alert" | "sparkle";

interface CalloutProps {
  kind?: CalloutKind;
  children: React.ReactNode;
}

const ICON = {
  info: Info,
  alert: AlertTriangle,
  sparkle: Sparkles,
} as const;

export function Callout({ kind = "info", children }: CalloutProps): React.JSX.Element {
  const IconComponent = ICON[kind];
  return (
    <div className="callout">
      <IconComponent className="ico" size={16} />
      <div>{children}</div>
    </div>
  );
}
