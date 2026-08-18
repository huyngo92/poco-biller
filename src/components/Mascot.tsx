"use client";

/**
 * Minh hoạ mascot Poco cho empty state / thẻ hoàn tất / trang login.
 * Ảnh đã cắt sẵn nền trong suốt trong public/mascots.
 */
export type MascotName = "celebrate" | "scan" | "send" | "done";

export default function Mascot({
  name,
  size = 120,
  className,
}: {
  name: MascotName;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`mascot ${className ?? ""}`}
      aria-hidden="true"
      style={{ display: "inline-flex", width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mascots/${name}.png`}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </span>
  );
}
