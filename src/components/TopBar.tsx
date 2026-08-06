"use client";

import { useRouter } from "next/navigation";
import { IconBack, ICON_SIZE } from "./Icons";

export default function TopBar({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="topbar">
      {back ? (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => router.back()}
          aria-label="Quay lại"
          style={{ marginLeft: -8 }}
        >
          {/* Chevron back của iOS to hơn icon thường một cỡ */}
          <IconBack size={ICON_SIZE.lg} />
        </button>
      ) : (
        <span className="brand-mark" aria-hidden="true" />
      )}
      <span className="brand">{title}</span>
      <span className="spacer" />
      {right}
    </header>
  );
}
