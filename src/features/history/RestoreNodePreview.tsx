import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Anchor, Check } from "lucide-react";
import { ProofNodeDetails } from "./ProofNodeDetails";
import { useRestoreGraph } from "./RestoreGraphContext";
import type { ProofGraphNode } from "./proof-graph";

export function RestoreNodeControl({ node }: { node: ProofGraphNode }) {
  const state = useRestoreGraph();
  if (!state) return null;
  const live = state.records?.get(node.pda);
  const exists =
    state.present.has(node.pda) ||
    state.anchors.has(node.pda) ||
    live?.kind === "conflict";
  const message = !node.record
    ? "Record data is missing from this file."
    : state.anchors.has(node.pda)
      ? "Live anchor · matches this saved history"
      : live?.kind === "conflict"
        ? "This address exists with a different historical record."
        : live?.kind === "error"
          ? "Could not verify this record. Refresh live records to retry."
          : state.present.has(node.pda)
            ? "Already exists · matches this saved history"
            : state.required.has(node.pda)
              ? "Required intermediate record · select it to continue"
              : state.selected.has(node.pda)
                ? "Selected for restoration"
                : state.proofNodes.has(node.pda)
                  ? "On the shortest restore path"
                  : live?.kind === "missing"
                    ? "No live record at this address · select it to check a restore path."
                    : "Select this record, then check its restore path.";
  return (
    <div className="proof-restore-control">
      <p>
        {state.anchors.has(node.pda) && <Anchor size={14} aria-hidden="true" />}
        {message}
      </p>
      <label className="check proof-restore-check">
        <input
          type="checkbox"
          checked={state.selected.has(node.pda)}
          disabled={state.disabled || !node.record || exists}
          onChange={() => state.onToggle(node.pda)}
          aria-label={`Restore record ${node.pda}`}
        />
        <Check size={15} aria-hidden="true" />{" "}
        {exists ? "Already exists" : "Restore this record"}
      </label>
    </div>
  );
}

/** A non-modal interactive preview; tooltips/hover cards cannot host accessible inputs. */
export function RestoreNodePreview({
  node,
  children,
  detailsOpen,
}: {
  node: ProofGraphNode;
  children: ReactNode;
  detailsOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const content = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const returnFocus = useRef(false);
  const cancelClose = () => clearTimeout(closeTimer.current);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (detailsOpen) setOpen(false);
  }, [detailsOpen]);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!content.current?.contains(document.activeElement)) setOpen(false);
    }, 180);
  };
  return (
    <Popover.Root
      modal={false}
      open={open && !detailsOpen}
      onOpenChange={setOpen}
    >
      <Popover.Anchor asChild>
        <span
          ref={anchor}
          className="proof-restore-trigger"
          onPointerEnter={(event) => {
            cancelClose();
            if (event.pointerType !== "touch" && !detailsOpen) setOpen(true);
          }}
          onPointerLeave={scheduleClose}
        >
          {children}
        </span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          className="proof-node-popup proof-node-tooltip proof-restore-preview"
          aria-label="Restore record preview"
          side="top"
          sideOffset={8}
          collisionPadding={12}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onBlur={scheduleClose}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => {
            returnFocus.current = Boolean(
              content.current?.contains(document.activeElement),
            );
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current)
              anchor.current?.querySelector("button")?.focus();
            returnFocus.current = false;
          }}
        >
          <ProofNodeDetails node={node} compact />
          <RestoreNodeControl node={node} />
          <Popover.Arrow className="proof-tooltip-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
