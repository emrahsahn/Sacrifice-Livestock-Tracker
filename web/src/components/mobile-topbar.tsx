"use client";
import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavSidebar } from "@/components/nav-sidebar";
import { YearSwitcher } from "@/components/year-switcher";
import type { Sezon } from "@/lib/types";

interface MobileTopbarProps {
  currentYear?: number;
  seasons?: Sezon[];
}

export function MobileTopbar({ currentYear, seasons }: MobileTopbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Topbar — sadece mobilde görünür */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar px-3 safe-top">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menüyü aç" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Navigasyon menüsü</SheetTitle>
              <NavSidebar
                onNavClick={() => setOpen(false)}
                currentYear={currentYear}
                seasons={seasons}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-1.5">
            <Image
              src="/logo.jpeg"
              alt="Kurban Yönetim Sistemi"
              width={26}
              height={26}
              className="h-6 w-6 shrink-0 object-contain rounded"
            />
            <span className="text-xs font-bold text-sidebar-foreground truncate max-w-[90px] sm:max-w-none">
              Kurban
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentYear !== undefined && seasons && seasons.length > 0 && (
            <YearSwitcher currentYear={currentYear} seasons={seasons} compact />
          )}
          <ThemeToggle />
        </div>
      </header>
    </>
  );
}
