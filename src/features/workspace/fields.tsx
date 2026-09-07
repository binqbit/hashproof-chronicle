import { ReactNode, useId } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "notice error" : "notice"}
      role={error ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
export function Identifier({ label, value }: { label: string; value: string }) {
  return (
    <div className="identifier">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}
