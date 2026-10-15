"use client";
import { usePathname } from "next/navigation";
import { NavSidebar } from "@/components/nav-sidebar";
import { MobileTopbar } from "@/components/mobile-topbar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { YearAlertBanner } from "@/components/year-alert-banner";
import type { Sezon } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  currentYear?: number;
  currentSeason?: Sezon;
  defaultSeason?: Sezon;
  seasons?: Sezon[];
}

export function AppShell({
  children,
  currentYear,
  currentSeason,
  defaultSeason,
  seasons,
}: AppShellProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Masaüstü sidebar — sabit, lg ve üzeri */}
      <NavSidebar
        className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64"
        currentYear={currentYear}
        seasons={seasons}
      />

      {/* Mobil üst bar */}
      <MobileTopbar currentYear={currentYear} seasons={seasons} />

      {/* İçerik alanı */}
      <main className="lg:pl-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="p-4 md:p-6 lg:p-8">
          {currentSeason && (
            <YearAlertBanner
              currentSeason={currentSeason}
              defaultSeason={defaultSeason}
            />
          )}
          {children}
        </div>
      </main>

      {/* Mobil alt navigasyon */}
      <MobileBottomNav />
    </div>
  );
}
