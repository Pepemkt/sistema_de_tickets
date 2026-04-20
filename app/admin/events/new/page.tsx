import { EventForm } from "@/components/event-form";
import { requirePageRole } from "@/lib/auth";

export default async function NewEventPage() {
  const viewer = await requirePageRole(["ADMIN", "MANAGER"]);

  return (
    <section className="panel p-6">
      <h2 className="section-title">Crear evento</h2>
      <p className="muted mt-1">Define informacion general y multiples tipos de entrada.</p>

      <div className="mt-6">
        <EventForm mode="create" viewerRole={viewer.role} />
      </div>
    </section>
  );
}
