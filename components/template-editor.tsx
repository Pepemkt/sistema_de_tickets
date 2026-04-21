"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { type TicketLayout, type TicketTemplate, ticketTemplatePresets } from "@/lib/ticket-template";

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES — injected once, scoped with te- prefix
───────────────────────────────────────────────────────────────────────────── */
const EDITOR_STYLES = `
@keyframes te-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes te-section-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes te-preview-in {
  from { opacity: 0; transform: translateX(18px) scale(0.98); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes te-pulse-ring {
  0%   { transform: scale(1); opacity: 0.7; }
  60%  { transform: scale(1.18); opacity: 0; }
  100% { transform: scale(1.18); opacity: 0; }
}
@keyframes te-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Layout */
.te-panel   { animation: te-fade-up    0.50s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.04s both; }
.te-preview { animation: te-preview-in 0.52s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.08s both; }

/* Staggered sections */
.te-s1 { animation: te-section-in 0.44s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.10s both; }
.te-s2 { animation: te-section-in 0.44s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.16s both; }
.te-s3 { animation: te-section-in 0.44s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.22s both; }
.te-s4 { animation: te-section-in 0.44s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.28s both; }
.te-s5 { animation: te-section-in 0.44s var(--ease-tactile, cubic-bezier(0.22,1,0.36,1)) 0.34s both; }

/* Section card base */
.te-section {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: var(--bg-surface);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.te-section:hover {
  border-color: rgba(91,33,182,0.16);
  box-shadow: 0 2px 16px rgba(21,22,43,0.06);
}
.te-section-inner {
  padding: 16px 18px 18px;
}

/* Section accent stripe — removed per v2 voice (no ::before stripes) */

/* Section heading */
.te-section-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.te-section-label svg {
  flex-shrink: 0;
  opacity: 0.6;
}

/* Color swatch pill */
.te-color-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 7px;
  border-radius: 9999px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
}
.te-color-pill:hover {
  border-color: rgba(91,33,182,0.22);
  background: var(--bg-surface);
}
.te-color-pill input[type="color"] {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.55);
  box-shadow: 0 0 0 1.5px rgba(0,0,0,0.12);
  padding: 0;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
  outline: none;
}
.te-color-pill input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; border-radius: 50%; }
.te-color-pill input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
.te-color-value {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

/* Slider with live value */
.te-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.te-slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  border-radius: 9999px;
  background: var(--bg-sunken);
  outline: none;
  cursor: pointer;
  accent-color: var(--brand-violet);
}
.te-slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--brand-violet);
  border: 2.5px solid #fff;
  box-shadow: 0 1px 6px rgba(91,33,182,0.35);
  cursor: pointer;
}
.te-slider-val {
  min-width: 44px;
  text-align: right;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  background: var(--bg-sunken);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 3px 7px;
}

/* Preset layout cards */
.te-preset-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border-soft);
  background: var(--bg-sunken);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.te-preset-card:hover {
  border-color: rgba(91,33,182,0.25);
  background: var(--bg-surface);
  box-shadow: 0 2px 10px rgba(21,22,43,0.07);
  transform: translateY(-1px);
}
.te-preset-card.te-preset-active {
  border-color: var(--brand-violet);
  background: rgba(91,33,182,0.04);
  box-shadow: 0 0 0 3px rgba(91,33,182,0.08), 0 2px 10px rgba(91,33,182,0.12);
}
.te-preset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--border-soft);
  background: var(--bg-surface);
  color: var(--brand-violet);
  flex-shrink: 0;
  transition: background 0.14s ease;
}
.te-preset-active .te-preset-icon {
  background: rgba(91,33,182,0.12);
  border-color: rgba(91,33,182,0.28);
}

/* Save button — hero grad pill */
.te-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 22px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #fff;
  background: var(--grad-hero);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 18px rgba(91,33,182,0.28), 0 1px 4px rgba(91,33,182,0.18);
}
.te-save-btn:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 6px 22px rgba(91,33,182,0.34), 0 1px 4px rgba(91,33,182,0.20);
}
.te-save-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(91,33,182,0.22);
}
.te-save-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

/* Cancel link pill */
.te-cancel-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 9999px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-sunken);
  border: 1px solid var(--border-soft);
  text-decoration: none;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}
.te-cancel-pill:hover {
  background: var(--bg-surface);
  border-color: rgba(91,33,182,0.2);
  color: var(--text-primary);
}

/* Message pill — success / error */
.te-msg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.te-msg-ok    { background: rgba(34,197,94,0.09); color: #15803d; border: 1px solid rgba(34,197,94,0.22); }
.te-msg-err   { background: rgba(239,68,68,0.08); color: #b91c1c; border: 1px solid rgba(239,68,68,0.20); }

/* Preview panel */
.te-preview-panel {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--border-soft);
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}
.te-preview-header {
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* Loading shimmer for preview — uses bg-sunken only, no gradient animation */
.te-shimmer {
  background: var(--bg-sunken);
}

/* Spinner */
.te-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(91,33,182,0.18);
  border-top-color: var(--brand-violet);
  border-radius: 50%;
  animation: te-spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* Crop frame */
.te-crop-frame {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  border: 1.5px dashed var(--border-soft);
  background: var(--bg-sunken);
  touch-action: none;
  user-select: none;
  transition: border-color 0.14s ease;
}
.te-crop-frame.te-crop-active {
  border-color: rgba(91,33,182,0.3);
  border-style: solid;
  cursor: grab;
}
.te-crop-frame.te-crop-active:active {
  cursor: grabbing;
}
.te-crop-overlay-line {
  pointer-events: none;
  position: absolute;
  background: rgba(255,255,255,0.35);
}

/* Image upload input styled */
.te-file-input {
  display: block;
  width: 100%;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}
.te-file-input::file-selector-button {
  margin-right: 10px;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease;
}
.te-file-input::file-selector-button:hover {
  background: var(--bg-surface);
  border-color: rgba(91,33,182,0.22);
}

/* Small ghost button */
.te-ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-sunken);
  border: 1px solid var(--border-soft);
  cursor: pointer;
  transition: background 0.13s ease, border-color 0.13s ease, color 0.13s ease;
}
.te-ghost-btn:hover {
  background: var(--bg-surface);
  border-color: rgba(91,33,182,0.2);
  color: var(--text-primary);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
type Props = {
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  ticketTypeName: string;
  initialTemplate: TicketTemplate;
};

type CropFieldProps = {
  title: string;
  hint: string;
  imageDataUrl: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
  aspectRatio: number;
  onUpload: (file: File | null) => Promise<void>;
  onChange: (patch: { zoom?: number; offsetX?: number; offsetY?: number }) => void;
  onReset: () => void;
  onClear: () => void;
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS — unchanged logic
───────────────────────────────────────────────────────────────────────────── */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

function toCssBackgroundPositionX(offsetX: number) {
  return `${(offsetX + 100) / 2}%`;
}

function toCssBackgroundPositionY(offsetY: number) {
  return `${(offsetY + 100) / 2}%`;
}

function getLayoutDimensions(layout: TicketLayout): [number, number] {
  if (layout === "VERTICAL") return [430, 760];
  if (layout === "VERTICAL_COMPACT") return [390, 620];
  return [842, 420];
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICON HELPERS — inline SVGs for section headers
───────────────────────────────────────────────────────────────────────────── */
function IconLayout() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function IconText() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   IMAGE CROP FIELD — unchanged logic, restyled
───────────────────────────────────────────────────────────────────────────── */
function ImageCropField(props: CropFieldProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!props.imageDataUrl) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: props.offsetX,
      startOffsetY: props.offsetY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const frame = frameRef.current;
    if (!frame) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;

    props.onChange({
      offsetX: clamp(dragRef.current.startOffsetX + (deltaX / frame.clientWidth) * 220, -100, 100),
      offsetY: clamp(dragRef.current.startOffsetY - (deltaY / frame.clientHeight) * 220, -100, 100)
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="space-y-3">
      {/* Title + hint */}
      <div>
        <p className="text-[12.5px] font-semibold text-primary">{props.title}</p>
        <p className="mt-0.5 text-[11.5px] text-secondary">{props.hint}</p>
      </div>

      {/* Upload input */}
      <input
        className="te-file-input"
        type="file"
        accept="image/*"
        onChange={(event) => void props.onUpload(event.target.files?.[0] ?? null)}
      />

      {/* Crop frame */}
      <div
        ref={frameRef}
        className={`te-crop-frame ${props.imageDataUrl ? "te-crop-active" : ""}`}
        style={{ aspectRatio: props.aspectRatio }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {props.imageDataUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${props.imageDataUrl})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${props.zoom * 100}%`,
              backgroundPosition: `${toCssBackgroundPositionX(props.offsetX)} ${toCssBackgroundPositionY(props.offsetY)}`
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <svg className="h-7 w-7 text-muted opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-[11px] text-muted">Sin imagen cargada</p>
          </div>
        )}

        {/* Crop guides */}
        <div className="te-crop-overlay-line" style={{ inset: 0, border: "1px solid rgba(255,255,255,0.5)" }} />
        <div className="te-crop-overlay-line" style={{ left: "50%", top: 0, width: "1px", height: "100%", transform: "translateX(-50%)" }} />
        <div className="te-crop-overlay-line" style={{ top: "50%", left: 0, height: "1px", width: "100%", transform: "translateY(-50%)" }} />
        {/* Rule of thirds guides */}
        <div className="te-crop-overlay-line" style={{ left: "33.33%", top: 0, width: "1px", height: "100%", opacity: 0.2 }} />
        <div className="te-crop-overlay-line" style={{ left: "66.66%", top: 0, width: "1px", height: "100%", opacity: 0.2 }} />
        <div className="te-crop-overlay-line" style={{ top: "33.33%", left: 0, height: "1px", width: "100%", opacity: 0.2 }} />
        <div className="te-crop-overlay-line" style={{ top: "66.66%", left: 0, height: "1px", width: "100%", opacity: 0.2 }} />
      </div>

      {/* Zoom + offsets */}
      <div className="space-y-2.5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Zoom</span>
          <div className="te-slider-row">
            <input
              type="range"
              min={100}
              max={300}
              step={1}
              value={Math.round(props.zoom * 100)}
              onChange={(event) => props.onChange({ zoom: Number(event.target.value) / 100 })}
            />
            <span className="te-slider-val">{Math.round(props.zoom * 100)}%</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Pos X</span>
            <div className="te-slider-row">
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={props.offsetX}
                onChange={(event) => props.onChange({ offsetX: Number(event.target.value) })}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Pos Y</span>
            <div className="te-slider-row">
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={props.offsetY}
                onChange={(event) => props.onChange({ offsetY: Number(event.target.value) })}
              />
            </div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="te-ghost-btn" onClick={props.onReset}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Recentrar
        </button>
        <button type="button" className="te-ghost-btn" onClick={props.onClear}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Quitar imagen
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LAYOUT ICON — tiny ticket shape per layout
───────────────────────────────────────────────────────────────────────────── */
function LayoutIcon({ layout }: { layout: string }) {
  if (layout === "HORIZONTAL") {
    return (
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="0.75" y="0.75" width="12.5" height="8.5" rx="1.5" />
        <line x1="9.5" y1="0.75" x2="9.5" y2="9.25" strokeDasharray="1.5 1.5" />
      </svg>
    );
  }
  if (layout === "VERTICAL_COMPACT") {
    return (
      <svg width="9" height="13" viewBox="0 0 9 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="0.75" y="0.75" width="7.5" height="11.5" rx="1.5" />
        <line x1="0.75" y1="9" x2="8.25" y2="9" strokeDasharray="1.5 1.5" />
      </svg>
    );
  }
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="0.75" y="0.75" width="7.5" height="12.5" rx="1.5" />
      <line x1="0.75" y1="10" x2="8.25" y2="10" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TEMPLATE EDITOR
───────────────────────────────────────────────────────────────────────────── */
export function TemplateEditor(props: Props) {
  const [formData, setFormData] = useState<TicketTemplate>(props.initialTemplate);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewUrlRef = useRef<string | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const isHorizontal = formData.layout === "HORIZONTAL";
  const isCompact = formData.layout === "VERTICAL_COMPACT";
  const overlayOpacity = formData.backgroundOverlayOpacity ?? 0.82;
  const backgroundZoom = formData.backgroundImageZoom ?? 1;
  const backgroundOffsetX = formData.backgroundImageOffsetX ?? 0;
  const backgroundOffsetY = formData.backgroundImageOffsetY ?? 0;
  const logoZoom = formData.logoImageZoom ?? 1;
  const logoOffsetX = formData.logoImageOffsetX ?? 0;
  const logoOffsetY = formData.logoImageOffsetY ?? 0;

  const previewHeightClass = useMemo(() => {
    if (formData.layout === "HORIZONTAL") return "h-[460px]";
    if (formData.layout === "VERTICAL_COMPACT") return "h-[720px]";
    return "h-[860px]";
  }, [formData.layout]);

  const [layoutWidth, layoutHeight] = getLayoutDimensions(formData.layout);
  const backgroundAspect = layoutWidth / layoutHeight;

  const layoutLabel = isHorizontal
    ? "Horizontal clásico"
    : isCompact
      ? "Vertical compacto"
      : "Vertical mobile";

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const res = await fetch("/api/admin/events/template/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: props.eventName,
            venue: props.venue,
            startsAt: props.startsAt,
            ticketTypeName: props.ticketTypeName,
            template: formData
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorBody.error ?? "No se pudo actualizar la vista previa");
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = objectUrl;
        setPreviewPdfUrl(objectUrl);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewError(error instanceof Error ? error.message : "No se pudo cargar el preview PDF");
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, [formData, props.eventName, props.venue, props.startsAt, props.ticketTypeName]);

  async function onUploadImage(type: "backgroundImageDataUrl" | "logoImageDataUrl", file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Selecciona un archivo de imagen válido");
      setMessageOk(false);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((current) => {
        if (type === "backgroundImageDataUrl") {
          return {
            ...current,
            backgroundImageDataUrl: dataUrl,
            backgroundImageZoom: 1,
            backgroundImageOffsetX: 0,
            backgroundImageOffsetY: 0
          };
        }

        return {
          ...current,
          logoImageDataUrl: dataUrl,
          logoImageZoom: 1,
          logoImageOffsetX: 0,
          logoImageOffsetY: 0
        };
      });
    } catch {
      setMessage("No se pudo cargar la imagen");
      setMessageOk(false);
    }
  }

  function applyPreset(layout: TicketLayout) {
    const preset = ticketTemplatePresets.find((item) => item.id === layout);
    if (!preset) return;

    setFormData((current) => ({
      ...current,
      ...preset.template
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch(`/api/admin/events/${props.eventId}/template`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo guardar la plantilla");
      setMessageOk(false);
      return;
    }

    setMessage("Plantilla actualizada correctamente");
    setMessageOk(true);
  }

  return (
    <>
      <style>{EDITOR_STYLES}</style>

      <div className="grid gap-5 xl:grid-cols-[480px_1fr]">

        {/* ── LEFT PANEL — controls ────────────────────────────────────────── */}
        <div className="te-panel">
          <form onSubmit={onSubmit} className="space-y-3">

            {/* ── ACTION BAR — bare div with border-bottom ─────────────── */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 pb-4"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--brand-violet)" }}
                >
                  Editor
                </p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-primary">
                  Diseño de tickets
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/events/${props.eventId}/edit`} className="te-cancel-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Volver
                </Link>
                <button type="submit" disabled={loading} className="te-save-btn">
                  {loading ? (
                    <>
                      <span className="te-spinner" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Guardar diseño
                    </>
                  )}
                </button>
              </div>

              {/* Message */}
              {message && (
                <div className="w-full">
                  <span className={`te-msg ${messageOk ? "te-msg-ok" : "te-msg-err"}`}>
                    {messageOk ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    )}
                    {message}
                  </span>
                </div>
              )}
            </div>

            {/* ── SECTION 1 — FORMATO ─────────────────────────────────────── */}
            <div className="te-s1 te-section">
              <div className="te-section-inner">
                <p className="te-section-label">
                  <IconLayout />
                  Formato del ticket
                </p>

                <div className="space-y-2">
                  {ticketTemplatePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`te-preset-card ${formData.layout === preset.id ? "te-preset-active" : ""}`}
                      onClick={() => applyPreset(preset.id)}
                    >
                      <div className="te-preset-icon">
                        <LayoutIcon layout={preset.id} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-primary">{preset.name}</p>
                        <p className="text-[11.5px] text-secondary leading-snug">{preset.description}</p>
                      </div>
                      {formData.layout === preset.id && (
                        <svg
                          className="ml-auto shrink-0 text-[color:var(--brand-violet)]"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Fine-grained select */}
                <div className="mt-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Layout activo</span>
                    <select
                      className="field"
                      value={formData.layout}
                      onChange={(event) => setFormData((current) => ({ ...current, layout: event.target.value as TicketLayout }))}
                    >
                      <option value="HORIZONTAL">Horizontal clásico</option>
                      <option value="VERTICAL">Vertical mobile</option>
                      <option value="VERTICAL_COMPACT">Vertical compacto</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* ── SECTION 2 — COLORES ─────────────────────────────────────── */}
            <div className="te-s2 te-section">
              <div className="te-section-inner">
                <p className="te-section-label">
                  <IconPalette />
                  Colores
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Color base</p>
                    <label className="te-color-pill">
                      <input
                        type="color"
                        value={formData.backgroundColor}
                        onChange={(event) => setFormData((current) => ({ ...current, backgroundColor: event.target.value }))}
                      />
                      <span className="te-color-value">{formData.backgroundColor}</span>
                    </label>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Color acento</p>
                    <label className="te-color-pill">
                      <input
                        type="color"
                        value={formData.accentColor}
                        onChange={(event) => setFormData((current) => ({ ...current, accentColor: event.target.value }))}
                      />
                      <span className="te-color-value">{formData.accentColor}</span>
                    </label>
                  </div>
                </div>

                {/* Overlay opacity */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Opacidad del overlay</span>
                  </div>
                  <div className="te-slider-row">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(overlayOpacity * 100)}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          backgroundOverlayOpacity: Number(event.target.value) / 100
                        }))
                      }
                    />
                    <span className="te-slider-val">{Math.round(overlayOpacity * 100)}%</span>
                  </div>
                  {/* Live swatch preview of overlay result */}
                  <div
                    className="mt-2.5 h-6 w-full rounded-md border border-[color:var(--border-soft)] overflow-hidden"
                    title="Vista previa del overlay"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full w-full"
                      style={{
                        background: `linear-gradient(135deg, ${formData.backgroundColor}ee 0%, ${formData.accentColor}cc 100%)`,
                        opacity: overlayOpacity
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION 3 — TEXTOS ──────────────────────────────────────── */}
            <div className="te-s3 te-section">
              <div className="te-section-inner">
                <p className="te-section-label">
                  <IconText />
                  Textos del ticket
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Encabezado</span>
                    <input
                      className="field"
                      placeholder="Nombre del evento o marca"
                      value={formData.headerText}
                      onChange={(event) => setFormData((current) => ({ ...current, headerText: event.target.value }))}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Texto inferior</span>
                    <textarea
                      className="field min-h-20 resize-y"
                      placeholder="Condiciones, instrucciones, disclaimer..."
                      value={formData.footerText}
                      onChange={(event) => setFormData((current) => ({ ...current, footerText: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* ── SECTION 4 — IMAGEN DE FONDO ─────────────────────────────── */}
            <div className="te-s4 te-section">
              <div className="te-section-inner">
                <p className="te-section-label">
                  <IconImage />
                  Imagen de fondo
                </p>
                <ImageCropField
                  title=""
                  hint="Arrastrá para reencuadrar. Usá el slider de zoom para ajustar la escala."
                  imageDataUrl={formData.backgroundImageDataUrl ?? null}
                  zoom={backgroundZoom}
                  offsetX={backgroundOffsetX}
                  offsetY={backgroundOffsetY}
                  aspectRatio={backgroundAspect}
                  onUpload={(file) => onUploadImage("backgroundImageDataUrl", file)}
                  onChange={(patch) =>
                    setFormData((current) => ({
                      ...current,
                      backgroundImageZoom: patch.zoom ?? current.backgroundImageZoom,
                      backgroundImageOffsetX: patch.offsetX ?? current.backgroundImageOffsetX,
                      backgroundImageOffsetY: patch.offsetY ?? current.backgroundImageOffsetY
                    }))
                  }
                  onReset={() =>
                    setFormData((current) => ({
                      ...current,
                      backgroundImageZoom: 1,
                      backgroundImageOffsetX: 0,
                      backgroundImageOffsetY: 0
                    }))
                  }
                  onClear={() =>
                    setFormData((current) => ({
                      ...current,
                      backgroundImageDataUrl: null,
                      backgroundImageZoom: 1,
                      backgroundImageOffsetX: 0,
                      backgroundImageOffsetY: 0
                    }))
                  }
                />
              </div>
            </div>

            {/* ── SECTION 5 — LOGO ────────────────────────────────────────── */}
            <div className="te-s5 te-section">
              <div className="te-section-inner">
                <p className="te-section-label">
                  <IconImage />
                  Logo del evento
                </p>
                <ImageCropField
                  title=""
                  hint="Espacio cuadrado en la cabecera del ticket. Arrastrá para encuadrar."
                  imageDataUrl={formData.logoImageDataUrl ?? null}
                  zoom={logoZoom}
                  offsetX={logoOffsetX}
                  offsetY={logoOffsetY}
                  aspectRatio={1}
                  onUpload={(file) => onUploadImage("logoImageDataUrl", file)}
                  onChange={(patch) =>
                    setFormData((current) => ({
                      ...current,
                      logoImageZoom: patch.zoom ?? current.logoImageZoom,
                      logoImageOffsetX: patch.offsetX ?? current.logoImageOffsetX,
                      logoImageOffsetY: patch.offsetY ?? current.logoImageOffsetY
                    }))
                  }
                  onReset={() =>
                    setFormData((current) => ({
                      ...current,
                      logoImageZoom: 1,
                      logoImageOffsetX: 0,
                      logoImageOffsetY: 0
                    }))
                  }
                  onClear={() =>
                    setFormData((current) => ({
                      ...current,
                      logoImageDataUrl: null,
                      logoImageZoom: 1,
                      logoImageOffsetX: 0,
                      logoImageOffsetY: 0
                    }))
                  }
                />
              </div>
            </div>

          </form>
        </div>

        {/* ── RIGHT PANEL — live preview ───────────────────────────────────── */}
        <div className="te-preview">
          <div className="sticky top-6">
            <div className="te-preview-panel">

              <div className="te-preview-header">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--brand-violet)" }}
                  >
                    Vista previa exacta
                  </p>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-primary">
                    Render real del PDF final
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-secondary">
                    Se actualiza automáticamente al editar
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {/* Layout badge */}
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
                    style={{
                      borderColor: "rgba(91,33,182,0.22)",
                      background: "rgba(91,33,182,0.06)",
                      color: "var(--brand-violet)"
                    }}
                  >
                    <LayoutIcon layout={formData.layout} />
                    {layoutLabel}
                  </span>

                  {/* Loading indicator */}
                  {previewLoading && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-secondary">
                      <span className="te-spinner" />
                      Actualizando...
                    </span>
                  )}
                </div>
              </div>

              {/* Preview frame */}
              <div className="p-4">
                <div
                  className="overflow-hidden rounded-xl border border-[color:var(--border-soft)] bg-sunken"
                  style={{ padding: "6px" }}
                >
                  {previewPdfUrl ? (
                    <iframe
                      title="Preview PDF ticket"
                      src={previewPdfUrl}
                      className={`w-full rounded-lg bg-surface ${previewHeightClass} transition-opacity duration-300`}
                      style={{ opacity: previewLoading ? 0.6 : 1 }}
                    />
                  ) : (
                    <div className={`flex w-full flex-col items-center justify-center gap-3 rounded-lg ${previewHeightClass}`}>
                      {previewLoading ? (
                        <>
                          <span className="te-spinner" style={{ width: "24px", height: "24px", borderWidth: "2.5px" }} />
                          <p className="text-[12px] text-secondary">Generando preview...</p>
                        </>
                      ) : (
                        <>
                          {/* Placeholder ticket skeleton */}
                          <div
                            className="relative overflow-hidden rounded-xl border border-[color:var(--border-soft)]"
                            style={{
                              width: isHorizontal ? "min(360px, 90%)" : "min(220px, 70%)",
                              aspectRatio: isHorizontal ? "842/420" : "430/760",
                              background: `${formData.backgroundColor}22`
                            }}
                            aria-hidden="true"
                          >
                            <div className="te-shimmer absolute inset-0 opacity-60" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <p className="text-[11px] font-semibold text-muted opacity-60">Cargando ticket...</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Error state */}
                {previewError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger-500/20 bg-danger-50 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-[12px] text-danger-700">{previewError}</p>
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div
                className="flex items-center gap-2 border-t border-[color:var(--border-soft)] px-5 py-3"
                aria-hidden="true"
              >
                <svg className="h-3 w-3 shrink-0 text-muted opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-[11px] text-muted">
                  El render usa datos reales del evento. Lo que ves es lo que se imprime en el PDF.
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </>
  );
}
