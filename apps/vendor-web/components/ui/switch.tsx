"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // ✅ FIX: Use explicit colors instead of CSS variables that might not be defined
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all outline-none",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FF8C42]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Checked state - orange
        "data-[state=checked]:bg-[#FF8C42]",
        // Unchecked state - visible gray
        "data-[state=unchecked]:bg-gray-300",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // ✅ FIX: White thumb that's clearly visible
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

