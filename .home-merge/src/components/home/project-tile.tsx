import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ProjectTileProps {
  title: string;
  description: string;
  eyebrow: string;
  meta: string;
  to: string;
  icon: LucideIcon;
  preview: ReactNode;
}

export function ProjectTile({
  title,
  description,
  eyebrow,
  meta,
  to,
  icon: Icon,
  preview,
}: ProjectTileProps) {
  return (
    <article className="group min-h-[18rem] min-w-0 border-b border-r border-b-white/10 border-r-white/10 border-l border-t border-l-white/35 border-t-white/35 bg-transparent text-left md:h-full md:min-h-0">
      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="truncate text-lg font-medium tracking-tight text-foreground lg:text-xl">
              {title}
            </h2>
          </div>
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" />
        </div>
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
          {description}
        </p>
        <div className="min-h-0 flex-1">{preview}</div>
        <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
          <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {meta}
          </p>
          <Link
            to={to}
            className="flex w-full items-center justify-between border-b border-r border-b-white/10 border-r-white/10 border-l border-t border-l-white/30 border-t-white/30 px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-foreground transition-colors duration-150 hover:border-l-white/45 hover:border-t-white/45"
          >
            VIEW MORE
            <ArrowRight className="size-4 transition duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
