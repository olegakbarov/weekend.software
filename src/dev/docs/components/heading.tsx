import { Icon } from "./icon";

interface HeadingProps {
  as?: "h2" | "h3" | "h4";
  id?: string;
  children: React.ReactNode;
}

/** Anchor heading — visible link icon shows on hover, clickable to deep-link. */
export function H({ as = "h2", id, children }: HeadingProps): React.JSX.Element {
  const Tag = as;
  return (
    <Tag id={id} className="h-anchor">
      {id && (
        <a className="anchor-link" href={`#${id}`} aria-label="Anchor">
          <Icon name="hash" size={12} />
        </a>
      )}
      {children}
    </Tag>
  );
}
