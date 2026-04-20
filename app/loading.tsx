import { BrandMark } from "@/components/ui/brand-mark";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 py-hero">
      <BrandMark size="lg" />
      <Spinner size="lg" tone="accent" />
      <p className="text-body text-secondary">Preparando tu experiencia…</p>
    </div>
  );
}
