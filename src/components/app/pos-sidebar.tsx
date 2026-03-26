"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CommandIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type NavIcon = LucideIcon;

export interface NavBaseItem {
  title: string;
  icon: NavIcon;
}

export interface NavGroupItem extends NavBaseItem {
  url: string;
  isComing?: boolean;
  isActive?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavGroupItem[];
}

export interface NavMainItem extends NavBaseItem {
  url?: string;
  groups?: NavGroup[];
}

export type NavMain = NavMainItem[];

interface POSSidebarProps extends React.ComponentProps<typeof Sidebar> {
  brandTitle?: string;
  brandSubtitle?: string;
  navMain: NavMain;
  currentPath: string;
  onNavigate?: (url: string) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

function POSSidebar({
  brandTitle = "MartPOS",
  brandSubtitle = "Panel",
  navMain,
  currentPath,
  onNavigate,
  headerSlot,
  footerSlot,
  ...props
}: POSSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  const findParentByPath = React.useCallback(
    (path: string) =>
      navMain.find((item) =>
        item.groups?.some((group) => group.items.some((sub) => path.startsWith(sub.url))),
      ) ?? null,
    [navMain],
  );

  const [detailItem, setDetailItem] = React.useState<NavMainItem | null>(() =>
    findParentByPath(currentPath),
  );

  React.useLayoutEffect(() => {
    const parent = findParentByPath(currentPath);
    if (parent) {
      setDetailItem(parent);
    }
  }, [findParentByPath, currentPath]);

  const closeMobileSidebar = React.useCallback(() => {
    if (!isMobile) {
      return;
    }

    setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const navigate = React.useCallback(
    (url?: string) => {
      if (!url) {
        return;
      }
      onNavigate?.(url);
      closeMobileSidebar();
    },
    [closeMobileSidebar, onNavigate],
  );

  return (
    <Sidebar collapsible="icon" className="z-50 gap-0" {...props}>
      <SidebarHeader className="mb-0 gap-2 space-y-0 pb-0">
        <div className="flex items-center gap-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <CommandIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{brandTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{brandSubtitle}</p>
          </div>
        </div>
        {headerSlot}
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-hidden pt-0">
        <ScrollArea className="h-full">
          {!detailItem ? (
            <SidebarGroup>
              <SidebarMenu>
                {navMain.map((item) => {
                  const isTopActive = item.url ? currentPath.startsWith(item.url) : false;
                  const hasGroups = Boolean(item.groups?.length);
                  const Icon = item.icon;

                  if (!hasGroups) {
                    return (
                      <SidebarMenuItem key={item.url ?? item.title}>
                        <SidebarMenuButton
                          tooltip={item.title}
                          size="lg"
                          isActive={isTopActive}
                          className={cn("cursor-pointer", !isTopActive && "text-muted-foreground")}
                          onClick={() => navigate(item.url)}
                        >
                          <Icon className={cn(!isTopActive && "text-muted-foreground")} />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.url ?? item.title}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        size="lg"
                        isActive={isTopActive}
                        className={cn("cursor-pointer", !isTopActive && "text-muted-foreground")}
                        onClick={() => {
                          setDetailItem(item);
                          const firstDetailUrl = item.groups?.[0]?.items?.[0]?.url;
                          navigate(firstDetailUrl);
                        }}
                      >
                        <Icon className={cn(!isTopActive && "text-muted-foreground")} />
                        <span>{item.title}</span>
                        <ChevronRightIcon className="ml-auto size-4" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ) : (
            <SidebarGroup>
              <SidebarGroupContent className="pb-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="relative w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setDetailItem(null)}
                >
                  <ChevronLeftIcon className="absolute left-2 size-4" />
                  <div className="w-full">{detailItem.title}</div>
                </Button>
              </SidebarGroupContent>

              <SidebarMenu>
                {(detailItem.groups || []).map((group, index) => (
                  <React.Fragment key={group.id}>
                    {index > 0 ? (
                      <SidebarMenuItem className="py-0">
                        <SidebarGroupLabel className="h-fit px-2 pt-2 text-[10px] uppercase text-muted-foreground">
                          {group.label}
                        </SidebarGroupLabel>
                      </SidebarMenuItem>
                    ) : null}

                    {group.items.map((sub) => {
                      const isSubActive = currentPath === sub.url;
                      const SubIcon = sub.icon;

                      return (
                        <SidebarMenuItem key={sub.url}>
                          <SidebarMenuButton
                            isActive={isSubActive}
                            size="lg"
                            className={cn(!isSubActive && "text-muted-foreground")}
                            onClick={() => navigate(sub.url)}
                          >
                            <SubIcon
                              className={cn("size-4", !isSubActive && "text-muted-foreground")}
                            />
                            <span className="w-full font-normal">{sub.title}</span>
                            {sub.isComing ? <Badge variant="secondary">Proximamente</Badge> : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </React.Fragment>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-0 px-0">
        {footerSlot ? <div className="p-1">{footerSlot}</div> : null}
      </SidebarFooter>
    </Sidebar>
  );
}

export { POSSidebar };
