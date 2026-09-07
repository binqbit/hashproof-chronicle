import {
  ARCHIVE_FORMAT,
  accountPublicKey,
  archiveFromProof,
  inspectArchive,
  mergeArchives,
  parseArchive,
  stringifyArchive,
} from "../../contract/sdk";
import { errorMessage } from "../workspace/values";
import { parseProof } from "./proof-format";

// Browser admission limits; the SDK additionally validates node count and output size.
export const MAX_PROOF_FILES = 32;
export const MAX_PROOF_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_PROOF_TOTAL_BYTES = 32 * 1024 * 1024;

export function validateProofFiles(
  files: readonly Pick<File, "name" | "size">[],
) {
  if (files.length > MAX_PROOF_FILES)
    throw new Error(`Choose at most ${MAX_PROOF_FILES} files.`);
  for (const file of files)
    if (file.size > MAX_PROOF_FILE_BYTES)
      throw new Error(`${file.name}: file exceeds 16 MiB.`);
  if (
    files.reduce((total, file) => total + file.size, 0) > MAX_PROOF_TOTAL_BYTES
  )
    throw new Error("Selected files exceed 32 MiB in total.");
}

function importArchive(
  contents: string,
  defaultProgramId: string,
  rpc?: string,
) {
  const document: unknown = JSON.parse(contents);
  if (
    document &&
    typeof document === "object" &&
    "format" in document &&
    document.format === ARCHIVE_FORMAT
  ) {
    // Pass the original text so the SDK can reject duplicate JSON keys.
    const archive = parseArchive(contents);
    if (rpc !== undefined && archive.programId !== defaultProgramId)
      throw new Error("This file belongs to another program.");
    return { archive, converted: false };
  }
  const proof = parseProof(
    contents,
    rpc === undefined ? undefined : { programId: defaultProgramId, rpc },
  );
  const programId = Array.isArray(document)
    ? defaultProgramId
    : accountPublicKey(
        (document as { programId: string | number[] }).programId,
      );
  return { archive: archiveFromProof(programId, proof), converted: true };
}

/** Local file I/O only. The SDK owns graph validation, merging and serialization. */
export async function readArchiveFiles(
  files: readonly File[],
  defaultProgramId: string,
  options: { signal?: AbortSignal; rpc?: string } = {},
) {
  const { signal, rpc } = options;
  if (!files.length) throw new Error("Choose at least one proof file.");
  validateProofFiles(files);
  const archives = [];
  let inputNodes = 0;
  let convertedFiles = 0;
  let totalBytes = 0;
  for (const file of files) {
    signal?.throwIfAborted();
    try {
      const contents = await file.text();
      signal?.throwIfAborted();
      const bytes = Buffer.byteLength(contents, "utf8");
      totalBytes += bytes;
      if (bytes > MAX_PROOF_FILE_BYTES) throw new Error("File exceeds 16 MiB.");
      if (totalBytes > MAX_PROOF_TOTAL_BYTES)
        throw new Error("Files exceed 32 MiB in total.");
      const { archive, converted } = importArchive(
        contents,
        defaultProgramId,
        rpc,
      );
      inputNodes += Object.keys(archive.nodes).length;
      convertedFiles += Number(converted);
      archives.push(archive);
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error(`${file.name}: ${errorMessage(error)}`);
    }
  }
  signal?.throwIfAborted();
  const archive = mergeArchives(archives[0], ...archives.slice(1));
  return {
    archive,
    inspection: inspectArchive(archive),
    inputNodes,
    convertedFiles,
  };
}

export async function mergeProofFiles(
  files: readonly File[],
  defaultProgramId: string,
  signal?: AbortSignal,
) {
  if (files.length < 2)
    throw new Error("Choose at least two proof files to merge.");
  const result = await readArchiveFiles(files, defaultProgramId, { signal });
  return { ...result, json: stringifyArchive(result.archive) };
}

export type MergedProofFiles = Awaited<ReturnType<typeof mergeProofFiles>>;
