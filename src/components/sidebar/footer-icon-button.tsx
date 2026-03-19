export function FooterIconButton({
  active,
  icon,
  onClick,
  title,
}: {
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`rounded p-1.5 transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-foreground"
      }`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}
