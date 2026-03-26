"use client";

import * as React from "react";
import { ChevronDownIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type NavRegion = "left" | "center" | "right";
export type NavItemType = "button" | "slot" | "select";

export interface NavBaseItem {
  id: string;
  region: NavRegion;
  order: number;
  type: NavItemType;
}

export interface NavButtonItem extends NavBaseItem {
  type: "button";
  title: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
}

export interface NavSlotItem extends NavBaseItem {
  type: "slot";
  component: React.ReactNode;
}

export interface NavSelectItem extends NavBaseItem {
  type: "select";
  defaultValue: string;
  options: { value: string; label: string }[];
  onValueChange?: (value: string) => void;
}

export type POSNavItem = NavButtonItem | NavSlotItem | NavSelectItem;

interface POSNavProps {
  items?: POSNavItem[];
}

function POSNav({ items = [] }: POSNavProps) {
  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items],
  );

  const gridClass =
    {
      1: "md:grid-cols-1",
      2: "md:grid-cols-2",
      3: "md:grid-cols-3",
      4: "md:grid-cols-4",
      5: "md:grid-cols-5",
      6: "md:grid-cols-6",
    }[sortedItems.length] ?? "md:grid-cols-4";

  return (
    <nav className="sticky top-0 z-20 flex items-center border-b bg-background px-4 py-3 md:h-16 md:py-0">
      <div className={cn("grid w-full grid-cols-1 gap-3 items-center", gridClass)}>
        {sortedItems.map((item) => (
          <div key={`${item.id}-${item.order}`} className="w-full">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </nav>
  );

  function renderItem(item: POSNavItem) {
    if (item.type === "slot") {
      return <div className="flex h-10 items-center">{item.component}</div>;
    }

    if (item.type === "select") {
      return <SafeSelect item={item} />;
    }

    const Icon = item.icon;

    if (item.href) {
      return (
        <Button variant="secondary" size="lg" className="h-10 w-full justify-center border" asChild>
          <a href={item.href} className="flex items-center gap-2">
            {Icon ? <Icon className="size-4 opacity-70" /> : null}
            <span className="truncate whitespace-nowrap">{item.title}</span>
          </a>
        </Button>
      );
    }

    return (
      <Button
        variant="secondary"
        size="lg"
        className="h-10 w-full justify-center border"
        onClick={item.onClick}
      >
        {Icon ? <Icon className="size-4 opacity-70" /> : null}
        <span className="truncate whitespace-nowrap">{item.title}</span>
      </Button>
    );
  }
}

function SafeSelect({ item }: { item: NavSelectItem }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <InputGroup>
        <InputGroupInput
          disabled
          className="placeholder:capitalize"
          placeholder={item.defaultValue.split("_").join(" ")}
        />
        <InputGroupAddon align="inline-end">
          <ChevronDownIcon className="size-4" />
        </InputGroupAddon>
      </InputGroup>
    );
  }

  return (
    <Select defaultValue={item.defaultValue} onValueChange={item.onValueChange}>
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder="Selecciona..." />
      </SelectTrigger>
      <SelectContent>
        {item.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { POSNav };
