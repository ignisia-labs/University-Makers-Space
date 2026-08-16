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
  desktopScrollable = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: "default" | "wide";
  desktopScrollable?: boolean;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] overflow-x-hidden">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="min-w-0 overflow-x-hidden overflow-y-auto px-4 pb-8">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto",
          size === "wide" ? "sm:max-w-4xl" : "sm:max-w-lg",
          !desktopScrollable && "lg:overflow-y-hidden",
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-w-0 overflow-x-hidden">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
