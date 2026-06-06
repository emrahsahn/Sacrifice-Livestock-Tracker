import { cookies } from "next/headers";
import { SESSION_COOKIE, getSessionCookieValue } from "@/lib/session-config";

/** Server Action ve sunucu tarafı veri erişiminde oturum zorunluluğu. */
export async function requireSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (session !== getSessionCookieValue()) {
    throw new Error("Oturum geçersiz. Lütfen tekrar giriş yapın.");
  }
}
