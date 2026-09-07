import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  getViewportForBounds,
  useReactFlow,
  useStore,
  type Rect,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";

export const GRAPH_MAX_ZOOM = 2;

/** The full graph overview is also the zoom-out limit, not a fixed percentage. */
export function graphOverview(
  bounds: Rect,
  width: number,
  height: number,
): Viewport {
  return getViewportForBounds(bounds, width, height, 0, 1.05, 0.2);
}

export function useGraphOverview(
  canvasRef: RefObject<HTMLDivElement>,
  bounds: Rect,
) {
  const [overview, setOverview] = useState<Viewport>();
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      const next = graphOverview(bounds, width, height);
      setOverview((current) =>
        current?.x === next.x &&
        current.y === next.y &&
        current.zoom === next.zoom
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, bounds]);
  return overview;
}

/** Keep a fitted overview fitted on resize; preserve a deliberately zoomed-in view. */
export function useGraphNavigation(
  canvasRef: RefObject<HTMLDivElement>,
  overview: Viewport,
) {
  useGraphWheelZoom(canvasRef, overview.zoom, GRAPH_MAX_ZOOM);
  const zoom = useStore((state) => state.transform[2]);
  useLayoutEffect(() => {
    // The viewport scales an HTML ancestor; SVG non-scaling-stroke alone cannot compensate.
    canvasRef.current?.style.setProperty("--proof-graph-zoom", String(zoom));
  }, [canvasRef, zoom]);
  const { getViewport, setViewport } = useReactFlow();
  const previous = useRef(overview);
  useEffect(() => {
    const current = getViewport();
    const wasOverview =
      Math.abs(current.zoom - previous.current.zoom) < 0.000001;
    if (
      previous.current !== overview &&
      (wasOverview || current.zoom < overview.zoom)
    ) {
      void setViewport(overview);
    }
    previous.current = overview;
  }, [overview, getViewport, setViewport]);
}

/** Faster wheel zoom, anchored under the cursor and bounded for coarse wheel events. */
export function wheelViewport(
  viewport: Viewport,
  pointer: XYPosition,
  deltaY: number,
  deltaMode: number,
  minZoom: number,
  maxZoom: number,
): Viewport {
  // React Flow's pixel/line/page normalization, with 2.5x wheel sensitivity.
  const unit = deltaMode === 1 ? 0.05 : deltaMode === 2 ? 1 : 0.002;
  const exponent = Math.max(-1, Math.min(1, -deltaY * unit * 2.5));
  const zoom = Math.max(
    minZoom,
    Math.min(maxZoom, viewport.zoom * 2 ** exponent),
  );
  const ratio = zoom / viewport.zoom;
  return {
    x: pointer.x - (pointer.x - viewport.x) * ratio,
    y: pointer.y - (pointer.y - viewport.y) * ratio,
    zoom,
  };
}

/** Own only ordinary wheel events; React Flow retains drag, pinch and touch handling. */
export function useGraphWheelZoom(
  canvasRef: RefObject<HTMLDivElement>,
  minZoom: number,
  maxZoom: number,
) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        (event.target instanceof Element && event.target.closest(".nowheel"))
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.deltaY) return;
      const bounds = canvas.getBoundingClientRect();
      void setViewport(
        wheelViewport(
          getViewport(),
          {
            x: event.clientX - bounds.left - canvas.clientLeft,
            y: event.clientY - bounds.top - canvas.clientTop,
          },
          event.deltaY,
          event.deltaMode,
          minZoom,
          maxZoom,
        ),
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => canvas.removeEventListener("wheel", wheel, { capture: true });
  }, [canvasRef, getViewport, setViewport, minZoom, maxZoom]);
}
