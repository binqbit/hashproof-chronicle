import { Identifier, Notice } from "../workspace/fields";
import { timestamp } from "../workspace/values";
import { nodeKind, type ProofGraphNode } from "./proof-graph";

export function ProofNodeDetails({
  node,
  compact = false,
}: {
  node: ProofGraphNode;
  compact?: boolean;
}) {
  const record = node.record;
  return (
    <div className="proof-node-details">
      <h4>{nodeKind(node)} record</h4>
      <Identifier label="Account address" value={node.pda} />
      {node.id && <Identifier label="Canonical record ID" value={node.id} />}
      {record ? (
        <>
          <Identifier
            label="Saved timestamp"
            value={timestamp(record.createdAt)}
          />
          <Identifier label="Timestamp in seconds" value={record.createdAt} />
          {!compact && <Identifier label="Stored hash" value={record.hash} />}
          {!compact && record.source.kind === "branch" && (
            <>
              <Identifier
                label="File / payload hash"
                value={record.source.payload}
              />
              <Identifier
                label="Previous record ID"
                value={record.source.previousHashId}
              />
              <Identifier label="Generation" value={record.source.generation} />
            </>
          )}
          {record.source.kind === "account" && (
            <>
              {!compact && (
                <Identifier
                  label="Recorded Solana account"
                  value={record.source.account}
                />
              )}
              <p>
                {record.snapshot
                  ? "Original account snapshot saved."
                  : "Original account snapshot is missing."}
              </p>
            </>
          )}
          {record.source.kind === "pack" && record.members === undefined && (
            <Notice>
              Pack membership is not saved. Its underlying records cannot be
              inferred from the stored hash.
            </Notice>
          )}
          <p>
            {node.dependencies.length} known historical links · referenced by{" "}
            {node.referencedBy.length} records in this file.
          </p>
        </>
      ) : (
        <Notice>
          This record is referenced, but its contents and timestamp are not in
          the file.
        </Notice>
      )}
      {compact && (
        <p className="proof-tooltip-hint">Click or tap for full details</p>
      )}
    </div>
  );
}
