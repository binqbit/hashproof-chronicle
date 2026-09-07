import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ProofNodeDetails } from "./ProofNodeDetails";
import type { ProofGraphNode } from "./proof-graph";

/** A non-modal interactive preview; tooltips/hover cards cannot host accessible inputs. */
export function ProofNodePreview({
  node,
  children,
  detailsOpen,
  label,
  controls,
}: {
  node: ProofGraphNode;
  children: ReactNode;
  detailsOpen: boolean;
  label: string;
  controls: ReactNode;
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
          className="proof-interactive-trigger"
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
          className="proof-node-popup proof-node-tooltip proof-interactive-preview"
          aria-label={label}
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
          {controls}
          <Popover.Arrow className="proof-tooltip-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
