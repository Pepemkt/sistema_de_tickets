"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

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

const RESULT_POPUP_MS = 2200;

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

  async function validate(payload: string) {
    if (processingRef.current || !payload.trim()) return;
    processingRef.current = true;
    setIsLocked(true);

    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload })
      });

      const data = (await res.json()) as ValidateResult;
      setResult(data);

      if (data.status === "ok") {
        setEventStats({
          eventId: data.eventId,
          eventName: data.eventName,
          eventScannedCount: data.eventScannedCount
        });
        setPopup({
          tone: "success",
          title: "Asistencia registrada",
          detail: `${data.attendeeName} (${data.ticketCode})`
        });
        schedulePopupDismiss();
        return;
      }

      if (data.status === "already_used") {
        setEventStats({
          eventId: data.eventId,
          eventName: data.eventName,
          eventScannedCount: data.eventScannedCount
        });
        setPopup({
          tone: "warning",
          title: "QR ya utilizado",
          detail: `${data.attendeeName} (${data.ticketCode}) - ${new Date(data.attendedAt).toLocaleString("es-AR")}`
        });
        schedulePopupDismiss();
        return;
      }

      setPopup({
        tone: "error",
        title: "No se pudo validar",
        detail: data.message
      });
      schedulePopupDismiss();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo validar";
      const nextResult: ValidateResult = { status: "error", message };
      setResult(nextResult);
      setPopup({
        tone: "error",
        title: "Error de validacion",
        detail: message
      });
      schedulePopupDismiss();
    }
  }

  validateRef.current = (payload: string) => {
    void validate(payload);
  };

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
          aspectRatio: 1
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

  useEffect(() => {
    return () => {
      clearPopupTimer();
      processingRef.current = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <h1 className="section-title">Check-in y validacion</h1>
        <p className="muted mt-1">Escanea QR para validar asistencia o usa validacion manual.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel p-5">
          <p className="text-overline font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-magenta)]">Evento actual</p>
          <p className="mt-2 text-title-m font-semibold text-primary">{eventStats?.eventName ?? "Sin lecturas aun"}</p>
        </div>
        <div className="panel p-5">
          <p className="text-overline font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-magenta)]">Asistentes escaneados</p>
          <p className="mt-2 font-display text-title-xl font-bold text-primary">{eventStats?.eventScannedCount ?? 0}</p>
          <p className="muted mt-1">Actualizado en tiempo real por QR validado.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-4">
          {!cameraReady && !cameraError && <p className="muted mb-3">Iniciando camara...</p>}
          {cameraError && <p className="mb-3 text-body-s text-danger-500">No se pudo abrir la camara: {cameraError}</p>}
          {isLocked && <p className="mb-3 text-body-s text-warning-700">Procesando lectura...</p>}
          <div id="qr-reader" className="overflow-hidden rounded-xl" />
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-title-m font-bold text-primary">Validacion manual</h2>
          <p className="muted">Util para tickets impresos con QR dañado o camara no disponible.</p>

          <div className="mt-3 flex gap-2">
            <input
              value={manualPayload}
              onChange={(event) => setManualPayload(event.target.value)}
              className="field"
              placeholder="TICKET:CODIGO:FIRMA"
            />
            <button onClick={() => void validate(manualPayload)} className="btn-primary" disabled={isLocked}>
              {isLocked ? "Procesando..." : "Validar"}
            </button>
          </div>

          <div className="mt-5 rounded-md border border-soft bg-sunken p-4 text-body-s">
            {!result && <p className="text-secondary">Aun sin validaciones en esta sesion.</p>}

            {result?.status === "ok" && (
              <p className="text-success-700">
                OK. Ticket {result.ticketCode} de {result.attendeeName} para {result.eventName}. Escaneados: {result.eventScannedCount}.
              </p>
            )}

            {result?.status === "already_used" && (
              <p className="text-warning-700">
                Ya usado. Ticket {result.ticketCode} ({result.attendeeName}) validado en {new Date(result.attendedAt).toLocaleString("es-AR")}. Escaneados: {result.eventScannedCount}.
              </p>
            )}

            {result?.status === "error" && <p className="text-danger-500">Error: {result.message}</p>}
          </div>
        </div>
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--brand-violet-deep)]/70 px-4 py-6 backdrop-blur-sm">
          <div
            className={`pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-lg border bg-surface px-6 py-10 shadow-2xl sm:px-10 ${
              popup.tone === "success"
                ? "border-success-500/40"
                : popup.tone === "warning"
                  ? "border-warning-500/40"
                  : "border-danger-500/40"
            }`}
          >
            <div
              className={`absolute inset-x-0 top-0 h-1.5 ${
                popup.tone === "success"
                  ? "bg-success-500"
                  : popup.tone === "warning"
                    ? "bg-warning-500"
                    : "bg-danger-500"
              }`}
            />

            <button
              type="button"
              onClick={closePopupAndUnlock}
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-soft bg-surface text-body-l font-semibold text-secondary transition hover:bg-sunken"
              aria-label="Cerrar popup"
            >
              x
            </button>

            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full border text-title-m font-bold ${
                  popup.tone === "success"
                    ? "border-success-500/40 bg-success-50 text-success-700"
                    : popup.tone === "warning"
                      ? "border-warning-500/40 bg-warning-50 text-warning-700"
                      : "border-danger-500/40 bg-danger-50 text-danger-500"
                }`}
              >
                {popup.tone === "success" ? "OK" : popup.tone === "warning" ? "!" : "X"}
              </div>

              <p className="mt-6 font-display text-title-xl font-bold text-primary sm:text-4xl">{popup.title}</p>
              <p className="mt-3 text-body text-secondary sm:text-body-l">{popup.detail}</p>

              <button
                type="button"
                onClick={closePopupAndUnlock}
                className={`mt-8 w-full max-w-xs rounded-full px-5 py-3 text-body-s font-semibold text-white transition ${
                  popup.tone === "success"
                    ? "bg-success-500 hover:bg-success-700"
                    : popup.tone === "warning"
                      ? "bg-warning-500 hover:bg-warning-700"
                      : "bg-danger-500 hover:bg-danger-700"
                }`}
              >
                Continuar escaneo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
