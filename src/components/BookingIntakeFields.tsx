import { CustomerFormFields, type Field } from "./CustomerFormFields";

export type BookingIntakeForm = {
  name: string;
  description?: string;
  version_id: string;
  fields: Field[];
};

export function BookingIntakeFields({ form, answers, onChange, disabled }: {
  form: BookingIntakeForm;
  answers: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
  disabled?: boolean;
}) {
  return <fieldset className="booking-intake-fields" disabled={disabled}>
    <legend>{form.name}</legend>
    {form.description && <p>{form.description}</p>}
    <CustomerFormFields fields={form.fields} answers={answers} onChange={onChange} />
  </fieldset>;
}
