"use client";

import { useState } from "react";
import { IconCheck, IconCopy, ICON_SIZE } from "./Icons";

export default function CopyButton({
  text,
  label = "Copy tin nhắn",
  className = "btn btn-sm",
  ariaLabel,
}: {
  text: string;
  label?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    setFailed(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
      }
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setFailed(true);
    }
  }

  return (
    <span style={{ display: "inline-block" }}>
      <button
        type="button"
        className={className}
        onClick={copy}
        aria-live="polite"
        aria-label={ariaLabel || label}
      >
        {done ? <IconCheck size={ICON_SIZE.sm} /> : <IconCopy size={ICON_SIZE.sm} />}
      </button>
      {failed && (
        <span className="hint" style={{ display: "block", marginTop: 4 }}>
          Trình duyệt không cho copy tự động. Bạn chọn và copy thủ công giúp.
        </span>
      )}
    </span>
  );
}
