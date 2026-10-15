import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSelectedYear } from "@/lib/season";
import type { Sezon } from "@/lib/types";

export const metadata: Metadata = {
  title: "Kurban Yönetim Sistemi",
  description: "Kurbanlık hayvanların müşteri takibini kolaylaştıran sistem.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let year = 2026;
  let season: Sezon = {
    yil: 2026,
    ad: "2026 Kurban Sezonu",
    durum: "acik",
    is_default: true,
  };
  let allSeasons: Sezon[] = [season];

  try {
    const supabase = await createClient();
    const res = await getSelectedYear(supabase);
    year = res.year;
    season = res.season;
    allSeasons = res.allSeasons;
  } catch {
    // Oturum/env veya ilk kurulum fallback
  }

  const defaultSeason = allSeasons.find((s) => s.is_default);

  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell
            currentYear={year}
            currentSeason={season}
            defaultSeason={defaultSeason}
            seasons={allSeasons}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
