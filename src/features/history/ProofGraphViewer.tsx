import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Background,
  BackgroundVariant,
  getNodesBounds,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import { Anchor, Check, Maximize, Minus, Plus, Search, X } from "lucide-react";
import { Notice } from "../workspace/fields";
import { ProofNodeDetails } from "./ProofNodeDetails";
import { proofNodeIcon } from "./proof-node-display";
import {
  GRAPH_MAX_ZOOM,
  useGraphNavigation,
  useGraphOverview,
} from "./graph-navigation";
import {
  graphEdgeId,
  nodeKind,
  type ProofGraph,
  type ProofGraphNode,
} from "./proof-graph";
import {
  RestoreGraphContext,
  useRestoreGraph,
  type RestoreGraphInteraction,
} from "./RestoreGraphContext";
import { RestoreNodeControl } from "./RestoreNodeControl";
import { ProofNodePreview } from "./ProofNodePreview";
import { ExportNodeControl, ExportRecordDetails } from "./ExportNodeControl";
import {
  ProofSelectionContext,
  useProofSelection,
  type ProofSelectionInteraction,
} from "./ProofSelectionContext";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphLayout,
  type LayoutInput,
} from "./graph-layout";
import "@xyflow/react/dist/style.css";

type RecordNode = Node<{ record: ProofGraphNode }, "proof">;
const short = (value: string) => `${value.slice(0, 7)}…${value.slice(-5)}`;

function CircleNode({ data }: NodeProps<RecordNode>) {
  const restore = useRestoreGraph();
  const selection = useProofSelection();
  const [opened, setOpened] = useState(false);
  const [hovered, setHovered] = useState(false);
  const returningFocus = useRef(false);
  const node = data.record,
    kind = node.record?.source.kind;
  const Icon = proofNodeIcon(kind);
  const incomplete =
    !node.record ||
    (node.record.source.kind === "pack" && node.record.members === undefined) ||
    (node.record.source.kind === "account" && !node.record.snapshot);
  const trigger = (
    <Dialog.Trigger asChild>
      <button
        className="proof-node-circle nodrag nopan"
        type="button"
        aria-label={`${nodeKind(node)} record ${node.pda}`}
        data-pda={node.pda}
        onBlurCapture={() => {
          returningFocus.current = false;
        }}
        onPointerMoveCapture={(event) => {
          if (event.pointerType !== "touch") returningFocus.current = false;
        }}
      >
        <Icon size={27} aria-hidden="true" />
        {selection?.included.has(node.pda) && (
          <span className="proof-export-badge" aria-label="Included in export">
            <Check size={17} />
          </span>
        )}
        {incomplete && (
          <span
            className="proof-node-warning"
            aria-label="Incomplete saved data"
          >
            !
          </span>
        )}
        {restore?.selected.has(node.pda) && (
          <span
            className="proof-restore-badge"
            aria-label="Selected for restore"
          >
            <Check size={17} />
          </span>
        )}
        {restore?.anchors.has(node.pda) && (
          <span
            className="proof-anchor-badge"
            aria-label="Validated live anchor"
          >
            <Anchor size={16} />
          </span>
        )}
      </button>
    </Dialog.Trigger>
  );
  return (
    <div
      className="proof-graph-node"
      data-kind={kind ?? "missing"}
      data-restore-selected={restore?.selected.has(node.pda) || undefined}
      data-restore-anchor={restore?.anchors.has(node.pda) || undefined}
      data-restore-required={restore?.required.has(node.pda) || undefined}
      data-restore-proof={restore?.proofNodes.has(node.pda) || undefined}
      data-export-included={
        selection ? selection.included.has(node.pda) : undefined
      }
      data-export-preview={selection?.preview?.has(node.pda) || undefined}
    >
      <Handle type="target" position={Position.Top} />
      <Dialog.Root open={opened} onOpenChange={setOpened}>
        {restore || selection ? (
          <ProofNodePreview
            node={node}
            detailsOpen={opened}
            label={restore ? "Restore record preview" : "Export record preview"}
            controls={
              restore ? (
                <RestoreNodeControl node={node} />
              ) : (
                <ExportNodeControl
                  node={node}
                  onOpenActions={() => setOpened(true)}
                />
              )
            }
          >
            {trigger}
          </ProofNodePreview>
        ) : (
          <Tooltip.Root
            open={hovered && !opened}
            onOpenChange={(next) => {
              if (!next || !returningFocus.current) setHovered(next);
            }}
          >
            <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="proof-node-popup proof-node-tooltip"
                side="top"
                sideOffset={8}
                collisionPadding={12}
                data-testid="proof-node-tooltip"
                onEscapeKeyDown={() => setHovered(false)}
              >
                <ProofNodeDetails node={node} compact />
                <Tooltip.Arrow className="proof-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <Dialog.Portal>
          <Dialog.Overlay className="proof-record-overlay" />
          <Dialog.Content
            className="proof-node-popup proof-node-dialog"
            data-restore={Boolean(restore) || undefined}
            data-export={Boolean(selection) || undefined}
            data-interactive={Boolean(restore || selection) || undefined}
            aria-describedby={undefined}
            onCloseAutoFocus={() => {
              // Keep Radix's correct focus return, without reopening the tooltip.
              returningFocus.current = true;
              setHovered(false);
            }}
          >
            <Dialog.Title className="sr-only">
              {nodeKind(node)} record details
            </Dialog.Title>
            <Dialog.Close
              className="proof-popup-close"
              aria-label="Close record details"
            >
              <X size={18} />
            </Dialog.Close>
            {selection ? (
              <ExportRecordDetails node={node} />
            ) : (
              <>
                <ProofNodeDetails node={node} />
                <RestoreNodeControl node={node} />
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <strong>{nodeKind(node)}</strong>
      <code>{short(node.id ?? node.pda)}</code>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function HistoryLabel({
  data,
}: NodeProps<Node<{ title: string; count: number }, "history">>) {
  return (
    <div className="proof-graph-history">
      <h3>{data.title}</h3>
      <span>{data.count} records</span>
    </div>
  );
}
const nodeTypes = { proof: CircleNode, history: HistoryLabel };

function GraphControls({
  graph,
  overview,
}: {
  graph: ProofGraph;
  overview: Viewport;
}) {
  const flow = useReactFlow();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const fit = () =>
    void flow.setViewport(overview, {
      duration: 250,
      // Smooth fit briefly zooms out during long pans; linear respects the floor.
      interpolate: "linear",
    });
  const locate = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    const match = [...graph.nodes.values()].find(
      (node) => node.pda === value || node.id === value.toLowerCase(),
    );
    if (!match) {
      setMessage("No record with this address or ID in the proof.");
      return;
    }
    setMessage("");
    void flow.fitView({
      nodes: [{ id: match.pda }],
      padding: 1,
      minZoom: overview.zoom,
      maxZoom: 1.3,
      duration: 250,
      interpolate: "linear",
    });
  };
  return (
    <div className="proof-graph-toolbar">
      <div
        className="proof-graph-controls"
        role="group"
        aria-label="Graph view controls"
      >
        <button
          type="button"
          aria-label="Zoom out graph"
          title="Zoom out"
          onClick={() => void flow.zoomOut({ duration: 150 })}
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          aria-label="Zoom in graph"
          title="Zoom in"
          onClick={() => void flow.zoomIn({ duration: 150 })}
        >
          <Plus size={18} />
        </button>
        <button type="button" onClick={fit}>
          <Maximize size={17} /> Fit graph
        </button>
      </div>
      <form className="proof-graph-search" onSubmit={locate}>
        <input
          aria-label="Find record in graph"
          placeholder="Find by address or record ID"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage("");
          }}
        />
        <button type="submit" aria-label="Find record" disabled={!query.trim()}>
          <Search size={18} />
        </button>
        {message && <span role="status">{message}</span>}
      </form>
    </div>
  );
}

function GraphNavigation({
  canvasRef,
  overview,
}: {
  canvasRef: RefObject<HTMLDivElement>;
  overview: Viewport;
}) {
  useGraphNavigation(canvasRef, overview);
  return null;
}

function GraphCanvas({
  graph,
  layout,
  restore,
  selection,
}: {
  graph: ProofGraph;
  layout: GraphLayout;
  restore?: RestoreGraphInteraction;
  selection?: ProofSelectionInteraction;
}) {
  const large = graph.nodes.size > 250;
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodes = useMemo(
    () => [
      ...layout.nodes.map(
        ({ id, x, y }): RecordNode => ({
          id,
          type: "proof",
          data: { record: graph.nodes.get(id)! },
          position: { x, y },
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          focusable: false,
        }),
      ),
      ...layout.histories.map(
        ({ id, x, y }, index): Node => ({
          id: `history-${id}`,
          type: "history",
          data: {
            title: `History ${index + 1}`,
            count: graph.components[index].records,
          },
          position: { x, y },
          width: 180,
          height: 40,
          selectable: false,
          focusable: false,
        }),
      ),
    ],
    [graph, layout],
  );
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        id: graphEdgeId(edge.source, edge.target),
        className: restore
          ? restore.proofEdges.has(graphEdgeId(edge.source, edge.target))
            ? "proof-edge-active"
            : "proof-edge-muted"
          : selection
            ? selection.included.has(edge.source) &&
              selection.included.has(edge.target)
              ? "proof-edge-active"
              : "proof-edge-muted"
            : undefined,
        source: edge.source,
        target: edge.target,
        type: "default",
        label: edge.member === undefined ? undefined : String(edge.member),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          // Arrowheads follow the graph scale, independently of the line's minimum width.
          markerUnits: "userSpaceOnUse",
          width: 18,
          height: 18,
          color: restore
            ? restore.proofEdges.has(graphEdgeId(edge.source, edge.target))
              ? "#67e8cd"
              : "#716985"
            : selection
              ? selection.included.has(edge.source) &&
                selection.included.has(edge.target)
                ? "#67e8cd"
                : "#716985"
              : "#d7c8ff",
        },
        focusable: false,
        selectable: false,
        ariaLabel: `${edge.source} to ${edge.target}${edge.member ? `, member ${edge.member}` : ", previous record"}`,
      })),
    [graph, restore, selection],
  );
  const bounds = useMemo(() => getNodesBounds(nodes), [nodes]);
  const overview = useGraphOverview(canvasRef, bounds);
  return (
    <ReactFlowProvider>
      {overview && <GraphControls graph={graph} overview={overview} />}
      <div
        ref={canvasRef}
        className="proof-graph-canvas"
        role="region"
        aria-label="Proof graph viewer"
        onMouseDownCapture={(event) => {
          // Suppress browser autoscroll, while allowing React Flow's middle drag.
          if (event.button === 1) event.preventDefault();
        }}
      >
        <Tooltip.Provider delayDuration={180}>
          {overview && (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesReconnectable={false}
              deleteKeyCode={null}
              selectionOnDrag={false}
              panOnDrag={[0, 1]}
              panOnScroll={false}
              nodesFocusable={false}
              edgesFocusable={false}
              defaultViewport={overview}
              minZoom={overview.zoom}
              maxZoom={GRAPH_MAX_ZOOM}
              onlyRenderVisibleElements={large}
              preventScrolling
              zoomOnScroll={false}
              zoomActivationKeyCode={null}
              zoomOnPinch
              zoomOnDoubleClick={false}
              colorMode="dark"
            >
              <GraphNavigation canvasRef={canvasRef} overview={overview} />
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                color="#615a8e"
              />
            </ReactFlow>
          )}
        </Tooltip.Provider>
      </div>
      {large && (
        <Notice>
          Large proof: only the visible area is drawn, without removing any
          records. Pan or find a record by its address or ID to explore the
          rest.
        </Notice>
      )}
      <div className="proof-graph-legend" aria-label="Graph legend">
        {(
          ["hash", "branch", "batch", "pack", "account", "missing"] as const
        ).map((kind) => (
          <span key={kind} data-kind={kind}>
            <i />
            {kind === "missing"
              ? "Missing record"
              : kind[0].toUpperCase() + kind.slice(1)}
          </span>
        ))}
      </div>
      {restore && (
        <div
          className="proof-graph-legend proof-restore-legend"
          aria-label="Restore graph legend"
        >
          <span className="restore-selected-key">
            <Check size={14} />
            Selected for restore
          </span>
          <span className="restore-anchor-key">
            <Anchor size={14} />
            Validated live anchor
          </span>
          <span className="restore-proof-key">
            <i />
            Shortest restore paths
          </span>
          <span className="restore-required-key">
            <i />
            Required extra record
          </span>
        </div>
      )}
      {selection && (
        <div
          className="proof-graph-legend proof-export-legend"
          aria-label="Export graph legend"
        >
          <span>
            <Check size={14} /> Included in export
          </span>
          <span>Dimmed: excluded</span>
          <span>Amber outline: action preview</span>
        </div>
      )}
      <p className="fine-print">
        Drag the background or hold the mouse wheel to pan; scroll or pinch to
        zoom. Fit graph shows the full history; zoom-out stops at that overview.{" "}
        {selection
          ? "Hover to include a record; click or tap for history selection actions."
          : restore
            ? "Hover for restore selection; click, tap or press Enter on a circle for full details."
            : "Hover or focus a circle for a preview; click or tap for full details."}{" "}
        Arrows point to earlier records or group members; numbers show member
        order.
      </p>
    </ReactFlowProvider>
  );
}

export default function ProofGraphViewer({
  graph,
  restore,
  selection,
}: {
  graph: ProofGraph;
  restore?: RestoreGraphInteraction;
  selection?: ProofSelectionInteraction;
}) {
  const [layout, setLayout] = useState<GraphLayout>();
  const [error, setError] = useState("");
  useEffect(() => {
    setLayout(undefined);
    setError("");
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./proof-layout.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      setError(
        "Could not start the graph viewer. Reload the page and try again.",
      );
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      setError(
        "Graph layout took too long. Try inspecting a smaller proof file.",
      );
    }, 15000);
    worker.onmessage = (
      event: MessageEvent<{ layout?: GraphLayout; error?: string }>,
    ) => {
      clearTimeout(timeout);
      if (event.data.layout) setLayout(event.data.layout);
      else setError(event.data.error ?? "Could not draw this proof history.");
      worker.terminate();
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      setError(
        "Could not draw this proof history. Reload the page and try again.",
      );
    };
    worker.postMessage({
      components: graph.components.map(({ key, members }) => ({
        key,
        members,
      })),
      edges: graph.edges,
    } satisfies LayoutInput);
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [graph]);
  if (error) return <Notice error>{error}</Notice>;
  if (!layout) return <p role="status">Arranging proof graph…</p>;
  return (
    <RestoreGraphContext.Provider value={restore}>
      <ProofSelectionContext.Provider value={selection}>
        <GraphCanvas
          graph={graph}
          layout={layout}
          restore={restore}
          selection={selection}
        />
      </ProofSelectionContext.Provider>
    </RestoreGraphContext.Provider>
  );
}
