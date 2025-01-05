import { ComponentPropsWithoutRef, ElementRef } from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

declare const DropdownMenu: typeof DropdownMenuPrimitive.Root
declare const DropdownMenuTrigger: typeof DropdownMenuPrimitive.Trigger
declare const DropdownMenuContent: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Content>>
  }
>
declare const DropdownMenuItem: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Item>>
    inset?: boolean
  }
>

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} 