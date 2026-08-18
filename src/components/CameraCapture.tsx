"use client";

import { useEffect, useRef, useState } from "react";
import { IconBack, IconImage, IconZap, IconZapOff, ICON_SIZE } from "./Icons";

/**
 * Viewfinder camera thật cho quét hoá đơn — `getUserMedia` + khung 4 góc bo.
 * Không hỗ trợ/bị từ chối quyền thì tự rơi về `<input type=file capture>`.
 */
export default function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setUnavailable(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.();
        setTorchSupported(Boolean(caps && "torch" in caps));
        setReady(true);
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // Thiết bị báo hỗ trợ torch nhưng applyConstraints vẫn có thể fail — bỏ qua lặng lẽ.
    }
  }

  function shoot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "hoa-don.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  if (unavailable) {
    return (
      <div className="card card-pad stack">
        <p className="muted" style={{ margin: 0 }}>
          Không mở được camera trên thiết bị này. Bạn chọn ảnh hoá đơn từ thư viện giúp.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture(f);
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => fileRef.current?.click()}
        >
          <IconImage size={ICON_SIZE.md} /> Chọn ảnh hoá đơn
        </button>
        <button type="button" className="btn btn-block" onClick={onCancel}>
          <IconBack size={ICON_SIZE.sm} /> Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="camera-view">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="camera-topbar">
          <button
            type="button"
            className="camera-topbar-btn"
            onClick={onCancel}
            aria-label="Quay lại"
          >
            <IconBack size={ICON_SIZE.md} />
          </button>
          {torchSupported && (
            <button
              type="button"
              className="camera-topbar-btn"
              onClick={() => void toggleTorch()}
              aria-pressed={torchOn}
              aria-label="Bật/tắt đèn flash"
            >
              {torchOn ? <IconZap size={ICON_SIZE.md} /> : <IconZapOff size={ICON_SIZE.md} />}
            </button>
          )}
        </div>

        {ready && (
          <div className="camera-frame" aria-hidden="true">
            <span className="camera-corner tl" />
            <span className="camera-corner tr" />
            <span className="camera-corner bl" />
            <span className="camera-corner br" />
          </div>
        )}

        <div className="camera-bottombar">
          <button
            type="button"
            className="camera-shutter"
            onClick={shoot}
            disabled={!ready}
            aria-label="Chụp hoá đơn"
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onCapture(f);
        }}
      />
      <button type="button" className="btn btn-block" onClick={() => fileRef.current?.click()}>
        <IconImage size={ICON_SIZE.sm} /> Chọn ảnh từ thư viện
      </button>
    </div>
  );
}
