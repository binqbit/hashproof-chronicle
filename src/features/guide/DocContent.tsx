import type { ReactNode } from "react";
import type { DocTopicId } from "./topics";

// User instructions are independent of navigation and contain no transaction logic.
const content: Record<DocTopicId, ReactNode> = {
  "getting-started": (
    <>
      <ol>
        <li>
          <strong>Choose a network.</strong> Use the same network for
          registration and later lookups. The program must be available there.
        </li>
        <li>
          <strong>Open Timestamp and choose a file.</strong> SHA-256 is
          calculated in your browser. You can also paste a raw 32-byte digest.
          File contents are not uploaded.
        </li>
        <li>
          <strong>Inspect before registering.</strong> The screen derives the
          canonical ID and account PDA. Use “Inspect record — no fee” to check
          whether that record is already live.
        </li>
        <li>
          <strong>Connect a funded wallet to register.</strong> “Register +
          first vote” needs rent and transaction fees on the selected network.
          If the record exists, use Inspect to add your vote instead.
        </li>
        <li>
          <strong>Keep the file and download its proof.</strong> Save proof JSON
          from Inspect or the confirmed receipt. This website is not a backup:
          retained history disappears on reload, closing the page or switching
          networks.
        </li>
        <li>
          <strong>Check it later.</strong> Inspect accepts the canonical ID or
          live record PDA without a wallet. For an original Timestamp record,
          select the file in Timestamp again to recompute its identity. Branch
          records have their own derived identities.
        </li>
      </ol>
    </>
  ),
  "how-it-works": (
    <>
      <p>
        A file digest is a fingerprint of its bytes. The contract records a
        commitment on Solana, while branches and aggregates link historical
        records together. This gives other people a way to check a retained
        history without relying only on editable file metadata.
      </p>
      <p>
        The evidence concerns a historical commitment and its linked timestamps.
        It does not establish the exact moment a file was created, who authored
        or owns it, or whether its contents are true. Votes help keep a record
        live; they do not certify those claims.
      </p>
      <p>
        Files stay on your device, but submitted commitments and wallet
        transactions are public. Someone with a candidate file can compare its
        digest. Do not treat a public hash as encryption.
      </p>
    </>
  ),
  "use-cases": (
    <>
      <ul>
        <li>
          <strong>Document versions.</strong> Timestamp a draft, then use Branch
          with its ID or PDA and the revised file to keep versions linked.
        </li>
        <li>
          <strong>Research and datasets.</strong> Record a dataset or report
          digest and link subsequent revisions. This records commitments, not
          the accuracy of the research.
        </li>
        <li>
          <strong>Creative work and releases.</strong> Keep a checkable history
          of designs, media or software artifacts. A timestamp alone does not
          establish authorship or authenticity.
        </li>
        <li>
          <strong>Collections and handovers.</strong> Group related live records
          with Batch or Pack. Retain the exact member history, especially for a
          Pack.
        </li>
        <li>
          <strong>Solana account history.</strong> Use Account to commit an
          account snapshot. Keep the captured metadata and bytes; a later state
          may differ.
        </li>
      </ul>
    </>
  ),
  branch: (
    <>
      <ol>
        <li>Enter the previous live record’s canonical ID or PDA in Branch.</li>
        <li>
          Choose the new file version, or paste its digest. Wait for local
          hashing to finish.
        </li>
        <li>
          Use “Check parent & preview — no fee” to resolve the parent and
          preview the new branch ID and PDA.
        </li>
        <li>
          Connect your wallet and create the branch, then save its proof. The
          child is a new record; it does not overwrite the parent.
        </li>
      </ol>
      <p>
        Parent-vote withdrawal is optional and off by default. If enabled, it
        can close the parent when your vote is the last one. Retain the parent
        history before doing this.
      </p>
    </>
  ),
  identifiers: (
    <>
      <p>
        A <strong>raw hash</strong> is a file digest or another 32-byte value. A{" "}
        <strong>canonical ID</strong> is the protocol identity, shown as 64
        hexadecimal characters. An <strong>account PDA</strong> is its base58
        Solana address. Inspect, Branch and Batch / Pack accept IDs or PDAs, not
        an unconverted raw file digest.
      </p>
      <p>
        Hash inputs accept hex or Base58. Results and SDK archives use lowercase
        hex for hashes/IDs and Base58 for public keys/PDAs. In record lookups,
        bare hex means an ID; Base58 is checked as both an ID and a PDA. Use
        <code>id:</code> or <code>pda:</code> before either encoding to specify
        its type. A missing Base58 ID needs <code>id:</code>; a closed PDA alone
        cannot reveal its historical ID.
      </p>
      <p>
        Batch and Pack take ordered live members; changing their order changes
        the result. Batch stores member IDs; Pack stores a digest of member
        fingerprints, so it cannot reveal a missing member list. Check the
        members and save their history before creating an aggregate.
      </p>
      <p>
        Registration creates a first vote. Other wallets can add their own
        votes. Withdrawing the last vote closes the record. Re-registering the
        same identity later can create a different historical timestamp; an ID
        alone does not distinguish these incarnations.
      </p>
    </>
  ),
  restore: (
    <>
      <ol>
        <li>
          Keep proof JSON and any original account snapshots before records
          close. A closed PDA cannot reveal its former identity or history.
        </li>
        <li>
          Open Restore on the matching network. Import proof JSON and use “Check
          format & load history”. Parsing is not proof verification.
        </li>
        <li>
          Place the surviving live anchor at entry zero. Other entries need not
          be topologically ordered, but must form the required connected
          history.
        </li>
        <li>
          Use “Check proof & live state — no fee”. This checks commitments,
          dependencies, live accounts and transaction size without signing.
        </li>
        <li>
          Choose proof-only validation or account recreation, then submit with
          your wallet. Both pay fees; recreation also needs rent where
          applicable.
        </li>
      </ol>
      <p>
        Restore validates supplied history against the live anchor; it cannot
        recover file contents or invent missing proof data. Occupied records
        with a different historical incarnation can block recreation. A partial
        export may need more history, and large proofs may not fit one
        transaction. A successful preflight is not a guarantee of success if
        on-chain state changes before submission.
      </p>
    </>
  ),
  proofs: (
    <>
      <ol>
        <li>
          Open the Proofs tab. Choose at least two JSON files together, or add
          them in several selections.
        </li>
        <li>Review the file list and remove anything you do not want to include.</li>
        <li>
          Click “Merge files”. Matching nodes are combined; contradictory
          history or different program IDs stop the merge.
        </li>
        <li>
          Review the node count and any missing-history warnings, then click
          “Download merged JSON”. Keep the downloaded file as your backup.
        </li>
      </ol>
      <p>
        SDK archives and legacy proof exports from this frontend are accepted.
        Legacy proof arrays use the app's program ID; envelopes keep their own
        program ID. Legacy files must contain the nodes needed to check any
        supplied fingerprints. Nothing is fetched or invented to fill gaps.
      </p>
      <p>
        A partial SDK archive is still useful: save it and merge more history
        later. The file picker allows up to 32 files, 16 MiB per file and 32 MiB
        total. Legacy proof inputs retain their 2 MB / 64-entry limit. The SDK
        checks the resulting archive's 16 MiB / 10,000-node limit.
      </p>
      <p>
        The output uses <code>hash-timestamp-archive</code>, with hex hashes and
        Base58 addresses. It does not store RPC metadata or file names, and
        local validation is not an on-chain existence proof. No wallet, network
        connection or transaction is required for merging.
      </p>
      <p>
        Use the SDK archive planner for restoration from this file. The Restore
        tab still accepts legacy proof chains, not SDK archives. Check the
        original network before using any history on-chain. File selections and
        results remain when switching operation tabs or opening Docs, but are
        cleared on reload or network changes.
      </p>
    </>
  ),
  wallet: (
    <>
      <p>
        Hashing, lookups and read-only previews need no wallet signature.
        Buttons marked “on-chain” or “fee” send a transaction and require wallet
        approval. An on-chain verification is different from a free RPC lookup.
      </p>
      <p>
        Your wallet selection is remembered for reconnection on reload;
        authorization remains controlled by the wallet. “Disconnect wallet”
        forgets that selection. The app does not store private keys or
        transaction approvals. Proof history is not saved with the connection.
      </p>
    </>
  ),
  developers: (
    <>
      <p>
        The frontend uses the Hash Timestamp SDK for identities, account
        decoding and instructions. The contract repository documents the SDK,
        instructions and proof formats.
      </p>
      <ul>
        <li>
          <a
            href="https://github.com/binqbit/hash-timestamp"
            target="_blank"
            rel="noreferrer"
          >
            Smart contract, SDK and instruction reference
          </a>
        </li>
      </ul>
    </>
  ),
};

export function DocContent({ topic }: { topic: DocTopicId }) {
  return content[topic];
}
