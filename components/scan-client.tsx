"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type ValidateResult =
  | { status: "ok"; ticketCode: string; attendeeName: string; eventName: string }
  | { status: "already_used"; ticketCode: string; attendedAt: string; attendeeName: string }
  | { status: "error"; message: string };

export function ScanClient() {
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [manualPayload, setManualPayload] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const processingRef = useRef(false);

  async function validate(payload: string) {
    if (processingRef.current || !payload.trim()) return;
    processingRef.current = true;

    const res = await fetch("/api/tickets/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload })
    });

    const data = await res.json();
    setResult(data);

    setTimeout(() => {
      processingRef.current = false;
    }, 800);
  }

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
          void validate(decodedText);
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

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <h1 className="section-title">Check-in y validacion</h1>
        <p className="muted mt-1">Escanea QR para validar asistencia o usa validacion manual.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-4">
          {!cameraReady && !cameraError && <p className="muted mb-3">Iniciando camara...</p>}
          {cameraError && <p className="mb-3 text-sm text-red-700">No se pudo abrir la camara: {cameraError}</p>}
          <div id="qr-reader" className="overflow-hidden rounded-xl" />
        </div>

        <div className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-900">Validacion manual</h2>
          <p className="muted">Util para tickets impresos con QR dañado o camara no disponible.</p>

          <div className="mt-3 flex gap-2">
            <input
              value={manualPayload}
              onChange={(event) => setManualPayload(event.target.value)}
              className="field"
              placeholder="TICKET:CODIGO:FIRMA"
            />
            <button onClick={() => void validate(manualPayload)} className="btn-primary">
              Validar
            </button>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            {!result && <p className="text-slate-600">Aun sin validaciones en esta sesion.</p>}

            {result?.status === "ok" && (
              <p className="text-emerald-700">
                OK. Ticket {result.ticketCode} de {result.attendeeName} para {result.eventName}.
              </p>
            )}

            {result?.status === "already_used" && (
              <p className="text-amber-700">
                Ya usado. Ticket {result.ticketCode} ({result.attendeeName}) validado en {new Date(result.attendedAt).toLocaleString("es-AR")}.
              </p>
            )}

            {result?.status === "error" && <p className="text-red-700">Error: {result.message}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
