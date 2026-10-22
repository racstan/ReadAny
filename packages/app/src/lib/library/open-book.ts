import { triggerVectorizeBook } from "@/lib/rag/vectorize-trigger";
import { resolveDesktopDataPath } from "@/lib/storage/desktop-library-root";
import { useAppStore } from "@/stores/app-store";
import { useDownloadProgressStore } from "@/stores/download-progress-store";
import { useLibraryStore } from "@/stores/library-store";
import { useMissingBookPromptStore } from "@/stores/missing-book-prompt-store";
import { setBookSyncStatus } from "@readany/core/db/database";
import { getPlatformService } from "@readany/core/services";
import { useSyncStore } from "@readany/core/stores/sync-store";
import { useVectorModelStore } from "@readany/core/stores/vector-model-store";
import { downloadBookFile } from "@readany/core/sync";
import { createSyncBackend } from "@readany/core/sync/sync-backend-factory";
import type { Book } from "@readany/core/types";
import type { TFunction } from "i18next";
import { toast } from "sonner";

interface OpenDesktopBookOptions {
  book: Book;
  t: TFunction;
  initialCfi?: string;
}

function normalizeBookIdentityText(value?: string): string {
  return (value || "").toLowerCase().replace(/[\s\p{P}\p{S}_-]+/gu, "");
}

function authorsLikelyMatch(a?: string, b?: string): boolean {
  const left = normalizeBookIdentityText(a);
  const right = normalizeBookIdentityText(b);
  if (!left || !right) return true;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftParts = left.split(/[,，、/&]+/).filter((part) => part.length > 1);
  const rightParts = right.split(/[,，、/&]+/).filter((part) => part.length > 1);
  return leftParts.some((part) =>
    rightParts.some((candidate) => part.includes(candidate) || candidate.includes(part)),
  );
}

function shouldConfirmReimportCandidate(
  originalBook: Book,
  candidate: { title: string; author: string; format: Book["format"]; fileHash?: string },
): boolean {
  if (candidate.fileHash && originalBook.fileHash && candidate.fileHash === originalBook.fileHash) {
    return false;
  }
  const originalTitle = normalizeBookIdentityText(originalBook.meta.title);
  const candidateTitle = normalizeBookIdentityText(candidate.title);
  const titleMismatch =
    !!originalTitle &&
    !!candidateTitle &&
    originalTitle !== candidateTitle &&
    !originalTitle.includes(candidateTitle) &&
    !candidateTitle.includes(originalTitle);
  const authorMismatch = !authorsLikelyMatch(originalBook.meta.author, candidate.author);
  const formatMismatch = originalBook.format !== candidate.format;
  return titleMismatch || (formatMismatch && authorMismatch);
}

const pendingDownloads = new Set<string>();
const BOOK_IMPORT_FILTERS = [
  {
    name: "Books",
    extensions: ["epub", "pdf", "mobi", "azw", "azw3", "cbz", "fb2", "fbz", "txt", "umd"],
  },
];

function openReaderTab(book: Book, initialCfi?: string) {
  const { addTab, setActiveTab } = useAppStore.getState();
  const tabId = `reader-${book.id}`;
  addTab({
    id: tabId,
    type: "reader",
    title: book.meta.title,
    bookId: book.id,
    initialCfi,
  });
  setActiveTab(tabId);
}

export async function openDesktopBook({
  book,
  t,
  initialCfi,
}: OpenDesktopBookOptions): Promise<boolean> {
  const { books, setBooks, loadBooks, inspectDeletedBookCandidate, reimportDeletedBook } =
    useLibraryStore.getState();

  if (pendingDownloads.has(book.id) || book.syncStatus === "downloading") {
    return false;
  }

  if (book.syncStatus === "remote") {
    const syncStore = useSyncStore.getState();
    if (!syncStore.config) {
      toast.error(t("settings.syncNotConfigured"));
      return false;
    }

    const platform = getPlatformService();
    const secretKey =
      syncStore.config.type === "webdav" ? "sync_webdav_password" : "sync_s3_secret_key";
    const password = await platform.kvGetItem(secretKey);
    if (!password) {
      toast.error(t("library.passwordNotFound", "Sync password not found, please reconfigure"));
      return false;
    }

    pendingDownloads.add(book.id);
    setBooks(
      books.map((item) => (item.id === book.id ? { ...item, syncStatus: "downloading" } : item)),
    );
    await setBookSyncStatus(book.id, "downloading");
    const { setProgress, clearProgress } = useDownloadProgressStore.getState();

    try {
      const backend = createSyncBackend(syncStore.config, password);
      const outcome = await downloadBookFile(backend, book.id, book.filePath, (progress) => {
        setProgress(book.id, progress.downloaded, progress.total);
      });
      await loadBooks();

      if (outcome === "not-found") {
        toast.error(
          t(
            "library.downloadNotFound",
            "The book file was not found on remote. The source device may not have uploaded it yet. Please open/sync from that device, or re-import here.",
          ),
        );
        return false;
      }
      if (outcome === "error") {
        toast.error(t("library.downloadFailed", "Download failed, please try again"));
        return false;
      }
      const vmState = useVectorModelStore.getState();
      if (
        vmState.autoVectorizeOnImport &&
        vmState.vectorModelEnabled &&
        vmState.hasVectorCapability()
      ) {
        triggerVectorizeBook(book.id, book.filePath, (progress) => {
          const pct =
            progress.totalChunks > 0 ? progress.processedChunks / progress.totalChunks : 0;
          useLibraryStore.getState().updateBook(book.id, { vectorizeProgress: pct });
        }).catch((err) => {
          console.warn(`[openDesktopBook] Auto-vectorize failed for ${book.meta.title}:`, err);
        });
      }
      return true;
    } catch (error) {
      console.error("[openDesktopBook] Failed to download remote book:", error);
      await setBookSyncStatus(book.id, "remote");
      await loadBooks();
      toast.error(t("library.downloadFailed", "Download failed, please try again"));
      return false;
    } finally {
      pendingDownloads.delete(book.id);
      clearProgress(book.id);
    }
  }

  const platform = getPlatformService();

  // A soft-deleted book is no longer in the live store — even if its file
  // still exists on disk we must re-import it first so it rejoins the store.
  const isSoftDeleted = !!book.deletedAt;

  // Check whether the local book file is accessible
  let fileAccessible = false;
  if (!isSoftDeleted && book.filePath) {
    const targetPath = await resolveDesktopDataPath(book.filePath);
    fileAccessible = await platform.exists(targetPath).catch(() => false);
  }

  if (!fileAccessible) {
    // File missing or never had one — prompt user to re-import
    const shouldReimport = await useMissingBookPromptStore.getState().showPrompt({
      title: t("reader.reimportPromptTitle", "Book file missing"),
      description: t(
        "reader.reimportDialogDescriptionDesktop",
        "Notes and reading records are preserved. Re-import the file to continue.",
      ),
      confirmLabel: t("reader.reimportSelectFile", "Re-import"),
      cancelLabel: t("common.cancel", "Cancel"),
    });
    if (!shouldReimport) {
      return false;
    }

    const picked = await platform.pickFile({
      multiple: false,
      filters: BOOK_IMPORT_FILTERS,
    });
    const selectedPath = Array.isArray(picked) ? picked[0] : picked;
    if (!selectedPath) {
      return false;
    }

    const candidate = await inspectDeletedBookCandidate(book.id, selectedPath);
    if (candidate && shouldConfirmReimportCandidate(book, candidate)) {
      const shouldContinue = await useMissingBookPromptStore.getState().showPrompt({
        title: t("reader.reimportMismatchTitle", "File does not match original book"),
        description: t(
          "reader.reimportMismatchDescription",
          "Original book \"{{originalTitle}}\" differs significantly from \"{{candidateTitle}}\". Link it to previous notes and reading statistics anyway?",
          {
            originalTitle: book.meta.title,
            candidateTitle: candidate.title || t("reader.unknownBook", "Unknown Book"),
          },
        ),
        confirmLabel: t("reader.reimportContinue", "Continue linking"),
        cancelLabel: t("reader.reimportPickAnotherFile", "Choose another file"),
      });
      if (!shouldContinue) {
        return false;
      }
    }

    const restoredBook = await reimportDeletedBook(book.id, selectedPath);
    if (!restoredBook) {
      toast.error(t("reader.reimportFailed", "Re-import failed, please try again later."));
      return false;
    }

    toast.success(t("reader.reimportSuccess", "Book re-imported successfully. Notes and reading records restored."));
    openReaderTab(restoredBook, initialCfi);
    return true;
  }

  openReaderTab(book, initialCfi);
  return true;
}
