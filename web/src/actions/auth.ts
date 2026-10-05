"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  getSessionCookieValue,
  getSessionMaxAgeSeconds,
} from "@/lib/session-config";

export async function login(_state: unknown, formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  // Env tanımlı değilse sabit/varsayılan bir kimlikle girişe izin verme (fail-closed)
  if (!validUser || !validPass) {
    return {
      error:
        "Sunucu yapılandırması eksik: ADMIN_USERNAME / ADMIN_PASSWORD tanımlı değil.",
    };
  }

  if (username !== validUser || password !== validPass) {
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, getSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function getSession() {
  const cookieStore = await cookies();
  const val = cookieStore.get(SESSION_COOKIE)?.value;
  return val === getSessionCookieValue();
}
