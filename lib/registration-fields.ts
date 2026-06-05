import { z } from "zod";

export const registrationFieldDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  placeholder: z.string().trim().max(120).optional().default(""),
  required: z.boolean().default(false)
});

export const registrationFieldValueSchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().trim().max(500).optional().default("")
});

export type RegistrationFieldDefinition = z.infer<typeof registrationFieldDefinitionSchema>;
export type RegistrationFieldValueInput = z.infer<typeof registrationFieldValueSchema>;

export type RegistrationFieldAnswer = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  value: string;
};

export function normalizeRegistrationFieldDefinitions(raw: unknown): RegistrationFieldDefinition[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map((item) => registrationFieldDefinitionSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);

  const deduped = new Set<string>();
  return parsed.filter((item) => {
    const key = item.key.trim();
    if (deduped.has(key)) return false;
    deduped.add(key);
    return true;
  });
}

export function normalizeRegistrationAnswers(raw: unknown): RegistrationFieldAnswer[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const key = typeof value.key === "string" ? value.key.trim() : "";
      const label = typeof value.label === "string" ? value.label.trim() : "";
      const placeholder = typeof value.placeholder === "string" ? value.placeholder.trim() : "";
      const required = value.required === true;
      const answer = typeof value.value === "string" ? value.value.trim() : "";
      if (!key || !label) return null;
      return { key, label, placeholder, required, value: answer } satisfies RegistrationFieldAnswer;
    })
    .filter((item): item is RegistrationFieldAnswer => item !== null);
}

export function buildRegistrationAnswerSnapshot(input: {
  definitions: RegistrationFieldDefinition[];
  submitted: RegistrationFieldValueInput[];
}) {
  const submittedMap = new Map(input.submitted.map((item) => [item.key, item.value.trim()]));

  const answers = input.definitions.map((field) => ({
    key: field.key,
    label: field.label,
    placeholder: field.placeholder ?? "",
    required: field.required,
    value: submittedMap.get(field.key)?.trim() ?? ""
  }));

  const missing = answers.filter((field) => field.required && !field.value);
  if (missing.length > 0) {
    throw new Error(`Completa los campos obligatorios: ${missing.map((field) => field.label).join(", ")}`);
  }

  return answers;
}
