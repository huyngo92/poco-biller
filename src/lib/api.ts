import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    // Lỗi 5xx (backup GitHub, AI...) in ra terminal kèm chi tiết — nếu không
    // log ở đây thì server chỉ hiện dòng access log "POST ... 502" trống
    // trơn, không thấy được lý do thật (401 token sai, repo trống, v.v.).
    if (error.status >= 500) console.error("[poco-biller]", error.message);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  console.error("[poco-biller]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function num(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `Thiếu hoặc sai giá trị: ${field}`);
  return n;
}

export function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new HttpError(400, `Thiếu giá trị: ${field}`);
  return value.trim().slice(0, max);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateStr(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE_RE.test(value))
    throw new HttpError(400, `Ngày không hợp lệ: ${field}`);
  return value;
}
