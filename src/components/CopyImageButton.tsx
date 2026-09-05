"use client";

import { useState } from "react";
import { IconCheck, IconImage, ICON_SIZE } from "./Icons";

/**
 * Copy một ảnh (vd. QR chuyển khoản) vào clipboard hệ thống để dán thẳng
 * vào khung chat (Zalo, Messenger...) — không cần lưu file rồi đính kèm tay.
 *
 * Clipboard Image API chỉ chạy trên context an toàn (https/localhost) và cần
 * `ClipboardItem`; Safari/Firefox cũ hoặc trang http thường không hỗ trợ, nên
 * luôn có lời khuyên "long-press lưu ảnh" làm phương án dự phòng.
 */
export default function CopyImageButton({
  imageUrl,
  label = "Copy ảnh QR",
  className = "btn btn-sm",
  ariaLabel,
}: {
  imageUrl: string;
  label?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyImage() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setFailed(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Không tải được ảnh QR.");
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-block" }}>
      <button
        type="button"
        className={className}
        onClick={copyImage}
        disabled={busy}
        aria-live="polite"
        aria-label={ariaLabel || label}
      >
        {done ? <IconCheck size={ICON_SIZE.sm} /> : <IconImage size={ICON_SIZE.sm} />}
      </button>
      {failed && (
        <span className="hint" style={{ display: "block", marginTop: 4 }}>
          Trình duyệt này không cho copy ảnh tự động. Bạn nhấn giữ ảnh QR để
          lưu hoặc chia sẻ thủ công.
        </span>
      )}
    </span>
  );
}
