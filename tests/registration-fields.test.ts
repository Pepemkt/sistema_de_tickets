import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRegistrationAnswerSnapshot,
  normalizeRegistrationAnswers,
  normalizeRegistrationFieldDefinitions
} from "../lib/registration-fields";

test("normalizeRegistrationFieldDefinitions filters invalid and duplicate keys", () => {
  const result = normalizeRegistrationFieldDefinitions([
    { key: "company", label: "Empresa", placeholder: "Tu empresa", required: true },
    { key: "company", label: "Empresa duplicada", placeholder: "", required: false },
    { key: "diet", label: "", placeholder: "", required: false },
    { key: "role", label: "Cargo", placeholder: "Marketing", required: false }
  ]);

  assert.deepEqual(result, [
    { key: "company", label: "Empresa", placeholder: "Tu empresa", required: true },
    { key: "role", label: "Cargo", placeholder: "Marketing", required: false }
  ]);
});

test("buildRegistrationAnswerSnapshot preserves label snapshot and optional blanks", () => {
  const result = buildRegistrationAnswerSnapshot({
    definitions: [
      { key: "company", label: "Empresa", placeholder: "Tu empresa", required: true },
      { key: "diet", label: "Restricción alimentaria", placeholder: "Opcional", required: false }
    ],
    submitted: [
      { key: "company", value: "Aiderbrand" },
      { key: "diet", value: "" }
    ]
  });

  assert.deepEqual(result, [
    { key: "company", label: "Empresa", placeholder: "Tu empresa", required: true, value: "Aiderbrand" },
    { key: "diet", label: "Restricción alimentaria", placeholder: "Opcional", required: false, value: "" }
  ]);
});

test("buildRegistrationAnswerSnapshot rejects missing required values", () => {
  assert.throws(
    () =>
      buildRegistrationAnswerSnapshot({
        definitions: [{ key: "company", label: "Empresa", placeholder: "", required: true }],
        submitted: []
      }),
    /Empresa/
  );
});

test("normalizeRegistrationAnswers keeps readable historical snapshots", () => {
  const result = normalizeRegistrationAnswers([
    { key: "company", label: "Empresa", placeholder: "Tu empresa", required: true, value: "Aiderbrand" },
    { key: "role", label: "Cargo", placeholder: "", required: false, value: "Marketing" }
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.label, "Empresa");
  assert.equal(result[1]?.value, "Marketing");
});
