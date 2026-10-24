import { getPlatformService } from "@readany/core/services";
import type { Book } from "@readany/core/types";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

interface UseBookDownloadOptions {
  loadBooks: () => Promise<void>;
  onSuccess: (bookId: string) => void;
}

export function useBookDownload({ loadBooks, onSuccess }: UseBookDownloadOptions) {
  const { t } = useTranslation();
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [downloadingBookTitle, setDownloadingBookTitle] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number;
    total: number;
  } | null>(null);

  const downloadBook = useCallback(
    async (book: Book) => {
      const bookTitle = book.meta.title || "Unknown book";
      setDownloadingBookId(book.id);
      setDownloadingBookTitle(bookTitle);
      setDownloadProgress(null);

      try {
        const { useSyncStore } = await import("@readany/core/stores/sync-store");
        const { downloadBookFile } = await import("@readany/core/sync");
        const { updateBook } = await import("@readany/core/db/database");

        const syncStore = useSyncStore.getState();
        if (!syncStore.config) {
          setDownloadingBookId(null);
          setDownloadingBookTitle("");
          setDownloadProgress(null);
          Alert.alert(t("common.error", "Error"), t("library.syncNotConfigured", "Please configure sync first"));
          return false;
        }

        const platform = getPlatformService();
        const secretKey =
          syncStore.config.type === "webdav" ? "sync_webdav_password" : "sync_s3_secret_key";
        const password = await platform.kvGetItem(secretKey);
        if (!password) {
          setDownloadingBookId(null);
          setDownloadingBookTitle("");
          setDownloadProgress(null);
          Alert.alert(
            t("common.error", "Error"),
            t("library.passwordNotFound", "Sync password not found. Please configure sync again"),
          );
          return false;
        }

        await updateBook(book.id, { syncStatus: "downloading" });
        await loadBooks();

        const { createSyncBackend } = await import("@readany/core/sync/sync-backend-factory");
        const backend = createSyncBackend(syncStore.config, password);

        const outcome = await downloadBookFile(backend, book.id, book.filePath, (progress) => {
          setDownloadProgress(progress);
        });
        await loadBooks();

        if (outcome === "not-found") {
          Alert.alert(
            t("common.error", "Error"),
            t(
              "library.downloadNotFound",
              "The book's file is not available on the remote server. The source device may not have finished uploading. Reopen or sync once on that device, or re-import the book here.",
            ),
          );
          return false;
        }
        if (outcome === "error") {
          Alert.alert(t("common.error", "Error"), t("library.downloadFailed", "Download failed. Please try again"));
          return false;
        }

        console.log(`[useBookDownload] Book ${book.id} downloaded successfully`);
        const { useVectorModelStore } = await import("@/stores/vector-model-store");
        const vmState = useVectorModelStore.getState();
        if (
          vmState.autoVectorizeOnImport &&
          vmState.vectorModelEnabled &&
          vmState.hasVectorCapability()
        ) {
          const { queueBookForAutoVectorize } = await import("@/lib/rag/auto-vectorize-book");
          queueBookForAutoVectorize({ ...book, syncStatus: "local" }).catch((err) => {
            console.warn(`[useBookDownload] Auto-vectorize enqueue failed for ${book.id}:`, err);
          });
        }
        onSuccess(book.id);
        return true;
      } catch (err) {
        console.error("Download failed:", err);
        Alert.alert(t("common.error", "Error"), t("library.downloadFailed", "Download failed. Please try again"));
        return false;
      } finally {
        setDownloadingBookId(null);
        setDownloadingBookTitle("");
        setDownloadProgress(null);
      }
    },
    [loadBooks, onSuccess, t],
  );

  return { downloadingBookId, downloadingBookTitle, downloadProgress, downloadBook };
}
