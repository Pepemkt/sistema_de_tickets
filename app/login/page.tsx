import { redirect } from "next/navigation";
import { getCurrentViewer } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const viewer = await getCurrentViewer();

  if (viewer) {
    redirect(viewer.role === "ADMIN" ? "/admin" : viewer.role === "SELLER" ? "/sales" : "/scan");
  }

  return (
    <section className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 animate-pulse rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 animate-pulse rounded-full bg-blue-500/15 blur-3xl [animation-delay:400ms]" />
      </div>

      <div className="panel relative z-10 w-full max-w-md p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Aiderbrand</p>
        <h1 className="section-title mt-2">Acceso al sistema</h1>
        <p className="muted mt-2">Ingresa para gestionar eventos, ventas y asistencia.</p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </section>
  );
}
