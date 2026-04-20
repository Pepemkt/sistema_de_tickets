import { StateIllustration } from "@/components/ui/state-illustration";
import { BackButton } from "@/components/ui/back-button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 py-hero">
      <StateIllustration variant="not-found" size={200} />
      <h1 className="font-display text-title-xl text-primary">
        No encontramos esta página
      </h1>
      <p className="max-w-md text-center text-body text-secondary">
        Puede que el enlace haya cambiado o que la página ya no exista.
      </p>
      <div className="flex flex-row gap-3 justify-center">
        <a className="btn-primary" href="/">
          Volver al inicio
        </a>
        <BackButton />
      </div>
    </div>
  );
}
