import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WalletControls } from "../../components/WalletControls";
import { Fingerprint, ExternalLink, Download } from "lucide-react";
import { PROGRAM_ID, PROGRAM_VERSION } from "../../contract/client";
import { explorerUrl, useNetwork } from "../../contract/network";
import {
  deriveGenesisHashId,
  type RestoreProofInput,
} from "../../contract/sdk";
import { RegisterPanel } from "../records/RegisterPanel";
import { RecordPanel } from "../records/RecordPanel";
import { AccountPanel } from "../records/AccountPanel";
import { AggregatePanel } from "../records/AggregatePanel";
import { BranchPanel } from "../records/BranchPanel";
import { RestorePanel } from "../history/RestorePanel";
import { ProofsPanel } from "../history/ProofsPanel";
import { FileProofPanel } from "../history/FileProofPanel";
import { ProofInspectorPanel } from "../history/ProofInspectorPanel";
import { DocsLink } from "../guide/DocsLink";
import { NetworkPicker } from "../../components/NetworkPicker";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";
import { mergeHistory } from "../history/collect-proof";
import { downloadJson, proofJson } from "../history/proof-format";
import { Notice } from "./fields";
import { errorMessage, hashInput, hex } from "./values";
import { useContract, useTransaction } from "./use-contract";
import { register, type Receipt } from "./operations";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import type { WorkspaceTool } from "./navigation";

/** Changing RPC discards only transient UI state, never on-chain records. */
export default function Workspace() {
  const { network } = useNetwork();
  return <NetworkWorkspace key={network.endpoint} />;
}

function NetworkWorkspace() {
  const { network, networks, setNetwork, busy } = useNetwork();
  const { wallet, availability } = useContract();
  const navigate = useNavigate();
  const location = useLocation();
  const route = location.pathname.match(/^\/records\/([a-f0-9]{64})$/i);
  // Old shared links contained a raw Hash-source digest, not a canonical ID.
  const legacy = location.pathname.match(/^\/hash\/([a-f0-9]{64})$/i);
  const selected =
    route?.[1].toLowerCase() ||
    (legacy ? hex(deriveGenesisHashId(hashInput(legacy[1]))) : "");
  const [tab, setTab] = useState<WorkspaceTool>("records");
  const [history, setHistory] = useState<RestoreProofInput[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: "network"; key: string; open: boolean }
    | { kind: "clear"; open: boolean }
    | null
  >(null);
  const transaction = useTransaction((confirmed) => {
    // History conflicts are not transaction failures. Always retain the confirmed receipt.
    let next = confirmed;
    if (confirmed.proof) {
      try {
        setHistory(mergeHistory(history, confirmed.proof));
      } catch (error) {
        next = {
          ...confirmed,
          warning: [
            confirmed.warning,
            errorMessage(error),
            "Download this proof separately.",
          ]
            .filter(Boolean)
            .join(" "),
        };
      }
    }
    setReceipt(next);
  });
  const disabled =
    busy || !wallet || availability.data !== true || availability.isError;
  const inspect = (id: string) => {
    navigate(`/records/${id}`);
    setTab("records");
  };
  const retain = (proof: RestoreProofInput[]) =>
    setHistory(mergeHistory(history, proof));
  const props = { disabled, selected, history, run: transaction.run };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="/"
          aria-label="Hashproof home"
          onClick={(event) => {
            event.preventDefault();
            if (!busy) {
              navigate("/");
              setTab("records");
            }
          }}
        >
          <span className="brand-mark">
            <Fingerprint />
          </span>
          <span>
            Hashproof<small>HASH TIMESTAMP · v{PROGRAM_VERSION}</small>
          </span>
        </a>
        <div className="connection-controls">
          <NetworkPicker
            id="network-selector"
            value={network.key}
            options={networks}
            disabled={busy}
            onChange={(key) => {
              if (!history.length) setNetwork(key);
              else setConfirmation({ kind: "network", key, open: true });
            }}
          />
          <WalletControls />
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <span className="eyebrow">A VERIFIABLE HISTORY</span>
            <h1>
              Files change.
              <br />
              <span>Evidence stays connected.</span>
            </h1>
            <p>
              Record a commitment, build its history, and verify the links on
              Solana. Your files stay with you.
            </p>
            <DocsLink disabled={busy} />
          </div>
          <div className="protocol-note">
            <span
              className={`status-dot ${availability.data && !availability.isError ? "online" : ""}`}
            />
            <strong>
              {availability.isError
                ? "RPC unavailable"
                : availability.isPending
                  ? "Connecting to RPC…"
                  : availability.data
                    ? "Program available"
                    : "Program not deployed"}
            </strong>
            <span>{network.label}</span>
            <code>{network.endpoint}</code>
          </div>
        </section>
        {availability.isError && (
          <Notice error>
            Cannot read this RPC: {errorMessage(availability.error)}. File
            hashing and proof import still work offline.
          </Notice>
        )}
        {availability.isSuccess && !availability.data && (
          <Notice>
            The configured program is not deployed on this network. Start the
            local stack or select a network where it is deployed.
          </Notice>
        )}
        {!wallet && (
          <p className="wallet-hint">
            No wallet needed to hash files or inspect records. Connect a wallet
            to submit transactions.
          </p>
        )}
        <WorkspaceNavigation selected={tab} disabled={busy} onSelect={setTab} />
        {busy && (
          <Notice>
            <span role="status">
              {transaction.pendingLabel} — waiting for wallet approval / chain
              confirmation. Keep this page open.
            </span>
          </Notice>
        )}
        {transaction.error && <Notice error>{transaction.error}</Notice>}
        <div className="workspace-grid">
          <div>
            {tab === "register" && (
              <RegisterPanel
                disabled={disabled}
                onRegister={(hash) =>
                  void transaction.run("Register timestamp", (client) =>
                    register(client, hash),
                  )
                }
                onInspect={inspect}
              />
            )}
            {tab === "records" && (
              <RecordPanel
                key={selected}
                {...props}
                onSelect={inspect}
                onProof={retain}
                onAction={(action, id) =>
                  void transaction.run(
                    action === "verify"
                      ? "Verify record"
                      : action === "vote"
                        ? "Add vote"
                        : "Withdraw vote",
                    async (client) => ({
                      signature: await client[action](id),
                      ids: [id],
                    }),
                  )
                }
              />
            )}
            {tab === "branch" && <BranchPanel {...props} />}
            {tab === "aggregate" && <AggregatePanel {...props} />}
            {tab === "account" && <AccountPanel {...props} />}
            {tab === "proof-check" && <FileProofPanel />}
            {tab === "proof-inspector" && <ProofInspectorPanel />}
            {tab === "restore" && (
              <RestorePanel {...props} onHistory={retain} />
            )}
            <div hidden={tab !== "proofs"}>
              <ProofsPanel />
            </div>
          </div>
          <aside className="sidebar">
            <section className="panel guide">
              <h2>Three different identifiers</h2>
              <ol>
                <li>
                  <strong>Raw hash</strong>
                  <span>The digest of a file, or another 32-byte value.</span>
                </li>
                <li>
                  <strong>Canonical ID</strong>
                  <span>
                    The protocol identity, derived from the stored hash and
                    source kind. Use this for operations.
                  </span>
                </li>
                <li>
                  <strong>Account PDA</strong>
                  <span>The Solana address where a live record is stored.</span>
                </li>
              </ol>
            </section>
            <section className="panel guide">
              <h2>Keep your proof</h2>
              <p>
                {history.length} historical entries retained in this tab's
                memory.
              </p>
              <p>
                Download proofs before closing the page, switching networks or
                removing votes. Packs need retained member fingerprints; account
                records need their original snapshots.
              </p>
              <p className="fine-print">
                An imported proof is data, not automatically a verified claim.
                Conflicting historical incarnations must be kept separately.
              </p>
              {!!history.length && (
                <button
                  id="clear-history"
                  disabled={busy}
                  onClick={() => setConfirmation({ kind: "clear", open: true })}
                >
                  Clear retained history
                </button>
              )}
            </section>
          </aside>
        </div>
        {receipt && (
          <section
            className="panel receipt"
            aria-label="Last confirmed transaction"
          >
            <div className="record-heading">
              <h2>Last confirmed transaction</h2>
              <a
                href={explorerUrl(network, "tx", receipt.signature)}
                target="_blank"
                rel="noreferrer"
              >
                Explorer <ExternalLink size={14} />
              </a>
            </div>
            <code className="break-anywhere">{receipt.signature}</code>
            <div className="actions">
              {receipt.ids.map((id) => (
                <button key={id} disabled={busy} onClick={() => inspect(id)}>
                  Inspect {id.slice(0, 12)}…
                </button>
              ))}
              {receipt.proof && (
                <button
                  onClick={() =>
                    downloadJson(
                      `proof-${receipt.ids[0]?.slice(0, 12) || "history"}.json`,
                      proofJson(
                        receipt.proof!,
                        PROGRAM_ID.toBase58(),
                        network.endpoint,
                      ),
                    )
                  }
                >
                  <Download size={15} />
                  Download proof JSON
                </button>
              )}
            </div>
            {receipt.warning && <Notice>{receipt.warning}</Notice>}
            {receipt.proof && (
              <p className="fine-print">
                Save this file. History is not persisted by this website.
              </p>
            )}
          </section>
        )}
      </main>
      <footer>
        <p>
          Proves a historical commitment, not file creation time, authorship or
          ownership.
        </p>
        <details>
          <summary>Program & connection</summary>
          <code>{PROGRAM_ID.toBase58()}</code>
          <p>{network.endpoint}</p>
        </details>
      </footer>
      <ConfirmationDialog
        open={confirmation?.open ?? false}
        onOpenChange={(open) => {
          // Keep content and focus metadata intact through the close animation.
          setConfirmation((current) => current && { ...current, open });
        }}
        title={
          confirmation?.kind === "network"
            ? "Switch networks?"
            : "Clear retained history?"
        }
        description={
          confirmation?.kind === "network"
            ? "Download any needed proofs first; in-memory history will be cleared. Saved files and on-chain records are unaffected."
            : "Clear history from this tab? Download any needed proof first. Saved files and on-chain records are unaffected."
        }
        confirmLabel={
          confirmation?.kind === "network" ? "Switch network" : "Clear history"
        }
        disabled={busy}
        returnFocusId={
          confirmation?.kind === "network"
            ? "network-selector"
            : "clear-history"
        }
        onConfirm={() => {
          if (busy || !confirmation?.open) return;
          const action = confirmation;
          setConfirmation({ ...action, open: false });
          if (action.kind === "network") setNetwork(action.key);
          else setHistory([]);
        }}
      />
    </div>
  );
}
