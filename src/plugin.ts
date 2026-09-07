import {
  Notice,
  Plugin,
  type TAbstractFile,
  type TFile,
  TFolder,
} from "obsidian";
import {
  CURRENT_SCHEMA_VERSION,
  migrateV1toV2,
  normalizeData,
  type PluginData,
  type SavedData,
} from "./data";
import { ConfirmResetModal, ReviewMenuModal } from "./modals";
import { isExcluded, ReviewState, type ReviewStats } from "./reviewState";
import { ReviewSettingTab } from "./settingsTab";
import { StatusBar } from "./statusBar";

export default class ReviewPlugin extends Plugin {
  data!: PluginData;
  private state = new ReviewState();
  statusBar!: StatusBar;

  /**
   * Why writing is refused, or null when it is allowed. Set on every path
   * through loadSettings: data we failed to read must not be overwritten by
   * the defaults we fell back to, and data from a newer plugin version must
   * not be truncated to what this version understands.
   */
  private saveBlocked: string | null = null;

  /** Tail of the serialized write queue. Never rejects. */
  private savePending: Promise<void> = Promise.resolve();

  /**
   * Fire-and-forget bridge for UI callbacks that cannot await: surfaces
   * rejections via Notice instead of letting them vanish.
   */
  runAsync = (promise: Promise<unknown>, label: string) => {
    promise.catch((err) => {
      console.error(`[review] ${label} failed`, err);
      new Notice(`Review: ${label} failed — see console for details.`);
    });
  };

  onload = async () => {
    await this.loadSettings();

    this.addRibbonIcon("scan-eye", "Open review", () => {
      this.openReviewMenu();
    });

    this.statusBar = new StatusBar(this.addStatusBarItem(), this);

    this.addCommand({
      id: "open-random-unreviewed",
      name: "Open random unreviewed file",
      callback: () => this.runAsync(this.openRandomFile(), "open random file"),
    });
    this.addCommand({
      id: "mark-reviewed",
      name: "Mark file as reviewed",
      checkCallback: (checking) => {
        if (this.getActiveFileStatus() !== "not_reviewed") return false;
        if (!checking) this.runAsync(this.markReviewed(), "mark reviewed");
        return true;
      },
    });
    this.addCommand({
      id: "mark-reviewed-and-open-next",
      name: "Mark file as reviewed and open next",
      checkCallback: (checking) => {
        if (this.getActiveFileStatus() !== "not_reviewed") return false;
        if (!checking)
          this.runAsync(this.markReviewed({ openNext: true }), "mark reviewed");
        return true;
      },
    });
    this.addCommand({
      id: "mark-unreviewed",
      name: "Mark file as unreviewed",
      checkCallback: (checking) => {
        if (this.getActiveFileStatus() !== "reviewed") return false;
        if (!checking) this.runAsync(this.markUnreviewed(), "mark unreviewed");
        return true;
      },
    });
    this.addCommand({
      id: "open-review-menu",
      name: "Open review menu",
      callback: () => this.openReviewMenu(),
    });

    this.addSettingTab(new ReviewSettingTab(this.app, this));

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) =>
        this.runAsync(
          this.handleFileRename(file, oldPath),
          "update review state after rename",
        ),
      ),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) =>
        this.runAsync(
          this.handleFileDelete(file),
          "update review state after delete",
        ),
      ),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.statusBar.update),
    );
  };

  loadSettings = async () => {
    let saved: SavedData | null = null;
    let loadFailed = false;
    try {
      saved = await this.loadData();
    } catch (err) {
      // Distinct from `saved === null`, which is also a fresh install.
      loadFailed = true;
      console.error("[review] loadData failed; running read-only", err);
      new Notice(
        "Review: could not read saved data. The plugin is read-only until Obsidian reloads it — your saved review will not be overwritten. See console for details.",
      );
    }

    const savedVersion = saved
      ? (saved.schemaVersion ?? 1)
      : CURRENT_SCHEMA_VERSION;

    if (savedVersion > CURRENT_SCHEMA_VERSION) {
      // Data from a newer plugin version: load what we understand, but keep
      // the newer schemaVersion so the file is not truncated to v2 on write.
      console.warn(
        `[review] data has schema v${savedVersion}, newer than v${CURRENT_SCHEMA_VERSION}; loading read-only`,
      );
      new Notice(
        "Review: saved data is from a newer plugin version. Changes will not be saved until the plugin is updated.",
      );
      this.data = { ...normalizeData(saved), schemaVersion: savedVersion };
    } else {
      const migrated =
        saved && savedVersion < 2 ? migrateV1toV2(saved) : (saved ?? {});
      this.data = {
        ...normalizeData(migrated),
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };
    }

    // Assigned on every path, back to null included, so a reload after a
    // transient read failure lifts the block.
    if (loadFailed) {
      this.saveBlocked = "saved data could not be read";
    } else if (savedVersion > CURRENT_SCHEMA_VERSION) {
      this.saveBlocked = "saved data is from a newer plugin version";
    } else {
      this.saveBlocked = null;
    }

    this.state.load(this.data.reviewedPaths, this.data.reviewStartedAt);
  };

  saveSettings = (): Promise<void> => {
    if (this.saveBlocked) {
      console.warn(`[review] not saving: ${this.saveBlocked}`);
      new Notice(
        `Review: ${this.saveBlocked}. Changes will not be saved until you reload.`,
      );
      return Promise.resolve();
    }

    this.data.reviewedPaths = [...this.state.reviewedPaths];
    this.data.reviewStartedAt = this.state.reviewStartedAt;

    // Snapshot at call time, not write time: a queued write must carry the
    // state that was current when it was requested, not whatever `this.data`
    // holds by the time its turn comes.
    const payload: PluginData = {
      ...this.data,
      reviewedPaths: [...this.data.reviewedPaths],
      excludedFolders: [...this.data.excludedFolders],
    };

    // Serialize, so overlapping saves land in call order. Both arms run the
    // write: a failed predecessor must not stop its successor.
    const next = this.savePending.then(
      () => this.writeSettings(payload),
      () => this.writeSettings(payload),
    );
    this.savePending = next.catch(() => {});
    return next;
  };

  private writeSettings = async (data: PluginData) => {
    try {
      await this.saveData(data);
    } catch (err) {
      console.error(
        `[review] saveData failed (${data.reviewedPaths.length} reviewed paths, ${data.excludedFolders.length} excluded folders)`,
        err,
      );
      throw err;
    }
  };

  onExternalSettingsChange = async () => {
    await this.loadSettings();
    this.statusBar.update();
  };

  getActiveMarkdownFile = (): TFile | null => {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile?.extension !== "md") return null;
    return activeFile;
  };

  isFileEligible = (path: string): boolean => {
    return !isExcluded(path, this.data.excludedFolders);
  };

  getEligibleFiles = (): TFile[] => {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => this.isFileEligible(f.path));
  };

  getActiveFileStatus = (): "reviewed" | "not_reviewed" | undefined => {
    const file = this.getActiveMarkdownFile();
    if (!file || !this.isFileEligible(file.path)) return undefined;
    return this.isReviewed(file.path) ? "reviewed" : "not_reviewed";
  };

  isReviewed = (path: string): boolean => {
    return this.state.isReviewed(path);
  };

  getStats = (): ReviewStats => {
    return this.state.stats(this.getEligibleFiles().map((f) => f.path));
  };

  openReviewMenu = () => {
    new ReviewMenuModal(this.app, this).open();
  };

  openRandomFile = async () => {
    const eligible = this.getEligibleFiles();
    const path = this.state.pickRandomUnreviewed(eligible.map((f) => f.path));
    const randomFile = eligible.find((f) => f.path === path);
    if (!randomFile) {
      new Notice("All files are reviewed");
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(randomFile);
  };

  /**
   * Apply a review-state change and report whether it was persisted. The UI
   * must not show progress that is not on disk: a refused write is declined
   * before anything changes, and a failed one is rolled back.
   */
  private mutate = async (apply: () => void): Promise<boolean> => {
    if (this.saveBlocked) {
      new Notice(
        `Review: ${this.saveBlocked}. Changes will not be saved until you reload.`,
      );
      return false;
    }

    // Settle any in-flight write first, so a rollback cannot be overtaken by
    // a save that was already queued from the state we are about to undo.
    await this.savePending;

    const paths = [...this.state.reviewedPaths];
    const startedAt = this.state.reviewStartedAt;

    apply();
    this.statusBar.update();

    try {
      await this.saveSettings();
      return true;
    } catch (err) {
      this.state.load(paths, startedAt);
      this.statusBar.update();
      throw err;
    }
  };

  markReviewed = async ({ openNext = false }: { openNext?: boolean } = {}) => {
    const file = this.getActiveMarkdownFile();
    if (!file) return;

    const saved = await this.mutate(() => this.state.markReviewed(file.path));
    if (saved && openNext) await this.openRandomFile();
  };

  markUnreviewed = async () => {
    const file = this.getActiveMarkdownFile();
    if (!file) return;

    await this.mutate(() => this.state.markUnreviewed(file.path));
  };

  resetReview = async ({
    confirm = true,
  }: {
    confirm?: boolean;
  } = {}): Promise<boolean> => {
    if (confirm && !(await this.confirmReset())) return false;

    return this.mutate(() => this.state.reset());
  };

  private confirmReset = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const modal = new ConfirmResetModal(this.app, resolve);
      modal.open();
    });
  };

  private handleFileRename = async (file: TAbstractFile, oldPath: string) => {
    const changed =
      file instanceof TFolder
        ? this.state.renameFolder(oldPath, file.path)
        : this.state.renameFile(oldPath, file.path);
    if (changed) await this.saveSettings();
  };

  private handleFileDelete = async (file: TAbstractFile) => {
    const changed =
      file instanceof TFolder
        ? this.state.deleteFolder(file.path)
        : this.state.deleteFile(file.path);
    if (changed) {
      this.statusBar.update();
      await this.saveSettings();
    }
  };
}
