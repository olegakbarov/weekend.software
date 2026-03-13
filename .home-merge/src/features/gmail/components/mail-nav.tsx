import { cn } from "~/lib/utils";
import { buttonVariants } from "../ui/button";
import type { MailNavLink } from "../types";

type MailNavProps = {
  links: MailNavLink[];
  isCollapsed: boolean;
};

export function MailNav({ links, isCollapsed }: MailNavProps) {
  return (
    <div
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
      data-collapsed={isCollapsed}
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link) => {
          const Icon = link.icon;

          if (isCollapsed) {
            return (
              <a
                aria-label={link.title}
                className={cn(
                  buttonVariants({ variant: link.variant, size: "icon" }),
                  "size-9",
                  link.variant === "default" &&
                    "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white"
                )}
                href="#"
                key={link.title}
                onClick={(event) => event.preventDefault()}
                title={link.label ? `${link.title} (${link.label})` : link.title}
              >
                <Icon className="size-4" />
                <span className="sr-only">{link.title}</span>
              </a>
            );
          }

          return (
            <a
              className={cn(
                buttonVariants({ variant: link.variant, size: "sm" }),
                link.variant === "default" &&
                  "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white",
                "justify-start"
              )}
              href="#"
              key={link.title}
              onClick={(event) => event.preventDefault()}
            >
              <Icon className="mr-2 size-4" />
              {link.title}
              {link.label ? (
                <span
                  className={cn(
                    "ml-auto",
                    link.variant === "default" && "text-background dark:text-white"
                  )}
                >
                  {link.label}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
