import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { PROGRAM_ID } from "../../contract/client";
import type { RestoreProofInput } from "../../contract/sdk";
import { useNetwork } from "../../contract/network";
import { readArchiveFiles } from "../history/archive-files";
import { historyFromArchive } from "../history/archive-history";
import { FilePicker } from "../workspace/FilePicker";
import { Notice } from "../workspace/fields";
import { errorMessage, timestamp } from "../workspace/values";
import "./aggregate.css";

export interface AggregateFileSelection {
  ids: string[];
  history: RestoreProofInput[];
  pending: boolean;
  revision: number;
}
const PAGE_SIZE = 50;

/** Local import and explicit selection only. Live checks and signing belong to the parent form. */
export function AggregateProofPicker({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange(selection: AggregateFileSelection): void;
}) {
  const { network } = useNetwork();
  const [records, setRecords] = useState<ReturnType<typeof historyFromArchive>>(
    [],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(false);
  const request = useRef(0);
  const controller = useRef<AbortController>();
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const locked = disabled || pending;
  const choose = (ids: string[]) => {
    if (locked || ids.length > 32) return;
    setSelected(ids);
    onChange({
      ids,
      history: records.map((record) => record.entry),
      pending: false,
      revision: request.current,
    });
  };
  const move = (index: number, offset: number) => {
    const ids = [...selected];
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    choose(ids);
  };
  return (
    <div className="aggregate-import">
      <FilePicker
        multiple
        label="Import group proof files"
        prompt="Choose saved proof files"
        hint="Select one or more JSON files together. Choosing again replaces this selection. Files stay on your device."
        accept="application/json,.json"
        disabled={disabled}
        onSelect={async (files) => {
          controller.current?.abort();
          const abort = new AbortController();
          controller.current = abort;
          const revision = ++request.current;
          setPending(true);
          setRecords([]);
          setSelected([]);
          setPage(0);
          setPartial(false);
          setError("");
          onChange({ ids: [], history: [], pending: true, revision });
          try {
            const result = await readArchiveFiles(
              files,
              PROGRAM_ID.toBase58(),
              {
                signal: abort.signal,
                rpc: network.endpoint,
              },
            );
            const loaded = historyFromArchive(result.archive);
            abort.signal.throwIfAborted();
            if (!loaded.length)
              throw new Error("These files contain no records to select.");
            setRecords(loaded);
            setPartial(!result.inspection.complete);
          } catch (caught) {
            if (!abort.signal.aborted) setError(errorMessage(caught));
          } finally {
            if (!abort.signal.aborted) {
              setPending(false);
              onChange({ ids: [], history: [], pending: false, revision });
            }
          }
        }}
      />
      {pending && <p role="status">Reading proof files…</p>}
      {error && <Notice error>{error}</Notice>}
      {records.length > 0 && (
        <>
          <h3>Choose records for your group</h3>
          <p>
            {records.length} records loaded. Select up to 32 in the order you
            want. Older linked records are not added automatically.
          </p>
          <Notice>
            Use the original network. A saved file does not mean its records are
            still available; check them before creating the group.
          </Notice>
          {partial && (
            <Notice>
              Some history is missing. You can choose records, but the new proof
              may be incomplete. Keep these files and add the missing history
              before relying on restoration.
            </Notice>
          )}
          {records.length <= 32 && (
            <button
              type="button"
              disabled={locked}
              onClick={() => choose(records.map((record) => record.id))}
            >
              Select all {records.length}{" "}
              {records.length === 1 ? "record" : "records"}
            </button>
          )}
          <ul
            className="aggregate-candidates"
            aria-label="Records from proof files"
          >
            {records
              .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
              .map((record) => (
                <li key={record.id}>
                  <label className="check">
                    <input
                      type="checkbox"
                      aria-label={`Select record ${record.id}`}
                      checked={selected.includes(record.id)}
                      disabled={
                        locked ||
                        (!selected.includes(record.id) && selected.length >= 32)
                      }
                      onChange={(event) =>
                        choose(
                          event.target.checked
                            ? [...selected, record.id]
                            : selected.filter((id) => id !== record.id),
                        )
                      }
                    />
                    <span>
                      <strong>
                        {record.entry.source.kind} ·{" "}
                        {timestamp(record.entry.createdAt)}
                      </strong>
                      <code>{record.id}</code>
                    </span>
                  </label>
                </li>
              ))}
          </ul>
          {records.length > PAGE_SIZE && (
            <div className="actions">
              <button
                type="button"
                disabled={locked || page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous records
              </button>
              <span>
                Page {page + 1} / {Math.ceil(records.length / PAGE_SIZE)}
              </span>
              <button
                type="button"
                disabled={locked || (page + 1) * PAGE_SIZE >= records.length}
                onClick={() => setPage(page + 1)}
              >
                Next records
              </button>
            </div>
          )}
          <h3>Group order · {selected.length} / 32</h3>
          <ol
            className="aggregate-selected"
            aria-label="Selected group members"
          >
            {selected.map((id, index) => (
              <li key={id}>
                <span className="aggregate-position">{index + 1}</span>
                <code>{id}</code>
                <div className="aggregate-order-actions">
                  <button
                    type="button"
                    aria-label={`Move member ${index + 1} up`}
                    disabled={locked || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move member ${index + 1} down`}
                    disabled={locked || index === selected.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove member ${index + 1}`}
                    disabled={locked}
                    onClick={() =>
                      choose(selected.filter((member) => member !== id))
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {!selected.length && (
            <p>Select at least one record to enable the checks.</p>
          )}
        </>
      )}
    </div>
  );
}
