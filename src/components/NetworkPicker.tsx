import type { ComponentProps } from "react";
import { Globe2 } from "lucide-react";
import { SelectField } from "./SelectField";

export function NetworkPicker(
  props: Omit<ComponentProps<typeof SelectField>, "label">,
) {
  return (
    <div className="network-picker">
      <span className="network-label">
        <Globe2 size={14} aria-hidden="true" />
        Network
      </span>
      <SelectField label="Network" {...props} />
    </div>
  );
}
