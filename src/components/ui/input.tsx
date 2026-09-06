"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { numerico?: boolean }
>(({ className, numerico = false, ...props }, ref) => (
  <input
    ref={ref}
    data-slot="input"
    className={cn(
      "h-10 w-full rounded-campo border border-bordo bg-superficie px-3 text-campo text-inchiostro",
      "placeholder:text-inchiostro-tenue/70",
      "transition-[border-color,box-shadow] duration-150 ease-quieto",
      "hover:border-[#D5DBE7]",
      "focus:border-accento focus:outline-none focus:ring-2 focus:ring-accento/20",
      "disabled:cursor-not-allowed disabled:bg-superficie-alt disabled:text-inchiostro-tenue",
      numerico && "cifre text-right",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn("text-etichetta font-medium text-inchiostro", className)}
    {...props}
  />
));
Label.displayName = "Label";

/** Campo completo: etichetta, controllo, nota di aiuto. */
export function Campo({
  etichetta,
  aiuto,
  htmlFor,
  children,
  className,
}: {
  etichetta: string;
  aiuto?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{etichetta}</Label>
      {children}
      {aiuto && <p className="text-micro text-inchiostro-tenue">{aiuto}</p>}
    </div>
  );
}
