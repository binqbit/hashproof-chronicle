// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { useFileDigest } from "../../src/features/records/use-file-digest";
import * as values from "../../src/features/workspace/values";

const file = (name = "file.txt") =>
  new File(["contents"], name) as unknown as globalThis.File;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("hashes a chosen file and detaches the filename after a manual edit", async () => {
  const { result } = renderHook(useFileDigest);
  await act(() => result.current.selectFile(file()));
  expect(result.current.value).toBe(
    createHash("sha256").update("contents").digest("hex"),
  );
  expect(result.current.fileName).toBe("file.txt");
  expect(result.current.hashing).toBe(false);
  act(() => result.current.setValue("ab".repeat(32)));
  expect(result.current.fileName).toBe("");
  expect(result.current.value).toBe("ab".repeat(32));
});

it("clears an old digest while hashing and ignores a replaced file's late result", async () => {
  let finish!: (digest: string) => void;
  const hash = vi
    .spyOn(values, "hashFile")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue("bb".repeat(32));
  const { result } = renderHook(useFileDigest);
  act(() => result.current.setValue("ab".repeat(32)));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.selectFile(file("old.txt"));
  });
  expect(result.current.value).toBe("");
  expect(result.current.hashing).toBe(true);
  await act(() => result.current.selectFile(file("new.txt")));
  expect(hash.mock.calls[0][2]?.aborted).toBe(true);
  await act(async () => {
    finish("aa".repeat(32));
    await pending;
  });
  expect(result.current.value).toBe("bb".repeat(32));
  expect(result.current.fileName).toBe("new.txt");
});

it("cancels progress and prevents a late hash from overwriting manual input", async () => {
  let finish!: (digest: string) => void;
  const hash = vi.spyOn(values, "hashFile").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(useFileDigest);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.selectFile(file());
  });
  act(() => result.current.setValue("manual"));
  expect(hash.mock.calls[0][2]?.aborted).toBe(true);
  await act(async () => {
    hash.mock.calls[0][1]?.(100);
    finish("aa".repeat(32));
    await pending;
  });
  expect(result.current.value).toBe("manual");
  expect(result.current.fileName).toBe("");
  expect(result.current.hashing).toBe(false);
  expect(result.current.error).toBe("");
});

it("shows file read failures without retaining a stale digest and allows retry", async () => {
  vi.spyOn(values, "hashFile")
    .mockRejectedValueOnce(new Error("Cannot read file"))
    .mockResolvedValueOnce("bb".repeat(32));
  const { result } = renderHook(useFileDigest);
  act(() => result.current.setValue("ab".repeat(32)));
  await act(() => result.current.selectFile(file()));
  expect(result.current.error).toBe("Cannot read file");
  expect(result.current.value).toBe("");
  expect(result.current.hashing).toBe(false);
  await act(() => result.current.selectFile(file()));
  expect(result.current.error).toBe("");
  expect(result.current.value).toBe("bb".repeat(32));
});

it("aborts outstanding file reads when leaving the screen", async () => {
  let finish!: (digest: string) => void;
  const hash = vi.spyOn(values, "hashFile").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, unmount } = renderHook(useFileDigest);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.selectFile(file());
  });
  unmount();
  expect(hash.mock.calls[0][2]?.aborted).toBe(true);
  finish("aa".repeat(32));
  await pending;
});
