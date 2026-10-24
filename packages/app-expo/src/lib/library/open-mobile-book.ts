import type { RootStackParamList } from "@/navigation/RootNavigator";
import { useLibraryStore } from "@/stores/library-store";
import { useMissingBookPromptStore } from "@/stores/missing-book-prompt-store";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getBook } from "@readany/core/db/database";
import { getPlatformService } from "@readany/core/services";
import type { Book } from "@readany/core/types";
import * as DocumentPicker from "expo-document-picker";
import type { TFunction } from "i18next";
import { Alert } from "react-native";

type MobileNavigation = NativeStackNavigationProp<RootStackParamList>;

const BOOK_MIME_TYPES = [
  "application/epub+zip",
  "application/pdf",
  "application/x-mobipocket-ebook",
  "application/vnd.amazon.ebook",
  "application/vnd.comicbook+zip",
  "application/x-fictionbook+xml",
  "text/plain",
  "application/octet-stream",
];

/** Try to open the native document picker, retrying once if another picker is still in progress. */
async function pickBookFile(): Promise<DocumentPicker.DocumentPickerResult> {
  try {
    return await DocumentPicker.getDocumentAsync({
      type: BOOK_MIME_TYPES,
      multiple: false,
      copyToCacheDirectory: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Different document picking")) {
      // A previous picker is still lingering — wait and retry once
      await new Promise((r) => setTimeout(r, 800));
      return DocumentPicker.getDocumentAsync({
        type: BOOK_MIME_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
      });
    }
    throw err;
  }
}

let reimportInFlight = false;

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

function isLikelyRelativeAppPath(path: string): boolean {
  if (!path) return false;
  return !/^(\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|https?:\/\/)/i.test(path);
}

async function resolveBookForOpen(bookId: string): Promise<Book | null> {
  const liveBook = useLibraryStore.getState().books.find((item) => item.id === bookId);
  if (liveBook) return liveBook;
  return getBook(bookId, { includeDeleted: true }).catch(() => null);
}

async function hasAccessibleLocalFile(book: Book): Promise<boolean> {
  if (!book.filePath) return false;
  if (book.syncStatus === "remote") return true;

  const platform = getPlatformService();
  const targetPath = isLikelyRelativeAppPath(book.filePath)
    ? await platform.joinPath(await platform.getAppDataDir(), book.filePath)
    : book.filePath;

  try {
    return await platform.exists(targetPath);
  } catch {
    return false;
  }
}

export async function openMobileBook({
  bookId,
  navigation,
  t,
  cfi,
  highlight,
}: {
  bookId: string;
  navigation: MobileNavigation;
  t: TFunction;
  cfi?: string;
  highlight?: boolean;
}): Promise<boolean> {
  const book = await resolveBookForOpen(bookId);
  if (!book) {
    return false;
  }

  if (book.syncStatus === "remote") {
    navigation.navigate("Reader", { bookId, cfi, highlight });
    return true;
  }

  if (book.syncStatus === "downloading") {
    Alert.alert(
      t("library.downloading", "Downloading"),
      t("library.downloadInProgress", "The book is still downloading. Please try again later."),
    );
    return false;
  }

  // A soft-deleted book is no longer in the live store — even if the file
  // still exists on disk we must re-import so it rejoins the store.
  if (!book.deletedAt && (await hasAccessibleLocalFile(book))) {
    navigation.navigate("Reader", { bookId, cfi, highlight });
    return true;
  }

  const shouldReimport = await useMissingBookPromptStore.getState().showPrompt({
    title: t("reader.reimportPromptTitle", "Local file removed"),
    description: t(
      "reader.reimportDialogDescription",
      "Select this book's file again to continue reading and reconnect its original notes and reading history.",
    ),
    confirmLabel: t("reader.reimportSelectFile", "Choose file again"),
    cancelLabel: t("common.cancel", "Cancel"),
  });

  if (!shouldReimport) {
    return false;
  }

  if (reimportInFlight) {
    return false;
  }
  reimportInFlight = true;

  try {
    const result = await pickBookFile();
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return false;
    }
    const selectedUri = result.assets[0].uri;
    const store = useLibraryStore.getState();
    const candidate = await store.inspectDeletedBookCandidate(bookId, {
      uri: selectedUri,
      name: result.assets[0].name,
    });
    if (candidate && shouldConfirmReimportCandidate(book, candidate)) {
      const shouldContinue = await useMissingBookPromptStore.getState().showPrompt({
        title: t("reader.reimportMismatchTitle", "This file doesn't quite match the original book"),
        description: t(
          "reader.reimportMismatchDescription",
          "The original book \"{{originalTitle}}\" and the selected file \"{{candidateTitle}}\" differ significantly. Reconnect it to the original notes and reading stats anyway?",
          {
            originalTitle: book.meta.title,
            candidateTitle: candidate.title || t("reader.unknownBook", "Untitled book"),
          },
        ),
        confirmLabel: t("reader.reimportContinue", "Reconnect anyway"),
        cancelLabel: t("reader.reimportPickAnotherFile", "Choose another file"),
      });
      if (!shouldContinue) {
        return false;
      }
    }

    const restoredBook = await store.reimportDeletedBook(bookId, {
      uri: selectedUri,
      name: result.assets[0].name,
    });

    if (!restoredBook) {
      return false;
    }
    navigation.navigate("Reader", { bookId, cfi, highlight });
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("reader.reimportFailed", "Re-import failed. Please try again later.");
    // Ignore "Different document picking in progress" — not actionable for the user
    if (typeof message === "string" && message.includes("Different document picking")) {
      return false;
    }
    console.error("[openMobileBook] Reimport failed:", message);
  } finally {
    reimportInFlight = false;
  }

  return false;
}
