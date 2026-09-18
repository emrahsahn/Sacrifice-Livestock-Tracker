import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLE } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const startTime = Date.now();

    // Supabase'i aktif tutmak için hafif bir sorgu çalıştırıyoruz
    const { data, error } = await supabase
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
