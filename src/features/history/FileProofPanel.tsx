import { useEffect, useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { PROGRAM_ID } from "../../contract/client";
import { useNetwork } from "../../contract/network";
import { useContract } from "../workspace/use-contract";
import { useFileDigest } from "../records/use-file-digest";
import { FilePicker } from "../workspace/FilePicker";
import { Identifier, Notice } from "../workspace/fields";
import { errorMessage, timestamp } from "../workspace/values";
import { readArchiveFiles } from "./archive-files";
import {
  checkFileProof,
  findFileInArchive,
  type FileProofCheck,
} from "./file-proof";
import "./file-proof.css";

const PAGE_SIZE = 20;

export function FileProofPanel() {
  const { network, busy } = useNetwork();
  const { client } = useContract();
  const digest = useFileDigest();
  const [proof, setProof] = useState<Awaited<
    ReturnType<typeof readArchiveFiles>
  > | null>(null);
  const [proofName, setProofName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReturnType<
    typeof findFileInArchive
  > | null>(null);
  const [page, setPage] = useState(0);
  const [checks, setChecks] = useState<Record<string, FileProofCheck>>({});
  const [checking, setChecking] = useState("");
  const importJob = useRef<AbortController>();
  const checkJob = useRef<AbortController>();
  useEffect(
    () => () => {
      importJob.current?.abort();
      checkJob.current?.abort();
    },
    [],
  );

  const clearResults = () => {
    checkJob.current?.abort();
    setChecking("");
    setChecks({});
    setResult(null);
    setPage(0);
    setError("");
  };
  const loadProof = async (file: File) => {
    importJob.current?.abort();
    const job = new AbortController();
    importJob.current = job;
    clearResults();
    setProof(null);
    setProofName(file.name);
    setReading(true);
    try {
      const loaded = await readArchiveFiles([file], PROGRAM_ID.toBase58(), {
        rpc: network.endpoint,
        signal: job.signal,
      });
      if (!job.signal.aborted) setProof(loaded);
    } catch (caught) {
      if (!job.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!job.signal.aborted) setReading(false);
    }
  };
  const canSearch =
    !!proof && !!digest.value && !reading && !digest.hashing && !busy;
  const search = () => {
    if (!canSearch) return;
    clearResults();
    try {
      setResult(findFileInArchive(proof.archive, digest.value));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  const check = async (pda: string) => {
    if (!result || checking || busy) return;
    const job = new AbortController();
    checkJob.current?.abort();
    checkJob.current = job;
    setChecking(pda);
    setChecks((previous) => {
      const next = { ...previous };
      delete next[pda];
      return next;
    });
    try {
      const value = await checkFileProof(
        client,
        result.archive,
        result.digest,
        pda,
        job.signal,
      );
      if (!job.signal.aborted)
        setChecks((previous) => ({ ...previous, [pda]: value }));
    } catch (caught) {
      if (!job.signal.aborted)
        setChecks((previous) => ({
          ...previous,
          [pda]: { matched: false, checked: 0, message: errorMessage(caught) },
        }));
    } finally {
      if (!job.signal.aborted) setChecking("");
    }
  };

  return (
    <section className="panel" aria-labelledby="file-proof-heading">
      <div className="section-heading">
        <FileCheck2 aria-hidden="true" />
        <div>
          <h2 id="file-proof-heading">Check a file against its proof</h2>
          <p>Find a file’s saved timestamps across versions and groups.</p>
        </div>
      </div>
      <FilePicker
        label="Proof file to search"
        prompt="Choose a proof file"
        hint="Original or combined JSON proof. Read locally, up to 16 MiB."
        accept="application/json,.json"
        fileName={proofName}
        disabled={busy}
        onSelect={(file) => void loadProof(file)}
      />
      <FilePicker
        label="File to check"
        prompt="Choose the original file or a version"
        hint="Its fingerprint is calculated on your device. The file is not uploaded."
        fileName={digest.fileName}
        disabled={busy}
        onSelect={(file) => {
          clearResults();
          void digest.selectFile(file);
        }}
      />
      {reading && <p role="status">Reading proof file…</p>}
      {digest.hashing && <p role="status">Hashing file… {digest.progress}%</p>}
      {(error || digest.error) && (
        <Notice error>{error || digest.error}</Notice>
      )}
      {digest.value && <Identifier label="File SHA-256" value={digest.value} />}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!canSearch}
          onClick={search}
        >
          Find file in proof
        </button>
      </div>
      {result && (
        <div className="file-proof-results" aria-label="File proof results">
          <h3>
            {result.matches.length
              ? "File found in saved history"
              : "File not found in this proof"}
          </h3>
          <p role="status">
            {result.matches.length} matching{" "}
            {result.matches.length === 1 ? "record" : "records"}. The whole
            supplied history was searched, including Branch, Batch and Pack
            records.
          </p>
          {!result.inspection.complete && (
            <Notice>
              Some history is missing. A file absent from these records may
              still be present in missing parts of the proof.
            </Notice>
          )}
          {!!result.matches.length && (
            <Notice>
              A saved timestamp alone is not network confirmation. Check a
              record below using its original network. These are not the file’s
              creation time on your device.
            </Notice>
          )}
          {result.matches
            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
            .map((match) => {
              const checked = checks[match.pda];
              return (
                <article
                  className="identity-box file-proof-match"
                  key={match.pda}
                  aria-label={`Match ${match.id}`}
                >
                  <span className="eyebrow">
                    {match.kind === "hash"
                      ? "File timestamp"
                      : "Branch version"}
                  </span>
                  <h4 className="file-proof-time">
                    {timestamp(match.createdAt)}
                  </h4>
                  <Identifier label="Record ID" value={match.id} />
                  <Identifier label="Account address" value={match.pda} />
                  <button
                    type="button"
                    disabled={busy || !!checking}
                    onClick={() => void check(match.pda)}
                  >
                    {checking === match.pda
                      ? "Checking network…"
                      : "Check on network — no fee"}
                  </button>
                  {checked && (
                    <div
                      className={
                        checked.matched ? "file-proof-confirmed" : "notice"
                      }
                      role="status"
                    >
                      <strong>
                        {checked.matched
                          ? "Matches live history"
                          : "Not confirmed"}{" "}
                        · {network.label}
                      </strong>
                      <p>{checked.message}</p>
                      {checked.anchor && (
                        <Identifier
                          label={`Live ${checked.anchorKind} record`}
                          value={checked.anchor}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          {result.matches.length > PAGE_SIZE && (
            <div className="actions">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous matches
              </button>
              <span>
                Page {page + 1} / {Math.ceil(result.matches.length / PAGE_SIZE)}
              </span>
              <button
                type="button"
                disabled={(page + 1) * PAGE_SIZE >= result.matches.length}
                onClick={() => setPage(page + 1)}
              >
                Next matches
              </button>
            </div>
          )}
        </div>
      )}
      <p className="fine-print">
        No wallet or fee. Searching is local; the optional network check only
        reads records. Nothing is restored or sent as a transaction.
      </p>
    </section>
  );
}
