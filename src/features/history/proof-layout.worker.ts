import { layoutProofGraph, type LayoutInput } from "./graph-layout";

self.onmessage = (event: MessageEvent<LayoutInput>) => {
  try {
    self.postMessage({ layout: layoutProofGraph(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Could not draw this proof history.",
    });
  }
};
