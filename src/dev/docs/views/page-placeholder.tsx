import type { FlatRoute } from "../routes";

interface PagePlaceholderProps {
  route: FlatRoute;
}

export function PagePlaceholder({ route }: PagePlaceholderProps): React.JSX.Element {
  return (
    <div className="page-header">
      <div className="page-eyebrow">{route.group}</div>
      <h1>{route.name}</h1>
      <p className="lede">
        Documentation for <strong>{route.name}</strong> will land here. Migrating from the legacy
        site one page at a time.
      </p>
    </div>
  );
}
