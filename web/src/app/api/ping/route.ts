import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLE } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel cron, CRON_SECRET tanımlıysa isteği "Authorization: Bearer <secret>" ile atar.
  // Secret tanımlı değilse endpoint'i şifresiz açmak yerine 503 ile kapatıyoruz.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET tanımlı değil; ping endpoint'i devre dışı.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      {
        success: false,
        error: "Yetkisiz istek.",
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();
    const startTime = Date.now();

    // Supabase'i aktif tutmak için hafif bir sorgu çalıştırıyoruz
    const { error } = await supabase
      .from(TABLE)
      .select("random_id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Supabase veritabanı başarıyla pinglendi ve aktif tutuldu.",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu";
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
