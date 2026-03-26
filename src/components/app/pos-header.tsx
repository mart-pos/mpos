"use client";

import * as React from "react";
import { MoreHorizontalIcon, type LucideIcon } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface BreadcrumbLinkType {
  title: string;
  href?: string;
}

interface HeaderButton {
  title: string;
  icon?: LucideIcon;
  isPrimary?: boolean;
  href?: string;
  onClick?: () => void;
  separatorBefore?: boolean;
}

interface POSHeaderProps {
  links?: BreadcrumbLinkType[];
  buttons?: HeaderButton[];
  isStatic?: boolean;
  title?: string;
}

function POSHeader({ links, buttons, isStatic = false, title }: POSHeaderProps) {
  const breadcrumbLinks = links ?? [];
  const secondaryButtons = buttons?.filter((button) => !button.isPrimary) ?? [];
  const primaryButton = buttons?.find((button) => button.isPrimary);

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center gap-2 border-b bg-background p-4">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={isStatic ? "hidden" : "shrink-0 md:hidden"}>
            <SidebarTrigger className="size-9 border" variant="outline" />
          </div>

          {breadcrumbLinks.length > 0 ? (
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList className="min-w-0">
                {breadcrumbLinks.map((link, index) => (
                  <React.Fragment key={`${link.title}-${index}`}>
                    {index !== 0 ? (
                      <BreadcrumbSeparator
                        className={isStatic ? "block" : "hidden md:block"}
                      />
                    ) : null}
                    <BreadcrumbItem
                      className={isStatic ? "block min-w-0" : "hidden min-w-0 md:block"}
                    >
                      {index === breadcrumbLinks.length - 1 || !link.href ? (
                        <BreadcrumbPage className="truncate">
                          {link.title}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={link.href} className="truncate">
                          {link.title}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title ?? "Panel"}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {secondaryButtons.map((button, index) => (
            <React.Fragment key={`${button.title}-${index}`}>
              {button.separatorBefore ? (
                <Separator
                  orientation="vertical"
                  className={isStatic ? "mx-1 h-6" : "mx-1 hidden h-6 md:block"}
                />
              ) : null}
              <HeaderActionButton button={button} isStatic={isStatic} />
            </React.Fragment>
          ))}

          {secondaryButtons.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className={isStatic ? "hidden" : "border md:hidden"}
                  aria-label="Mas acciones"
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {secondaryButtons.map((button) => {
                  const Icon = button.icon;

                  if (button.href) {
                    return (
                      <DropdownMenuItem key={button.title} asChild>
                        <a href={button.href} className="cursor-pointer">
                          {Icon ? <Icon className="size-4" /> : null}
                          <span>{button.title}</span>
                        </a>
                      </DropdownMenuItem>
                    );
                  }

                  return (
                    <DropdownMenuItem
                      key={button.title}
                      onClick={button.onClick}
                      className="cursor-pointer"
                    >
                      {Icon ? <Icon className="size-4" /> : null}
                      <span>{button.title}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {primaryButton ? (
            <>
              {primaryButton.separatorBefore ? (
                <Separator
                  orientation="vertical"
                  className={isStatic ? "h-6" : "hidden h-6 md:block"}
                />
              ) : null}
              <HeaderActionButton button={primaryButton} isPrimary isStatic={isStatic} />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function HeaderActionButton({
  button,
  isPrimary = false,
  isStatic,
}: {
  button: HeaderButton;
  isPrimary?: boolean;
  isStatic: boolean;
}) {
  const Icon = button.icon;
  const variant = isPrimary ? "default" : "secondary";
  const className = isPrimary
    ? isStatic
      ? "w-fit px-3"
      : "justify-center md:w-fit md:justify-between md:px-3"
    : isStatic
      ? "flex size-11 w-fit border px-3"
      : "hidden size-11 border md:flex md:w-fit md:px-3";

  if (button.href) {
    return (
      <Button variant={variant} className={className} size="sm" asChild>
        <a href={button.href} className="flex items-center gap-2" title={button.title}>
          {Icon ? <Icon className="size-4" /> : null}
          <span className={isStatic ? "inline" : "hidden md:inline"}>{button.title}</span>
        </a>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={className}
      size="sm"
      onClick={button.onClick}
      title={button.title}
    >
      {Icon ? <Icon className="size-4" /> : null}
      <span className={isStatic ? "inline" : "hidden md:inline"}>{button.title}</span>
    </Button>
  );
}

export type { BreadcrumbLinkType, HeaderButton };
export { POSHeader };
