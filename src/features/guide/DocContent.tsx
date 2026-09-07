import type { ReactNode } from "react";
import { ArrowUpRight, Github, Info, TriangleAlert } from "lucide-react";
import type { DocTopicId } from "./topics";

function GuideNote({
  title,
  warning = false,
  children,
}: {
  title: string;
  warning?: boolean;
  children: ReactNode;
}) {
  const Icon = warning ? TriangleAlert : Info;
  return (
    <aside
      className="docs-note"
      data-tone={warning ? "warning" : "info"}
      aria-label={title}
    >
      <Icon size={19} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

// User instructions are independent of navigation and contain no transaction logic.
const content: Record<DocTopicId, ReactNode> = {
  "getting-started": (
    <>
      <p>
        Choose a section, then a tool: <strong>Verify</strong> contains Inspect
        and Proof check; <strong>Create</strong> contains Timestamp, Branch,
        Batch / Pack and Account; <strong>History</strong> contains Merge proofs,
        Proof inspector for exploring connections, and Restore for recovering
        records.
      </p>
      <ol>
        <li>
          <strong>Choose a network.</strong> Use the same network whenever you
          save or look up a record. Check that the service is available there.
        </li>
        <li>
          <strong>Open Create → Timestamp and choose a file.</strong> The app
          calculates its fingerprint, called a hash, on your device. Your file
          is not uploaded.
        </li>
        <li>
          <strong>Check before registering.</strong> Choose “Inspect record — no
          fee” to see whether the file already has a record. No wallet is
          needed.
        </li>
        <li>
          <strong>Register with your wallet.</strong> Connect a wallet with SOL
          on the selected network and choose “Register + first vote”. Review the
          cost before approving. If the record exists, you can add a vote in
          Inspect.
        </li>
        <li>
          <strong>Keep the file and download its proof.</strong> A proof file
          saves the information needed to check the record’s history. Download
          it from Inspect or the transaction result and keep it with your
          original file.
        </li>
      </ol>
      <GuideNote title="Coming back later?">
        Select the same file in Timestamp to find its original record, or paste
        a saved record ID into Inspect. For a new version created with Branch,
        keep that version’s own record ID too. This website does not back up
        your files or saved history.
      </GuideNote>
    </>
  ),
  "how-it-works": (
    <>
      <h2>A fingerprint, not a file upload</h2>
      <p>
        A hash is a fingerprint of a file’s contents. Changing the contents
        changes the fingerprint. Hashproof records this fingerprint and a
        timestamp, so you can later compare a file with its saved record.
      </p>
      <h2>A history you can check</h2>
      <p>
        Branch connects file versions; Batch and Pack group related records.
        Saved proof files help you check their history, even when some older
        records are no longer available in the network.
      </p>
      <GuideNote title="What a timestamp does not prove" warning>
        A timestamp is evidence of a recorded fingerprint. It does not establish
        the exact time a file was created, who wrote or owns it, or whether its
        contents are true. Votes do not certify those claims either.
      </GuideNote>
      <h2>Your files stay with you</h2>
      <p>
        Original files stay on your device. Registered fingerprints and wallet
        activity are public. Someone who has a copy of a file can compare its
        fingerprint, so a timestamp is not a way to encrypt or hide a file.
      </p>
    </>
  ),
  "use-cases": (
    <>
      <ul className="docs-use-cases">
        <li>
          <strong>Document versions.</strong>
          Timestamp a draft, then use Branch with each revision to keep a
          checkable record of how it changed.
        </li>
        <li>
          <strong>Research and datasets.</strong>
          Record the version of a dataset or report used for your work. Link
          later updates without confusing them with the original.
        </li>
        <li>
          <strong>Creative work and releases.</strong>
          Keep a dated history of designs, media or software releases that
          others can compare with the files you share.
        </li>
        <li>
          <strong>Collections and handovers.</strong>
          Use Batch or Pack to group existing records for related files. Save
          their proofs with the collection, especially when using Pack.
        </li>
        <li>
          <strong>Solana account history.</strong>
          Use Account to record an account’s current state. Download its proof;
          checking the account later may show a different state.
        </li>
      </ul>
      <GuideNote title="Evidence, not a certificate">
        These workflows help you compare files and their history. They do not
        certify authorship, authenticity or the accuracy of the content.
      </GuideNote>
    </>
  ),
  branch: (
    <>
      <ol>
        <li>
          <strong>Find the previous version.</strong> In Create → Branch, enter
          its record ID or account address. The previous record must still be
          available.
        </li>
        <li>
          <strong>Choose the revised file.</strong> Wait for its fingerprint to
          be calculated. You can also paste a hash you already have.
        </li>
        <li>
          <strong>Review the new version.</strong> Use “Check parent & preview —
          no fee” to check the previous record and see the new record’s ID.
        </li>
        <li>
          <strong>Create the branch and save its proof.</strong> Approve the
          operation in your wallet. This creates a new, linked record; it does
          not overwrite the previous version.
        </li>
      </ol>
      <GuideNote title="Before withdrawing your previous vote" warning>
        This option is off by default. Removing the last vote closes the
        previous record. Save its proof before choosing this option.
      </GuideNote>
    </>
  ),
  identifiers: (
    <>
      <h2>Which value should I copy?</h2>
      <dl className="docs-definitions">
        <div>
          <dt>File hash</dt>
          <dd>
            A fingerprint of the file. Use it in Timestamp, or choose the file
            itself.
          </dd>
        </div>
        <div>
          <dt>Canonical ID</dt>
          <dd>
            The record ID shown in your results. Copy it into Inspect, Branch or
            Batch / Pack.
          </dd>
        </div>
        <div>
          <dt>Account PDA</dt>
          <dd>
            The record’s address in Solana. You can use it instead of the ID
            while the record is available.
          </dd>
        </div>
      </dl>
      <p>
        Copy values directly from the result to avoid mixing up a file hash and
        a record ID. Hash fields accept hex or Base58 text. If a lookup asks you
        to clarify the value, use the Canonical ID shown in the record’s
        details.
      </p>
      <h2>Group records with Batch or Pack</h2>
      <p>
        Open Create → Batch / Pack and choose your saved proof files, including
        combined files from Merge proofs. All records from the files are
        selected automatically, including older linked records. Uncheck any you do not
        want, then use the arrows to set their order. A group can contain at most
        32 records; if more are selected, remove the extras before continuing.
        You can also choose “Enter IDs manually” if you prefer.
      </p>
      <p>
        Use the original network and check the preview before creating the
        group. Every selected record must still be available and match your
        saved history. Changing the member order creates a different group.
      </p>
      <p>
        Batch keeps its member list visible. Pack needs your saved proofs to
        recover that list, so keep the proofs for both the group and its
        members.
      </p>
      <h2>Keep a record available with votes</h2>
      <p>
        Registering includes your first vote. Other wallets can add votes too.
        Removing the last vote closes the record. Registering it again later
        does not bring back its original timestamp; keep the original proof if
        you need to show its earlier history.
      </p>
    </>
  ),
  restore: (
    <>
      <GuideNote title="Before you start">
        Use a proof downloaded from Inspect or a transaction result. The first
        record in that proof must still exist on the original network. If it has
        been removed, you need another saved proof linking the history to a
        record that is still available.
      </GuideNote>
      <ol>
        <li>
          <strong>Open your saved proof.</strong> Select the original network,
          open History → Restore and choose the proof file. Keep your original
          file too.
        </li>
        <li>
          <strong>Load the history.</strong> Choose “Check format & load
          history”. This reads the file; it does not yet confirm that the
          history is valid.
        </li>
        <li>
          <strong>Choose what to do and check it.</strong> Leave recreation off
          to check history only, or enable it to bring back eligible older
          records. Then choose “Check proof & live state — no fee” and review
          any warnings.
        </li>
        <li>
          <strong>Confirm in your wallet.</strong> Submit only after the checks
          pass. Both choices cost transaction fees; recreating records also
          needs SOL to store them. Changing the proof or options requires
          another check.
        </li>
      </ol>
      <GuideNote title="Restore records, not lost files" warning>
        Restore cannot recover the original file or fill in missing history.
        Incomplete proofs, conflicting records or very large histories can
        prevent restoration. A passed check cannot guarantee completion if
        records change before you confirm.
      </GuideNote>
    </>
  ),
  proofs: (
    <>
      <h2>Check a file against saved history</h2>
      <p>
        Open Verify → Proof check, choose your proof file and the file you want
        to check, then click “Find file in proof”. Original and combined proof
        files are supported. The file stays on your device.
      </p>
      <p>
        The search covers saved versions and nested groups. Each match shows
        that record’s own timestamp, not the time the group was created. If the
        same file appears in several versions, all matches are listed, earliest
        first. Missing history can hide other matches.
      </p>
      <GuideNote title="A saved date still needs checking" warning>
        A match in a proof file is not network confirmation. Choose the original
        network and click “Check on network — no fee” for a matching record. A
        later record can confirm older history only when the necessary links are
        complete. An unsuccessful check does not prove the file never existed.
        These timestamps are not your device’s file creation dates.
      </GuideNote>
      <h2>Explore the connections in a proof</h2>
      <p>
        Open History → Proof inspector and choose an original or combined proof
        file. Each independent history appears as a separate graph. Circles are
        records; arrows point down to earlier records or group members. Branch
        points to its previous record; Batch and Pack split into their members.
        Numbers on the connections show member order. A shared record has one
        circle with several incoming connections.
      </p>
      <p>
        Hover or focus a circle to see its identifiers and saved timestamp.
        Click or tap for full details; close the card with its close button or
        Escape. Drag the background to move around, and scroll, pinch or use the
        zoom buttons to change scale. “Fit graph” brings the whole picture back
        into view. To locate a record, enter its address or record ID in the search
        box above the graph. For large proofs, zoom-out is limited and “Center
        graph” recentres the view. No records are removed: pan or search to reach
        the rest.
      </p>
      <GuideNote title="The tree shows only saved information">
        Missing records, unknown Pack members and missing account snapshots are
        marked separately. Missing links may connect histories that appear
        independent here. This view does not check the network or recover files.
        Each date belongs to its own record, not to the whole tree. Switching
        tools clears the inspector; reading this guide keeps it open.
      </GuideNote>
      <h2>Combine proof files</h2>
      <p>
        Bring saved proof files together into one download. Everything happens
        on your device: merging needs no wallet, network connection or fee.
      </p>
      <ol>
        <li>
          <strong>Choose your files.</strong> Open History → Merge proofs and
          select at least two saved proof files. You can add more in another
          selection.
        </li>
        <li>
          <strong>Review the list.</strong> Remove any file you do not want to
          include.
        </li>
        <li>
          <strong>Merge and check the result.</strong> Click “Merge files”.
          Repeated records are combined. Conflicting histories cannot be merged.
        </li>
        <li>
          <strong>Save the combined file.</strong> Read any missing-history
          warnings, then choose “Download merged JSON”. You can add more history
          later by merging it with other saved files.
        </li>
      </ol>
      <GuideNote title="Keep the original proof files too" warning>
        The merged download cannot be used directly in Restore. Keep the
        individual proofs from Inspect or your transaction results for that
        step. Combining files alone does not confirm their history on the
        network.
      </GuideNote>
      <h2>Before you leave</h2>
      <p>
        Download your result before reloading, closing the page or switching
        networks. Opening another tab in the workspace or reading this guide
        keeps your Merge proofs selection.
      </p>
      <p>
        You can select up to 32 files, up to 16 MiB each and 32 MiB in total.
        Some older files have smaller limits; the app will tell you if a file
        cannot be read. Your original files are never changed.
      </p>
    </>
  ),
  wallet: (
    <>
      <h2>Explore without connecting</h2>
      <p>
        Choose files, inspect records, preview changes and combine proof files
        without a wallet. Buttons marked “no fee” do not ask you to approve a
        payment.
      </p>
      <h2>Approve changes in your wallet</h2>
      <p>
        Registering, voting, creating versions or groups, and submitting Restore
        all need wallet approval and SOL on the selected network. Checking a
        record with “Verify on-chain — fee” is also a paid operation, unlike a
        lookup.
      </p>
      <p>
        Review the cost in your wallet before confirming. Creating records also
        funds their storage. If confirmation takes too long, check your wallet’s
        activity before trying again to avoid sending the same operation twice.
      </p>
      <GuideNote title="Your connection, your choice">
        The app remembers your selected wallet and tries to reconnect when you
        return. Open the Wallet menu and choose “Disconnect” to forget that
        selection. The app does not store your private keys or approval for
        future transactions. Remembering your wallet does not back up your
        proofs.
      </GuideNote>
    </>
  ),
  developers: (
    <>
      <p>
        The original Hash Timestamp smart contract and the SDK for working with
        it are available in the GitHub repository below.
      </p>
      <a
        className="docs-repository"
        href="https://github.com/binqbit/hash-timestamp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open binqbit/hash-timestamp on GitHub (opens in a new tab)"
      >
        <span className="docs-repository-icon">
          <Github size={28} aria-hidden="true" />
        </span>
        <span className="docs-repository-details">
          <span className="docs-repository-label">GitHub repository</span>
          <strong>binqbit / hash-timestamp</strong>
          <span>Smart contract & SDK</span>
          <span className="docs-repository-action">
            View on GitHub <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </span>
      </a>
    </>
  ),
};

export function DocContent({ topic }: { topic: DocTopicId }) {
  return content[topic];
}
