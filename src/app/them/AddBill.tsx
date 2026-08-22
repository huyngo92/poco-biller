"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiJson, rememberGroupId, resolveGroup } from "@/lib/client";
import { formatVnd } from "@/lib/money";
import type {
  ChatDraft,
  Group,
  Member,
  OcrResult,
  SessionUser,
} from "@/lib/types";
import GroupPicker from "@/components/GroupPicker";
import Mascot from "@/components/Mascot";
import CameraCapture from "@/components/CameraCapture";
import BillForm, { emptyDraft, type BillDraft } from "@/components/BillForm";
import {
  IconAdd,
  IconAlert,
  IconArrowRight,
  IconBack,
  IconCamera,
  IconChevron,
  IconMic,
  IconPen,
  IconSend,
  IconSparkles,
  IconSpinner,
  IconStop,
  ICON_SIZE,
} from "@/components/Icons";

/** Web Speech API chưa có type sẵn trong lib.dom.d.ts — khai báo tối thiểu phần dùng tới. */
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike> & {
  isFinal: boolean;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultListLike>;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

/** Số cột của waveform hiển thị khi đang nghe — đủ dày trên card rộng ~530px. */
const WAVE_BARS = 20;

/** Web Speech API trả mã lỗi tiếng Anh — dịch sang câu người dùng hiểu được. */
function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
      return "Bạn cần cho phép truy cập micro trong trình duyệt.";
    case "no-speech":
      return "Không nghe thấy gì. Thử nói gần micro hơn.";
    case "audio-capture":
      return "Không tìm thấy micro trên thiết bị này.";
    case "network":
      return "Mất kết nối khi nhận diện giọng nói.";
    default:
      return "Không nhận diện được giọng nói, thử lại nhé.";
  }
}

type Mode = "photo" | "chat" | "manual";

const MODES: {
  id: Mode;
  label: string;
  desc: string;
  Icon: typeof IconCamera;
}[] = [
  {
    id: "photo",
    label: "Chụp hoá đơn",
    desc: "Camera đọc tổng tiền và món tự động",
    Icon: IconCamera,
  },
  {
    id: "chat",
    label: "Nhập nhanh AI",
    desc: "Gõ một câu, AI tự điền thông tin",
    Icon: IconSparkles,
  },
  {
    id: "manual",
    label: "Nhập tay",
    desc: "Tự điền từng trường thông tin",
    Icon: IconPen,
  },
];

const CHAT_SUGGESTIONS = [
  "Ăn trưa 450k chia đều 3 người",
  "Cà phê 180k, Lan trả, mình với Lan chia đều",
  "Đổ xăng 200k mình ứng",
];

/** SpeechRecognition — API trình duyệt, không phải dependency. Ẩn mic nếu không hỗ trợ. */
function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function AddBill({
  user,
  groups,
}: {
  user: SessionUser;
  groups: Group[];
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  // Chụp hoá đơn
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrItems, setOcrItems] = useState<OcrResult["items"]>([]);
  const [ocrDone, setOcrDone] = useState(false);

  // Nhập nhanh AI
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatExplanation, setChatExplanation] = useState("");
  const [chatDone, setChatDone] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const chatBaseRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Waveform thật theo âm lượng mic khi đang nghe (độc lập với SpeechRecognition)
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => setGroup(resolveGroup(groups)), [groups]);

  const loadMembers = useCallback(async () => {
    if (!group) return;
    try {
      const res = await apiJson<{ members: Member[] }>(
        `/api/groups/${group.id}/members`
      );
      setMembers(res.members);
      setDraft(emptyDraft(res.members, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thành viên.");
    }
  }, [group, user.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function runOcr(file: File) {
    if (!group || !draft) return;
    setError("");
    setSaved("");
    setOcrBusy(true);
    setOcrItems([]);

    try {
      const form = new FormData();
      form.set("groupId", String(group.id));
      form.set("image", file);
      const res = await apiJson<{ result: OcrResult }>("/api/ai/ocr", {
        method: "POST",
        body: form,
      });
      const r = res.result;
      setOcrItems(r.items);
      setDraft({
        ...draft,
        title: r.title,
        category: r.category,
        totalText: String(r.total),
        spentOn: r.spentOn,
        note: r.note,
      });
      setOcrDone(true);
      if (r.total === 0)
        setError(
          "Mình đọc được ảnh nhưng chưa thấy tổng tiền. Bạn nhập tổng tiền bên dưới giúp."
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được hoá đơn.");
    } finally {
      setOcrBusy(false);
    }
  }

  async function runChat() {
    if (!group || !draft || !chatInput.trim()) return;
    const message = chatInput.trim();
    setError("");
    setSaved("");
    setChatBusy(true);

    try {
      const res = await apiJson<{ draft: ChatDraft }>("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId: group.id, message }),
      });
      const d = res.draft;

      const selected: Record<number, boolean> = {};
      const exact: Record<number, string> = {};
      const weights: Record<number, number> = {};
      for (const m of members) {
        selected[m.userId] = false;
        exact[m.userId] = "";
        weights[m.userId] = 1;
      }
      for (const s of d.shares) {
        selected[s.userId] = true;
        exact[s.userId] = String(s.amount);
        weights[s.userId] = s.weight;
      }

      setDraft({
        ...draft,
        title: d.title,
        category: d.category,
        totalText: String(d.total),
        paidBy: d.paidBy,
        spentOn: d.spentOn,
        note: d.note,
        splitMode: d.splitMode,
        selected,
        weights,
        exact,
      });
      setChatExplanation(d.explanation);
      setChatDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không hiểu được câu mô tả.");
    } finally {
      setChatBusy(false);
    }
  }

  function stopWaveform() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    for (const bar of barRefs.current) {
      if (bar) bar.style.height = "4px";
    }
  }

  async function startWaveform() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < barRefs.current.length; i++) {
          const bar = barRefs.current[i];
          if (!bar) continue;
          const level = data[i % data.length] / 255;
          bar.style.height = `${4 + level * 24}px`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Không xin được quyền/không có micro cho waveform — dictation vẫn chạy
      // qua SpeechRecognition riêng, nên bỏ qua lặng lẽ.
    }
  }

  function toggleMic() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    setError("");
    chatBaseRef.current = chatInput ? `${chatInput} ` : "";
    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscriptRef.current += transcript;
        else interim += transcript;
      }
      setChatInput(chatBaseRef.current + finalTranscriptRef.current + interim);
    };
    recognition.onend = () => {
      setListening(false);
      stopWaveform();
    };
    recognition.onerror = (e: SpeechRecognitionErrorEventLike) => {
      setListening(false);
      stopWaveform();
      setError(speechErrorMessage(e.error));
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    void startWaveform();
  }

  useEffect(() => stopWaveform, []);

  function stopListening() {
    recognitionRef.current?.stop();
    stopWaveform();
    setListening(false);
  }

  function resetToStart(msg: string) {
    stopListening();
    setSaved(msg);
    setError("");
    setMode(null);
    setDraft(emptyDraft(members, user.id));
    setOcrItems([]);
    setOcrDone(false);
    setChatInput("");
    setChatExplanation("");
    setChatDone(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToChooser() {
    stopListening();
    setMode(null);
    setError("");
    setOcrItems([]);
    setOcrDone(false);
    setChatExplanation("");
    setChatDone(false);
    setChatInput("");
    setDraft(emptyDraft(members, user.id));
  }

  if (!group || !draft) {
    return (
      <div className="shell">
        <header className="topbar">
          <IconAdd size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
          <span className="brand">Thêm bill</span>
        </header>
        <div className="card card-pad muted">Đang tải…</div>
      </div>
    );
  }

  const showWizard =
    mode === "manual" || (mode === "photo" && ocrDone) || (mode === "chat" && chatDone);

  return (
    <div className="shell">
      <header className="topbar">
        {mode && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={backToChooser}
            aria-label="Quay lại chọn cách thêm bill"
          >
            <IconBack size={ICON_SIZE.md} />
          </button>
        )}
        <IconAdd size={ICON_SIZE.tab} style={{ color: "var(--tint-strong)" }} />
        <span className="brand">Thêm bill</span>
        <span className="spacer" />
        <GroupPicker
          groups={groups}
          current={group}
          onChange={(g) => {
            rememberGroupId(g.id);
            setGroup(g);
          }}
        />
      </header>

      {saved && (
        <div className="card card-pad result-card" role="status" style={{ marginBottom: 16 }}>
          <Mascot name="send" size={96} />
          <p className="empty-title" style={{ margin: 0 }}>Bill đã được thêm</p>
          <p className="muted" style={{ margin: 0 }}>{saved}</p>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <Link href="/nhac-no" className="btn btn-primary">
              Xem công nợ <IconArrowRight size={ICON_SIZE.sm} />
            </Link>
            <button type="button" className="btn" onClick={() => setSaved("")}>
              Thêm bill khác
            </button>
          </div>
        </div>
      )}

      {!saved && !mode && (
        <div className="stack" style={{ gap: 12 }}>
          {MODES.map(({ id, label, desc, Icon }) => (
            <button
              key={id}
              type="button"
              className="chooser-card"
              onClick={() => setMode(id)}
            >
              <span className="chooser-card-icon" aria-hidden="true">
                <Icon size={ICON_SIZE.lg} />
              </span>
              <span className="chooser-card-main">
                <span className="chooser-card-title">{label}</span>
                <span className="faint">{desc}</span>
              </span>
              <IconChevron size={ICON_SIZE.sm} className="entry-chevron" />
            </button>
          ))}
        </div>
      )}

      {!saved && mode === "photo" && !ocrDone && (
        <section className="section">
          {ocrBusy ? (
            <div className="card card-pad empty">
              <IconSpinner size={ICON_SIZE.lg} />
              <p className="muted" style={{ marginTop: 8 }}>Đang đọc hoá đơn…</p>
            </div>
          ) : (
            <CameraCapture onCapture={runOcr} onCancel={backToChooser} />
          )}
        </section>
      )}

      {!saved && mode === "chat" && !chatDone && (
        <section className="section">
          <div className="card card-pad stack">
            <p className="muted" style={{ margin: 0 }}>
              Mô tả bằng một câu, AI tự điền tên bill, số tiền và cách chia.
            </p>

            <div className="chips">
              {CHAT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  onClick={() => setChatInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="compose-bar">
              {listening && (
                <div className="wave-row">
                  <span className="listening-dot" aria-hidden="true" />
                  <div className="wave-viz" aria-hidden="true">
                    {Array.from({ length: WAVE_BARS }, (_, i) => (
                      <div
                        key={i}
                        className="wave-bar"
                        ref={(el) => {
                          barRefs.current[i] = el;
                        }}
                      />
                    ))}
                  </div>
                  <span className="faint tiny">Đang nghe…</span>
                </div>
              )}
              <div className="compose-row">
                <textarea
                  ref={textareaRef}
                  className="compose-textarea"
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!listening) void runChat();
                    }
                  }}
                  placeholder="Ăn trưa 450k chia đều 3 người"
                  aria-label="Mô tả khoản chi"
                />
                <div className="compose-actions">
                  {getSpeechRecognition() && (
                    <button
                      type="button"
                      className={listening ? "btn btn-icon mic-live" : "btn btn-icon"}
                      aria-pressed={listening}
                      aria-label={listening ? "Dừng nghe" : "Nhập bằng giọng nói"}
                      onClick={toggleMic}
                    >
                      {listening ? (
                        <IconStop size={ICON_SIZE.md} />
                      ) : (
                        <IconMic size={ICON_SIZE.md} />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-icon"
                    onClick={() => void runChat()}
                    disabled={chatBusy || listening || !chatInput.trim()}
                    aria-label="Gửi cho AI"
                  >
                    {chatBusy ? <IconSpinner size={ICON_SIZE.md} /> : <IconSend size={ICON_SIZE.md} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="error" style={{ marginBottom: 14 }} role="alert">
          <IconAlert size={ICON_SIZE.sm} />
          <span>{error}</span>
        </p>
      )}

      {!saved && showWizard && (
        <>
          {mode === "photo" && ocrItems.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <p className="section-title" style={{ marginBottom: 6 }}>
                Món đọc được từ hoá đơn
              </p>
              {ocrItems.map((it, i) => (
                <div className="split-row" key={i} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="muted">
                    {it.quantity > 1 ? `${it.quantity}× ` : ""}
                    {it.name}
                  </span>
                  <span className="num">{formatVnd(it.price)}</span>
                </div>
              ))}
              <p className="hint" style={{ marginTop: 8 }}>
                Danh sách món chỉ để bạn đối chiếu. Số tiền chia lấy theo tổng bill.
              </p>
            </div>
          )}

          {mode === "chat" && chatExplanation && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <p className="row" style={{ margin: 0, gap: 6 }}>
                <IconSparkles size={ICON_SIZE.sm} className="entry-chevron" />
                <strong>AI đã hiểu</strong>
              </p>
              <p className="muted" style={{ margin: "4px 0 0" }}>{chatExplanation}</p>
            </div>
          )}

          <BillForm
            groupId={group.id}
            members={members}
            currentUserId={user.id}
            draft={draft}
            setDraft={setDraft}
            source={mode === "photo" ? "ocr" : mode === "chat" ? "chat" : "manual"}
            onSaved={resetToStart}
          />
        </>
      )}
    </div>
  );
}
