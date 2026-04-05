import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-[1.2rem] text-sm font-bold tracking-[0.02em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-[rgba(148,74,0,0.18)] bg-[linear-gradient(135deg,hsl(30_80%_52%),hsl(24_66%_34%))] px-5 py-3 text-primary-foreground shadow-[0_18px_40px_rgba(148,74,0,0.22)] hover:-translate-y-0.5 hover:opacity-95",
        secondary:
          "border border-[rgba(220,193,177,0.42)] bg-[rgba(251,242,237,0.82)] px-5 py-3 text-secondary-foreground hover:bg-[rgba(245,236,231,0.96)]",
        ghost: "px-4 py-3 text-foreground hover:bg-secondary/80"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant }), className)} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
