import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

/** Themed choice control with Radix keyboard, focus and popup behavior. */
export function SelectField({
  id,
  label,
  value,
  options,
  placeholder = "Choose an option",
  disabled = false,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly { key: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onChange(value: string): void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="select-control" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="select-menu"
        sideOffset={6}
        collisionPadding={12}
      >
        {options.map((option) => (
          <SelectItem
            className="select-option"
            key={option.key}
            value={option.key}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
