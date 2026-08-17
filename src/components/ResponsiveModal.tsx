import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  size = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "default" | "wide";
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] overflow-x-hidden">
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // The body scrolls, not the dialog, so headers stay put and nothing gets clipped.
          "flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden",
          size === "wide" ? "sm:max-w-5xl lg:max-w-6xl" : "sm:max-w-xl",
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="-mx-1 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
