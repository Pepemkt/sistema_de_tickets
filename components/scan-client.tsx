"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

/* ── Types ─────────────────────────────────────────────────────────────────── */

type EventStats = {
  eventId: string;
  eventName: string;
  eventScannedCount: number;
};

type ValidateResult =
  | ({ status: "ok"; ticketCode: string; attendeeName: string } & EventStats)
  | ({ status: "already_used"; ticketCode: string; attendedAt: string; attendeeName: string } & EventStats)
  | { status: "error"; message: string };

type PopupState = {
  tone: "success" | "warning" | "error";
  title: string;
  detail: string;
};

/* ── Constants ──────────────────────────────────────────────────────────────── */

const RESULT_POPUP_MS = 2200;

/* ── Keyframes + styles (injected once, no external CSS) ─────────────────── */
const SCAN_STYLES = `
/* ─── Mount stagger ─────────────────────────────────── */
@keyframes sc-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sc-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sc-scale-in {
  from { opacity: 0; transform: scale(0.97) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ─── Count increment flash ─────────────────────────── */
@keyframes sc-count-bump {
  0%   { opacity: 0.5; transform: scale(0.88) translateY(5px); }
  60%  { transform: scale(1.06) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* ─── Pulse dot ─────────────────────────────────────── */
@keyframes sc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}

/* ─── Scan line sweep top→bottom ────────────────────── */
@keyframes sc-laser {
  0%   { top: 8%;  opacity: 0; }
  5%   { opacity: 1; }
  48%  { opacity: 0.85; }
  52%  { top: 88%; opacity: 0.85; }
  96%  { opacity: 0; }
  100% { top: 8%;  opacity: 0; }
}

/* ─── Popup enter ───────────────────────────────────── */
@keyframes sc-popup-in {
  from { opacity: 0; transform: scale(0.96) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes sc-scrim-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ─── Icon draw-ins ─────────────────────────────────── */
@keyframes sc-tick-draw {
  from { stroke-dashoffset: 56; }
  to   { stroke-dashoffset: 0; }
}
@keyframes sc-x-draw {
  from { stroke-dashoffset: 38; opacity: 0; }
  to   { stroke-dashoffset: 0;  opacity: 1; }
}
@keyframes sc-exclaim-pop {
  0%   { opacity: 0; transform: scale(0.6); }
  65%  { transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes sc-exclaim-dot {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.4); }
}

/* ─── Countdown drain ───────────────────────────────── */
@keyframes sc-drain {
  from { width: 100%; }
  to   { width: 0%; }
}

/* ─── Status blink ───────────────────────────────────── */
@keyframes sc-status-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}

/* ─── Applied mount classes ──────────────────────────── */
.sc-hero        { animation: sc-fade-up   0.55s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.04s both; }
.sc-stats       { animation: sc-fade-up   0.55s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.10s both; }
.sc-camera-wrap { animation: sc-scale-in  0.65s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.16s both; }
.sc-manual      { animation: sc-fade-up   0.55s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.22s both; }
.sc-result      { animation: sc-fade-up   0.50s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.28s both; }

.sc-pulse-dot   { animation: sc-pulse 1.8s ease-in-out infinite; }
.sc-processing  { animation: sc-status-blink 1s ease-in-out infinite; }

/* ─── Scan line (light violet/transparent) ──────────── */
.sc-laser {
  position: absolute;
  left: 5%;
  right: 5%;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(109,40,217,0.0) 8%,
    rgba(109,40,217,0.28) 35%,
    rgba(91,33,182,0.30) 50%,
    rgba(109,40,217,0.28) 65%,
    rgba(109,40,217,0.0) 92%,
    transparent 100%
  );
  border-radius: 9999px;
  animation: sc-laser 2.4s ease-in-out infinite;
  pointer-events: none;
  z-index: 10;
}

/* ─── Corner brackets — static violet, no glow pulse ── */
.sc-corner-svg { opacity: 0.75; }

/* ─── Count bump ─────────────────────────────────────── */
.sc-count-bump { animation: sc-count-bump 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ─── Popup ──────────────────────────────────────────── */
.sc-popup-card { animation: sc-popup-in 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.sc-scrim      { animation: sc-scrim-in 0.20s ease both; }

/* ─── Icon animations ────────────────────────────────── */
.sc-tick-path {
  stroke-dasharray: 56;
  stroke-dashoffset: 56;
  animation: sc-tick-draw 0.50s cubic-bezier(0.22,1,0.36,1) 0.16s both;
}
.sc-x-path {
  stroke-dasharray: 38;
  stroke-dashoffset: 38;
  animation: sc-x-draw 0.38s cubic-bezier(0.22,1,0.36,1) 0.14s both;
}
.sc-exclaim-body {
  animation: sc-exclaim-pop 0.42s cubic-bezier(0.34,1.56,0.64,1) 0.10s both;
}
.sc-exclaim-dot-anim {
  animation: sc-exclaim-dot 1.1s ease-in-out 0.55s infinite;
}

/* ─── Countdown drain ────────────────────────────────── */
.sc-drain {
  animation: sc-drain ${RESULT_POPUP_MS}ms linear both;
}

/* Suppress html5-qrcode default UI chrome */
#qr-reader__scan_region { border: none !important; }
#qr-reader__dashboard    { display: none !important; }
#qr-reader video         { border-radius: 0 !important; display: block; }
`;

/* ── Sub-components ─────────────────────────────────────────────────────────── */

/** SVG corner brackets for the scan window — violet, thin, 20px arm */
function ScanCorners({ className = "" }: { className?: string }) {
  const L = 22; // arm length in viewBox units
  const T = 2;  // stroke width
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={`pointer-events-none absolute inset-0 h-full w-full sc-corner-svg ${className}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* Top-left */}
      <polyline
        points={`${T / 2},${L} ${T / 2},${T / 2} ${L},${T / 2}`}
        stroke="var(--brand-violet, #5B21B6)"
        strokeWidth={T}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Top-right */}
      <polyline
        points={`${100 - L},${T / 2} ${100 - T / 2},${T / 2} ${100 - T / 2},${L}`}
        stroke="var(--brand-violet, #5B21B6)"
        strokeWidth={T}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Bottom-left */}
      <polyline
        points={`${T / 2},${100 - L} ${T / 2},${100 - T / 2} ${L},${100 - T / 2}`}
        stroke="var(--brand-violet, #5B21B6)"
        strokeWidth={T}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Bottom-right */}
      <polyline
        points={`${100 - L},${100 - T / 2} ${100 - T / 2},${100 - T / 2} ${100 - T / 2},${100 - L}`}
        stroke="var(--brand-violet, #5B21B6)"
        strokeWidth={T}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Animated SVG icon for the popup — flat colored circle + white SVG */
function PopupIcon({ tone }: { tone: "success" | "warning" | "error" }) {
  if (tone === "success") {
    return (
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 96,
          height: 96,
          background: "#1FAE4A",
          flexShrink: 0,
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            className="sc-tick-path"
            d="M4 12.5l5.5 5.5L20 6"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (tone === "warning") {
    return (
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 96,
          height: 96,
          background: "#F59E0B",
          flexShrink: 0,
        }}
      >
        <div className="sc-exclaim-body flex flex-col items-center gap-1" aria-hidden="true">
          <div style={{ width: 8, height: 24, background: "white", borderRadius: 4 }} />
          <div
            className="sc-exclaim-dot-anim"
            style={{ width: 8, height: 8, background: "white", borderRadius: 9999 }}
          />
        </div>
      </div>
    );
  }

  /* error */
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: 96,
        height: 96,
        background: "#E11D48",
        flexShrink: 0,
      }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <line
          className="sc-x-path"
          x1="6" y1="6" x2="18" y2="18"
          stroke="white" strokeWidth="2.5" strokeLinecap="round"
        />
        <line
          className="sc-x-path"
          x1="18" y1="6" x2="6" y2="18"
          stroke="white" strokeWidth="2.5" strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export function ScanClient() {
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [manualPayload, setManualPayload] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const processingRef = useRef(false);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateRef = useRef<(payload: string) => void>(() => undefined);

  /* ── Timer helpers ────────────────────────────────────────────────────────── */

  function clearPopupTimer() {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
  }

  function unlockScanner() {
    processingRef.current = false;
    setIsLocked(false);
  }

  function closePopupAndUnlock() {
    clearPopupTimer();
    setPopup(null);
    unlockScanner();
  }

  function schedulePopupDismiss() {
    clearPopupTimer();
    popupTimeoutRef.current = setTimeout(() => {
      setPopup(null);
      unlockScanner();
      popupTimeoutRef.current = null;
    }, RESULT_POPUP_MS);
  }

  /* ── Validate ─────────────────────────────────────────────────────────────── */

  async function validate(payload: string) {
    if (processingRef.current || !payload.trim()) return;
    processingRef.current = true;
    setIsLocked(true);

    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const data = (await res.json()) as ValidateResult;
      setResult(data);

      if (data.status === "ok") {
        setEventStats({
          eventId: data.eventId,
          eventName: data.eventName,
          eventScannedCount: data.eventScannedCount,
        });
        setPopup({
          tone: "success",
          title: "Asistencia registrada",
          detail: `${data.attendeeName} (${data.ticketCode})`,
        });
        schedulePopupDismiss();
        return;
      }

      if (data.status === "already_used") {
        setEventStats({
          eventId: data.eventId,
          eventName: data.eventName,
          eventScannedCount: data.eventScannedCount,
        });
        setPopup({
          tone: "warning",
          title: "QR ya utilizado",
          detail: `${data.attendeeName} (${data.ticketCode}) - ${new Date(data.attendedAt).toLocaleString("es-AR")}`,
        });
        schedulePopupDismiss();
        return;
      }

      setPopup({
        tone: "error",
        title: "No se pudo validar",
        detail: data.message,
      });
      schedulePopupDismiss();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo validar";
      const nextResult: ValidateResult = { status: "error", message };
      setResult(nextResult);
      setPopup({
        tone: "error",
        title: "Error de validacion",
        detail: message,
      });
      schedulePopupDismiss();
    }
  }

  validateRef.current = (payload: string) => {
    void validate(payload);
  };

  /* ── Camera init ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    let mounted = true;
    let scanner: Html5Qrcode | null = null;
    let running = false;

    (async () => {
      try {
        if (!window.isSecureContext && window.location.hostname !== "localhost") {
          setCameraError("La camara requiere HTTPS (o localhost).");
          return;
        }

        const html5QrcodeModule = await import("html5-qrcode");
        if (!mounted) return;

        const scannerInstance = new html5QrcodeModule.Html5Qrcode("qr-reader");
        scanner = scannerInstance;

        const onSuccess = (decodedText: string) => {
          validateRef.current(decodedText);
        };

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
        };

        try {
          await scannerInstance.start({ facingMode: "environment" }, config, onSuccess, undefined);
          running = true;
          if (mounted) {
            setCameraReady(true);
            setCameraError(null);
          }
          return;
        } catch {
          const cameras = await html5QrcodeModule.Html5Qrcode.getCameras();
          if (!cameras.length) {
            throw new Error("No se detectaron camaras disponibles.");
          }
          await scannerInstance.start(cameras[0].id, config, onSuccess, undefined);
          running = true;
          if (mounted) {
            setCameraReady(true);
            setCameraError(null);
          }
        }
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "No se pudo iniciar la camara.";
        setCameraReady(false);
        setCameraError(message);
      }
    })();

    return () => {
      mounted = false;
      if (running && scanner) {
        void scanner.stop().catch(() => null);
      }
      if (scanner) {
        try {
          scanner.clear();
        } catch {
          // Ignore cleanup errors on unmount.
        }
      }
    };
  }, []);

  /* ── Cleanup popup timer on unmount ──────────────────────────────────────── */

  useEffect(() => {
    return () => {
      clearPopupTimer();
      processingRef.current = false;
    };
  }, []);

  /* ── Derived display state ────────────────────────────────────────────────── */

  const statusLabel = isLocked
    ? "Procesando..."
    : cameraError
      ? "Error de camara"
      : cameraReady
        ? "Listo para escanear"
        : "Iniciando camara...";

  const statusColor = isLocked
    ? "var(--clr-warning-500, #F59E0B)"
    : cameraError
      ? "var(--clr-danger-500, #E11D48)"
      : cameraReady
        ? "var(--clr-success-500, #1FAE4A)"
        : "var(--brand-violet, #5B21B6)";

  const statusDotClass = isLocked
    ? "sc-processing"
    : cameraReady && !cameraError
      ? "sc-pulse-dot"
      : "";

  /* ── JSX ──────────────────────────────────────────────────────────────────── */

  return (
    <>
      <style>{SCAN_STYLES}</style>

      {/* ── LIGHT PAGE SHELL ────────────────────────────────────────────────── */}
      <div
        className="min-h-screen"
        style={{ background: "var(--bg-page, #F7F7FB)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">

          {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
          <header className="sc-hero mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                {/* Eyebrow */}
                <p
                  className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "var(--text-muted, #7A7E99)" }}
                >
                  Check-in
                </p>
                {/* Title */}
                <h1
                  className="font-display font-extrabold leading-tight tracking-tight"
                  style={{
                    fontFamily: "var(--font-display, 'Poppins', sans-serif)",
                    fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
                    color: "var(--text-primary, #15162B)",
                  }}
                >
                  Control de ingreso
                </h1>
                {/* Sub — event name + counter, muted */}
                {eventStats ? (
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: "var(--text-muted, #7A7E99)" }}
                  >
                    {eventStats.eventName}
                    <span className="mx-1.5 opacity-40">·</span>
                    <span
                      key={eventStats.eventScannedCount}
                      className="sc-count-bump inline-block tabular-nums font-semibold"
                      style={{ color: "var(--text-secondary, #4B4F6B)" }}
                    >
                      {eventStats.eventScannedCount} escaneados
                    </span>
                  </p>
                ) : (
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: "var(--text-muted, #7A7E99)" }}
                  >
                    Sin evento activo — esperando primer escaneo
                  </p>
                )}
              </div>

              {/* Operator pill — quiet, right side */}
              <div
                className="mt-1 flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5"
                style={{
                  borderColor: "var(--border-soft, #E5E7EF)",
                  background: "var(--bg-surface, #FFFFFF)",
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--grad-hero, linear-gradient(135deg,#6D28D9,#EC4899))" }}
                  aria-hidden="true"
                >
                  OP
                </div>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--text-secondary, #4B4F6B)" }}
                >
                  Operador
                </span>
              </div>
            </div>
          </header>

          {/* ── STATS STRIP ─────────────────────────────────────────────────── */}
          <div className="sc-stats mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
            {/* Evento actual */}
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: "var(--border-soft, #E5E7EF)",
                background: "var(--bg-surface, #FFFFFF)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted, #7A7E99)" }}
              >
                Evento actual
              </p>
              <p
                className="mt-0.5 truncate text-[13px] font-semibold"
                style={{ color: "var(--text-primary, #15162B)" }}
              >
                {eventStats?.eventName ?? "—"}
              </p>
            </div>

            {/* Asistentes escaneados */}
            <div
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: "var(--border-soft, #E5E7EF)",
                background: "var(--bg-surface, #FFFFFF)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted, #7A7E99)" }}
              >
                Asistentes escaneados
              </p>
              <p
                key={eventStats?.eventScannedCount ?? "none"}
                className="sc-count-bump mt-0.5 font-display font-extrabold tabular-nums leading-none"
                style={{
                  fontFamily: "var(--font-display, 'Poppins', sans-serif)",
                  fontSize: "clamp(1.6rem, 4vw, 2rem)",
                  color: "var(--text-primary, #15162B)",
                  letterSpacing: "-0.03em",
                }}
              >
                {eventStats?.eventScannedCount ?? 0}
              </p>
            </div>
          </div>

          {/* ── MAIN GRID ────────────────────────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

            {/* ── LEFT: CAMERA FRAME ──────────────────────────────────────────── */}
            <div className="sc-camera-wrap">
              <div
                className="flex flex-col items-center gap-4 rounded-xl border p-6"
                style={{
                  borderColor: "var(--border-soft, #E5E7EF)",
                  background: "var(--bg-surface, #FFFFFF)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Status row above camera */}
                <div className="flex w-full items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`}
                    style={{ background: statusColor }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: statusColor }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Camera viewport square */}
                <div
                  className="relative w-full overflow-hidden rounded-lg"
                  style={{
                    maxWidth: 480,
                    aspectRatio: "1 / 1",
                    background: "#E8EAF0",
                    border: "1.5px solid var(--border-soft, #E5E7EF)",
                  }}
                >
                  {/* html5-qrcode mount target — MUST keep id="qr-reader" */}
                  <div id="qr-reader" className="h-full w-full" />

                  {/* Overlays — only when no error */}
                  {!cameraError && (
                    <>
                      {/* Corner bracket markers */}
                      <div className="pointer-events-none absolute inset-[10%]" aria-hidden="true">
                        <ScanCorners />
                      </div>

                      {/* Scan line — subtle violet, sweeps top→bottom */}
                      {cameraReady && !isLocked && (
                        <div className="sc-laser" aria-hidden="true" />
                      )}

                      {/* Procesando pill — top-center when locked */}
                      {isLocked && (
                        <div
                          className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2"
                          aria-hidden="true"
                        >
                          <div
                            className="flex items-center gap-1.5 rounded-full px-3 py-1"
                            style={{
                              background: "rgba(245,158,11,0.12)",
                              border: "1px solid rgba(245,158,11,0.30)",
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full sc-processing"
                              style={{ background: "var(--clr-warning-500, #F59E0B)" }}
                              aria-hidden="true"
                            />
                            <span
                              className="text-[11px] font-bold uppercase tracking-[0.10em]"
                              style={{ color: "var(--clr-warning-500, #F59E0B)" }}
                            >
                              Procesando...
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Camera initialising */}
                      {!cameraReady && !isLocked && (
                        <div
                          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
                          aria-hidden="true"
                        >
                          <svg
                            className="h-8 w-8 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                            style={{ color: "var(--brand-violet, #5B21B6)", opacity: 0.5 }}
                          >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span
                            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                            style={{ color: "var(--text-muted, #7A7E99)" }}
                          >
                            Iniciando camara...
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Camera error state — inline, calm */}
                  {cameraError && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
                      style={{ background: "var(--bg-sunken, #F3F4F8)" }}
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{
                          background: "rgba(225,29,72,0.08)",
                          border: "1px solid rgba(225,29,72,0.20)",
                        }}
                      >
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="var(--clr-danger-500, #E11D48)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      </div>
                      <div>
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: "var(--clr-danger-500, #E11D48)" }}
                        >
                          Camara no disponible
                        </p>
                        <p
                          className="mt-1.5 font-mono text-[11px] leading-relaxed"
                          style={{ color: "var(--text-muted, #7A7E99)", letterSpacing: "0.03em" }}
                        >
                          {cameraError}
                        </p>
                        <p
                          className="mt-2 text-[11px]"
                          style={{ color: "var(--text-muted, #7A7E99)" }}
                        >
                          Usá la validacion manual →
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hint below camera */}
                <p
                  className="text-center text-[11px]"
                  style={{ color: "var(--text-muted, #7A7E99)" }}
                >
                  Apuntá el código QR del ticket al recuadro
                </p>
              </div>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">

              {/* ── MANUAL VALIDATION ──────────────────────────────────────────── */}
              <div
                className="sc-manual rounded-xl border"
                style={{
                  borderColor: "var(--border-soft, #E5E7EF)",
                  background: "var(--bg-surface, #FFFFFF)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                {/* Panel header */}
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border-soft, #E5E7EF)" }}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--text-muted, #7A7E99)" }}
                  >
                    Validación manual
                  </p>
                </div>

                {/* Input row */}
                <div className="px-4 py-4">
                  <div className="flex gap-2">
                    <input
                      value={manualPayload}
                      onChange={(event) => setManualPayload(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !isLocked) void validate(manualPayload);
                      }}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-all duration-150"
                      placeholder="TICKET:CODIGO:FIRMA"
                      style={{
                        background: "var(--bg-sunken, #F3F4F8)",
                        border: "1.5px solid var(--border-soft, #E5E7EF)",
                        color: "var(--text-primary, #15162B)",
                        letterSpacing: "0.04em",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--brand-violet, #5B21B6)";
                        e.currentTarget.style.boxShadow = "var(--shadow-focus, 0 0 0 3px rgba(91,33,182,0.22))";
                        e.currentTarget.style.background = "var(--bg-surface, #FFFFFF)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-soft, #E5E7EF)";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.background = "var(--bg-sunken, #F3F4F8)";
                      }}
                      disabled={isLocked}
                    />
                    <button
                      onClick={() => void validate(manualPayload)}
                      disabled={isLocked}
                      className="shrink-0 rounded-lg px-4 py-2 text-[12px] font-bold text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: isLocked
                          ? "var(--border-strong, #D1D5E0)"
                          : "var(--grad-hero, linear-gradient(135deg,#6D28D9,#8B5CF6,#EC4899))",
                        boxShadow: isLocked ? "none" : "var(--shadow-glow-accent)",
                      }}
                    >
                      Validar
                    </button>
                  </div>
                </div>
              </div>

              {/* ── LAST RESULT ─────────────────────────────────────────────────── */}
              <div
                className="sc-result rounded-xl border"
                style={{
                  borderColor: "var(--border-soft, #E5E7EF)",
                  background: "var(--bg-surface, #FFFFFF)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border-soft, #E5E7EF)" }}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--text-muted, #7A7E99)" }}
                  >
                    Último resultado
                  </p>
                </div>

                <div className="px-4 py-4">
                  {!result && (
                    <p
                      className="font-mono text-[11px]"
                      style={{ color: "var(--text-muted, #7A7E99)", letterSpacing: "0.04em" }}
                    >
                      — sin validaciones en esta sesion —
                    </p>
                  )}

                  {result?.status === "ok" && (
                    <div
                      className="rounded-lg px-3 py-3"
                      style={{
                        borderLeft: "2px solid var(--clr-success-500, #1FAE4A)",
                        background: "rgba(31,174,74,0.06)",
                      }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
                          style={{
                            background: "rgba(31,174,74,0.14)",
                            color: "var(--clr-success-500, #1FAE4A)",
                          }}
                        >
                          OK
                        </span>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: "var(--clr-success-700, #117A30)", letterSpacing: "0.06em" }}
                        >
                          {result.ticketCode}
                        </span>
                      </div>
                      <p
                        className="text-[13px] font-bold"
                        style={{ color: "var(--text-primary, #15162B)" }}
                      >
                        {result.attendeeName}
                      </p>
                      <p
                        className="sr-only"
                      >
                        OK. Ticket {result.ticketCode} de {result.attendeeName} para {result.eventName}. Escaneados: {result.eventScannedCount}.
                      </p>
                    </div>
                  )}

                  {result?.status === "already_used" && (
                    <div
                      className="rounded-lg px-3 py-3"
                      style={{
                        borderLeft: "2px solid var(--clr-warning-500, #F59E0B)",
                        background: "rgba(245,158,11,0.06)",
                      }}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
                          style={{
                            background: "rgba(245,158,11,0.14)",
                            color: "var(--clr-warning-700, #9B5F17)",
                          }}
                        >
                          Ya usado
                        </span>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: "var(--clr-warning-700, #9B5F17)", letterSpacing: "0.06em" }}
                        >
                          {result.ticketCode}
                        </span>
                      </div>
                      <p
                        className="text-[13px] font-bold"
                        style={{ color: "var(--text-primary, #15162B)" }}
                      >
                        {result.attendeeName}
                      </p>
                      <p
                        className="mt-0.5 text-[11px]"
                        style={{ color: "var(--text-secondary, #4B4F6B)" }}
                      >
                        {new Date(result.attendedAt).toLocaleString("es-AR")}
                      </p>
                      <p className="sr-only">
                        Ya usado. Ticket {result.ticketCode} ({result.attendeeName}) validado en {new Date(result.attendedAt).toLocaleString("es-AR")}. Escaneados: {result.eventScannedCount}.
                      </p>
                    </div>
                  )}

                  {result?.status === "error" && (
                    <div
                      className="rounded-lg px-3 py-3"
                      style={{
                        borderLeft: "2px solid var(--clr-danger-500, #E11D48)",
                        background: "rgba(225,29,72,0.05)",
                      }}
                    >
                      <div className="mb-1">
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.10em]"
                          style={{
                            background: "rgba(225,29,72,0.12)",
                            color: "var(--clr-danger-700, #9F1239)",
                          }}
                        >
                          Error
                        </span>
                      </div>
                      <p
                        className="font-mono text-[11px] leading-relaxed"
                        style={{ color: "var(--text-secondary, #4B4F6B)", letterSpacing: "0.03em" }}
                      >
                        {result.message}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Waiting placeholder when no event yet */}
              {!eventStats && (
                <div
                  className="sc-result rounded-xl border border-dashed px-4 py-4 text-center"
                  style={{ borderColor: "var(--border-soft, #E5E7EF)" }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted, #7A7E99)" }}
                  >
                    Esperando primer escaneo para identificar el evento...
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── RESULT POPUP ──────────────────────────────────────────────────────── */}
      {popup && (
        <div
          className="sc-scrim fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          style={{
            background: "rgba(15,16,43,0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            className="sc-popup-card relative w-full max-w-lg overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-surface, #FFFFFF)",
              border: "1px solid var(--border-soft, #E5E7EF)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closePopupAndUnlock}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150"
              style={{
                background: "var(--bg-sunken, #F3F4F8)",
                border: "1px solid var(--border-soft, #E5E7EF)",
                color: "var(--text-muted, #7A7E99)",
              }}
              aria-label="Cerrar popup"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Main content */}
            <div className="flex flex-col items-center px-8 pb-0 pt-10 text-center">
              {/* Animated icon */}
              <PopupIcon tone={popup.tone} />

              {/* Title */}
              <p
                className="mt-6 font-extrabold leading-tight tracking-tight"
                style={{
                  fontFamily: "var(--font-display, 'Poppins', sans-serif)",
                  fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                  color: "var(--text-primary, #15162B)",
                }}
              >
                {popup.title}
              </p>

              {/* Detail */}
              <p
                className="mt-3 max-w-sm font-mono text-[13px] leading-relaxed"
                style={{ color: "var(--text-secondary, #4B4F6B)", letterSpacing: "0.03em" }}
              >
                {popup.detail}
              </p>

              {/* CTA button */}
              <button
                type="button"
                onClick={closePopupAndUnlock}
                className="mt-7 w-full max-w-xs rounded-full py-3 font-bold text-white transition-all duration-150 hover:-translate-y-0.5"
                style={{
                  fontFamily: "var(--font-display, 'Poppins', sans-serif)",
                  fontSize: "15px",
                  background:
                    popup.tone === "success"
                      ? "var(--clr-success-500, #1FAE4A)"
                      : popup.tone === "warning"
                        ? "var(--clr-warning-500, #F59E0B)"
                        : "var(--clr-danger-500, #E11D48)",
                  boxShadow:
                    popup.tone === "success"
                      ? "0 6px 20px rgba(31,174,74,0.30)"
                      : popup.tone === "warning"
                        ? "0 6px 20px rgba(245,158,11,0.30)"
                        : "0 6px 20px rgba(225,29,72,0.30)",
                }}
              >
                Continuar escaneo
              </button>

              {/* Countdown drain bar */}
              <div
                className="mt-6 h-[3px] w-full overflow-hidden rounded-full"
                style={{ background: "var(--border-soft, #E5E7EF)" }}
              >
                <div
                  key={popup.title}
                  className="sc-drain h-full rounded-full"
                  style={{
                    background:
                      popup.tone === "success"
                        ? "var(--clr-success-500, #1FAE4A)"
                        : popup.tone === "warning"
                          ? "var(--clr-warning-500, #F59E0B)"
                          : "var(--clr-danger-500, #E11D48)",
                  }}
                />
              </div>
            </div>

            {/* Bottom spacing */}
            <div className="h-6" />
          </div>
        </div>
      )}
    </>
  );
}
