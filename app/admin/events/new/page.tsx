import { EventForm } from "@/components/event-form";

export default function NewEventPage() {
  return (
    <section className="panel p-6">
      <h2 className="section-title">Crear evento</h2>
      <p className="muted mt-1">Define informacion general y multiples tipos de entrada.</p>

      <div className="mt-6">
        <EventForm mode="create" />
      </div>
    </section>
  );
}
