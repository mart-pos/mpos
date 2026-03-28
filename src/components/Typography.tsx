"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  asChild?: boolean;
};

const pageTitleStyles = cn(
  "text-lg font-medium tracking-tight leading-tight first-letter:capitalize",
);

function PageTitle({ asChild, className, ...props }: HeadingProps) {
  const Comp = asChild ? Slot.Root : ("h1" as const);
  return <Comp className={cn(pageTitleStyles, className)} {...props} />;
}

const sectionTitleStyles = cn("text-base font-medium tracking-tight leading-6");

function SectionTitle({ asChild, className, ...props }: HeadingProps) {
  const Comp = asChild ? Slot.Root : ("h2" as const);
  return <Comp className={cn(sectionTitleStyles, className)} {...props} />;
}

const cardTitleStyles = cn("text-base font-medium leading-5 text-foreground");

function CardTitle({ asChild, className, ...props }: HeadingProps) {
  const Comp = asChild ? Slot.Root : ("h3" as const);
  return <Comp className={cn(cardTitleStyles, className)} {...props} />;
}

const textVariants = cva("text-sm leading-5", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      caption: "text-xs leading-4 text-muted-foreground",
      destructive: "text-destructive",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
  },
  defaultVariants: {
    variant: "default",
    weight: "normal",
  },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
  };

function Text({ asChild, className, variant, weight, ...props }: TextProps) {
  const Comp = asChild ? Slot.Root : ("p" as const);
  return (
    <Comp
      className={cn(textVariants({ variant, weight }), className)}
      {...props}
    />
  );
}

export { CardTitle, PageTitle, SectionTitle, Text };
