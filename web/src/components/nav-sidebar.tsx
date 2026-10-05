"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, List, Search, Plus, BarChart2, Trash2, Mail, Phone, ExternalLink, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/actions/auth";

const navItems = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/musteriler", label: "Müşterileri Göster", icon: List },
  { href: "/sorgula", label: "Müşteri Sorgula", icon: Search },
  { href: "/ekle", label: "Müşteri Ekle", icon: Plus },
  { href: "/istatistikler", label: "İstatistikler", icon: BarChart2 },
  { href: "/sil", label: "Müşteri Sil", icon: Trash2 },
];
//{ href: "/guncelle", label: "Müşteri Güncelle", icon: RefreshCw },

interface NavSidebarProps {
  className?: string;
  onNavClick?: () => void;
}

export function NavSidebar({ className, onNavClick }: NavSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground overflow-y-auto",
        className
      )}
    >
      {/* Logo / Başlık */}
      <div className="flex items-center gap-3 px-6 py-5 shrink-0">
        <Image
          src="/logo.jpeg"
          alt="Kurban Yönetim Sistemi"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
          priority
        />
        <div>
          <h1 className="text-base font-bold leading-tight">Kurban Yönetim Sistemi</h1>
        </div>
      </div>

      <Separator />

      {/* Navigasyon */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator />

      {/* Alt kısım: tema + yapan kişi */}
      <div className="px-4 py-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Çıkış Yap
          </button>
        </form>

        <Separator />

        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Emrah ŞAHİN</p>
          <a
            href="mailto:sahinemrah3344@gmail.com"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Mail className="h-3 w-3 shrink-0" />
            sahinemrah3344@gmail.com
          </a>
          <a
            href="https://github.com/emrahsahn"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            github.com/emrahsahn
          </a>
          <a
            href="tel:+905380874885"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Phone className="h-3 w-3 shrink-0" />
            0538 087 48 85
          </a>
        </div>
      </div>
    </aside>
  );
}
