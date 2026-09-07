import { useLayoutEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  type Location,
} from "react-router-dom";
import Workspace from "../features/workspace/Workspace";
import { DocsPage } from "../features/guide/DocsPage";

/** Docs has its own route while the workspace keeps its form and proof state. */
export function AppPages() {
  const location = useLocation();
  const isDocs =
    location.pathname === "/docs" || location.pathname.startsWith("/docs/");
  const [workspaceLocation, setWorkspaceLocation] = useState<Location | null>(
    () => (isDocs ? null : location),
  );
  // Freeze the workspace's router context too: /docs must not clear a selected record.
  if (!isDocs && workspaceLocation !== location) setWorkspaceLocation(location);
  const workspaceScroll = useRef(0);
  const wasDocs = useRef(isDocs);
  useLayoutEffect(() => {
    const returning = wasDocs.current && !isDocs;
    wasDocs.current = isDocs;
    window.scrollTo(0, isDocs ? 0 : workspaceScroll.current);
    if (isDocs) return;
    if (returning)
      document
        .getElementById("workspace-docs-link")
        ?.focus({ preventScroll: true });
    const rememberScroll = () => {
      workspaceScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, [isDocs]);
  const backTo = workspaceLocation
    ? workspaceLocation.pathname +
      workspaceLocation.search +
      workspaceLocation.hash
    : "/";
  return (
    <>
      <div hidden={isDocs}>
        {workspaceLocation && (
          <Routes location={workspaceLocation}>
            <Route path="*" element={<Workspace />} />
          </Routes>
        )}
      </div>
      <Routes>
        <Route
          path="/docs"
          element={<Navigate to="/docs/getting-started" replace />}
        />
        <Route path="/docs/:section" element={<DocsPage backTo={backTo} />} />
        <Route path="/docs/*" element={<DocsPage backTo={backTo} />} />
        <Route path="*" element={null} />
      </Routes>
    </>
  );
}
