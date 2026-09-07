import {
  groupForTool,
  workspaceGroups,
  type WorkspaceTool,
} from "./navigation";
import "./workspace-navigation.css";

export function WorkspaceNavigation({
  selected,
  disabled,
  onSelect,
}: {
  selected: WorkspaceTool;
  disabled: boolean;
  onSelect(tool: WorkspaceTool): void;
}) {
  const active = groupForTool(selected);

  return (
    <div className="workspace-navigation">
      <nav className="workspace-sections" aria-label="Workspace sections">
        {workspaceGroups.map(
          ({ key, label, description, icon: Icon, tools }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-describedby={`workspace-section-${key}`}
              aria-pressed={active.key === key}
              disabled={disabled}
              onClick={() => {
                // Clicking the current section must not reset its selected tool.
                if (active.key !== key) onSelect(tools[0].key);
              }}
            >
              <Icon size={21} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small id={`workspace-section-${key}`}>{description}</small>
              </span>
            </button>
          ),
        )}
      </nav>
      <nav className="workspace-tools" aria-label="Record operations">
        {active.tools.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-current={selected === key ? "page" : undefined}
            disabled={disabled}
            onClick={() => onSelect(key)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
