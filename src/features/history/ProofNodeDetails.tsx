import { AlertCircle, CalendarDays } from "lucide-react";
import { nodeKind, type ProofGraphNode } from "./proof-graph";
import { proofNodeIcon, proofRecordedDate } from "./proof-node-display";

function RecordField({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="proof-record-field">
      <dt>{label}</dt>
      <dd>
        <code>
          {compact ? `${value.slice(0, 8)}…${value.slice(-6)}` : value}
        </code>
      </dd>
    </div>
  );
}

export function ProofNodeDetails({
  node,
  compact = false,
}: {
  node: ProofGraphNode;
  compact?: boolean;
}) {
  const record = node.record;
  const source = record?.source;
  const Icon = proofNodeIcon(source?.kind);
  const date = record ? proofRecordedDate(record.createdAt) : null;
  const members =
    source?.kind === "batch"
      ? source.members.length
      : source?.kind === "pack"
        ? record?.members?.length
        : undefined;
  const warning = !record
    ? compact
      ? "Record not included in proof."
      : "This record is referenced, but its contents and timestamp are not in the file."
    : source?.kind === "pack" && record.members === undefined
      ? compact
        ? "Member list not saved."
        : "Member list not saved. Member connections cannot be shown."
      : source?.kind === "account" && !record.snapshot
        ? compact
          ? "Snapshot not saved."
          : "Account snapshot not saved in this proof."
        : undefined;

  return (
    <div
      className="proof-node-details"
      data-kind={source?.kind ?? "missing"}
      data-compact={compact}
    >
      <header className="proof-record-heading">
        <span className="proof-record-icon">
          <Icon size={23} aria-hidden="true" />
        </span>
        <div>
          <span className="proof-record-eyebrow">
            {record ? "Saved proof" : "Reference only"}
            {compact &&
              members !== undefined &&
              ` · ${members} ${members === 1 ? "member" : "members"}`}
          </span>
          <h4>{record ? `${nodeKind(node)} record` : "Missing record"}</h4>
        </div>
      </header>

      {record && (
        <div className="proof-record-date">
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            {!compact && <span>Recorded time</span>}
            {date ? (
              <time dateTime={date.iso}>
                <strong>{date.day}</strong>
                <span>
                  {date.time}{" "}
                  <abbr title="Coordinated Universal Time">UTC</abbr>
                </span>
              </time>
            ) : (
              <strong className="proof-date-unavailable">
                Outside supported date range
              </strong>
            )}
          </div>
        </div>
      )}

      {!compact &&
        (source?.kind === "branch" ||
          members !== undefined ||
          (source?.kind === "account" && record?.snapshot)) && (
          <div className="proof-record-facts">
            {source?.kind === "branch" && (
              <span>
                Generation <strong>{source.generation}</strong>
              </span>
            )}
            {members !== undefined && (
              <span>
                <strong>{members}</strong>{" "}
                {members === 1 ? "member" : "members"}
              </span>
            )}
            {source?.kind === "account" && record?.snapshot && (
              <span>Account snapshot saved</span>
            )}
          </div>
        )}

      <dl className="proof-record-fields">
        {node.id && (
          <RecordField label="Record ID" value={node.id} compact={compact} />
        )}
        <RecordField label="Proof account" value={node.pda} compact={compact} />
      </dl>

      {!compact && record && (
        <dl className="proof-record-fields proof-record-source">
          {source?.kind === "branch" ? (
            <>
              <RecordField label="Payload hash" value={source.payload} />
              <RecordField
                label="Previous record ID"
                value={source.previousHashId}
              />
            </>
          ) : (
            <RecordField
              label={source?.kind === "hash" ? "Payload hash" : "Stored hash"}
              value={record.hash}
            />
          )}
          {source?.kind === "account" && (
            <RecordField label="Recorded account" value={source.account} />
          )}
        </dl>
      )}

      {warning && (
        <p className="proof-record-warning">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{warning}</span>
        </p>
      )}
    </div>
  );
}
