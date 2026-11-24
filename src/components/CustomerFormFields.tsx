export type Field = { id: string; field_key: string; label: string; field_type: string; required: boolean; placeholder: string; help_text: string; options: Array<{ value: string; label: string }>; validation: Record<string, unknown>; visibility_rule: { field_key: string; operator: string; value: string | boolean } | null };

function visible(field: Field, answers: Record<string, unknown>) {
  if (!field.visibility_rule) return true;
  const actual = answers[field.visibility_rule.field_key];
  const expected = field.visibility_rule.value;
  if (field.visibility_rule.operator === "equals") return actual === expected;
  if (field.visibility_rule.operator === "not_equals") return actual !== expected;
  if (field.visibility_rule.operator === "contains") return String(actual ?? "").includes(String(expected));
  if (field.visibility_rule.operator === "is_checked") return Boolean(actual) === Boolean(expected);
  return true;
}

export function CustomerFormFields({ fields, answers, onChange }: {
  fields: Field[];
  answers: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  return fields
    .filter((field) => visible(field, answers))
    .map((field) => <FieldInput key={field.id} field={field} value={answers[field.field_key]} onChange={(value) => onChange(field.field_key, value)} />);
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: unknown) => void }) {
  const common = { required: field.required, placeholder: field.placeholder, minLength: Number(field.validation["min_length"]) || undefined, maxLength: Number(field.validation["max_length"]) || undefined };
  const label = <>{field.label}{field.required && <em>Required</em>}{field.help_text && <small>{field.help_text}</small>}</>;
  if (field.field_type === "textarea" || field.field_type === "address") return <label>{label}<textarea {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}/></label>;
  if (field.field_type === "select") return <label>{label}<select required={field.required} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select an option</option>{field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
  if (field.field_type === "radio") return <fieldset><legend>{label}</legend>{field.options.map((option) => <label key={option.value}><input type="radio" required={field.required} name={field.field_key} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)}/>{option.label}</label>)}</fieldset>;
  if (field.field_type === "checkbox" || field.field_type === "consent") return <label className="public-checkbox"><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/>{field.label}</label>;
  const type = field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : field.field_type === "date" || field.field_type === "time" ? field.field_type : "text";
  return <label>{label}<input {...common} type={type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}/></label>;
}
