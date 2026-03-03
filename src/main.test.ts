import { describe, expect, test } from "bun:test";

type Brand<K, T> = K & { __brand: T };

type SnapshotFileStatus = "to_review" | "reviewed" | "deleted";

type File = Brand<
  {
    path: string;
    status: SnapshotFileStatus;
  },
  "File"
>;

const toFile = (file: { path: string }, status: SnapshotFileStatus): File => {
  return {
    path: file.path,
    status: status,
  } as File;
};

describe("toFile", () => {
  test("creates a File with to_review status", () => {
    const result = toFile({ path: "notes/test.md" }, "to_review");
    expect(result.path).toBe("notes/test.md");
    expect(result.status).toBe("to_review");
  });

  test("creates a File with reviewed status", () => {
    const result = toFile({ path: "test.md" }, "reviewed");
    expect(result.status).toBe("reviewed");
  });

  test("creates a File with deleted status", () => {
    const result = toFile({ path: "old.md" }, "deleted");
    expect(result.status).toBe("deleted");
  });
});

describe("getToReviewFiles", () => {
  function getToReviewFiles(files: File[]): File[] {
    return files.filter((file) => file.status === "to_review");
  }

  test("filters to only to_review files", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "to_review"),
      toFile({ path: "b.md" }, "reviewed"),
      toFile({ path: "c.md" }, "to_review"),
      toFile({ path: "d.md" }, "deleted"),
    ];

    const result = getToReviewFiles(files);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.path)).toEqual(["a.md", "c.md"]);
  });

  test("returns empty array when no files to review", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "reviewed"),
      toFile({ path: "b.md" }, "deleted"),
    ];

    expect(getToReviewFiles(files)).toHaveLength(0);
  });

  test("returns empty for empty snapshot", () => {
    expect(getToReviewFiles([])).toHaveLength(0);
  });
});

describe("getSnapshotFile", () => {
  function getSnapshotFile(files: File[], path: string): File | undefined {
    return files.find((f) => f.path === path);
  }

  test("finds file by path", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "to_review"),
      toFile({ path: "b.md" }, "reviewed"),
    ];

    const result = getSnapshotFile(files, "b.md");
    expect(result?.status).toBe("reviewed");
  });

  test("returns undefined for missing path", () => {
    const files: File[] = [toFile({ path: "a.md" }, "to_review")];

    expect(getSnapshotFile(files, "missing.md")).toBeUndefined();
  });
});

describe("snapshot statistics", () => {
  function computeStats(snapshotFiles: File[], allVaultFilesCount: number) {
    const snapshotFilesLength = snapshotFiles.length;
    const deletedFilesLength = snapshotFiles.filter(
      (f) => f.status === "deleted",
    ).length;
    const reviewedFilesLength = snapshotFiles.filter(
      (f) => f.status === "reviewed",
    ).length;
    const toReviewFilesLength =
      snapshotFilesLength - reviewedFilesLength - deletedFilesLength;
    const activeFilesLength = snapshotFilesLength - deletedFilesLength;
    const percentSnapshotCompleted = activeFilesLength
      ? Math.round((reviewedFilesLength / activeFilesLength) * 100)
      : 0;
    const percentSnapshotDeleted = snapshotFilesLength
      ? Math.round((deletedFilesLength / snapshotFilesLength) * 100)
      : 0;
    const notInSnapshotLength =
      allVaultFilesCount - snapshotFilesLength + deletedFilesLength;

    return {
      snapshotFilesLength,
      deletedFilesLength,
      reviewedFilesLength,
      toReviewFilesLength,
      activeFilesLength,
      percentSnapshotCompleted,
      percentSnapshotDeleted,
      notInSnapshotLength,
    };
  }

  test("computes correct stats for mixed snapshot", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "reviewed"),
      toFile({ path: "b.md" }, "to_review"),
      toFile({ path: "c.md" }, "to_review"),
      toFile({ path: "d.md" }, "deleted"),
      toFile({ path: "e.md" }, "reviewed"),
    ];

    const stats = computeStats(files, 10);
    expect(stats.snapshotFilesLength).toBe(5);
    expect(stats.deletedFilesLength).toBe(1);
    expect(stats.reviewedFilesLength).toBe(2);
    expect(stats.toReviewFilesLength).toBe(2);
    expect(stats.activeFilesLength).toBe(4);
    expect(stats.percentSnapshotCompleted).toBe(50);
    expect(stats.percentSnapshotDeleted).toBe(20);
    expect(stats.notInSnapshotLength).toBe(6);
  });

  test("handles empty snapshot", () => {
    const stats = computeStats([], 10);
    expect(stats.percentSnapshotCompleted).toBe(0);
    expect(stats.percentSnapshotDeleted).toBe(0);
    expect(stats.notInSnapshotLength).toBe(10);
  });

  test("handles fully reviewed snapshot", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "reviewed"),
      toFile({ path: "b.md" }, "reviewed"),
    ];

    const stats = computeStats(files, 2);
    expect(stats.percentSnapshotCompleted).toBe(100);
    expect(stats.toReviewFilesLength).toBe(0);
  });

  test("handles all deleted snapshot", () => {
    const files: File[] = [
      toFile({ path: "a.md" }, "deleted"),
      toFile({ path: "b.md" }, "deleted"),
    ];

    const stats = computeStats(files, 5);
    expect(stats.percentSnapshotCompleted).toBe(0);
    expect(stats.percentSnapshotDeleted).toBe(100);
  });
});

describe("file rename logic", () => {
  test("updates path of snapshot file", () => {
    const file = toFile({ path: "old/path.md" }, "to_review");
    file.path = "new/path.md";
    expect(file.path).toBe("new/path.md");
    expect(file.status).toBe("to_review");
  });
});

describe("file delete logic", () => {
  test("marks file as deleted", () => {
    const file = toFile({ path: "test.md" }, "to_review");
    file.status = "deleted";
    expect(file.status).toBe("deleted");
  });
});

describe("DEFAULT_SETTINGS", () => {
  const DEFAULT_SETTINGS = {
    settings: {
      showStatusBar: true,
    },
  };

  test("has correct defaults", () => {
    expect(DEFAULT_SETTINGS.settings.showStatusBar).toBe(true);
  });

  test("no snapshot by default", () => {
    expect(
      (DEFAULT_SETTINGS as { snapshot?: unknown }).snapshot,
    ).toBeUndefined();
  });
});
