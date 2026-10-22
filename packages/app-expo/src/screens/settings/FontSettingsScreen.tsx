import { GlobeIcon, LinkIcon, PlusIcon, Trash2Icon, TypeIcon } from "@/components/ui/Icon";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { fontSize, fontWeight, radius, spacing, useColors } from "@/styles/theme";
/**
 * FontSettingsScreen — custom font management for mobile
 */
import {
  createCustomFontFamily,
  generateFontId,
  saveFontFile,
  useFontStore,
} from "@readany/core/stores";
import type { CustomFont } from "@readany/core/types/font";
import { PRESET_FONTS } from "@readany/core/types/font";
import * as DocumentPicker from "expo-document-picker";
import * as Font from "expo-font";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsHeader } from "./SettingsHeader";

export default function FontSettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const layout = useResponsiveLayout();

  const fonts = useFontStore((s) => s.fonts);
  const fontsHydrated = useFontStore((s) => s._hasHydrated);
  const addFont = useFontStore((s) => s.addFont);
  const removeFont = useFontStore((s) => s.removeFont);

  const installedPresetIds = new Set(
    fonts.filter((f) => f.id.startsWith("preset-")).map((f) => f.id),
  );
  const availablePresetFonts = PRESET_FONTS.filter((preset) => !installedPresetIds.has(preset.id));

  const handleAddPreset = useCallback(
    (preset: (typeof PRESET_FONTS)[number]) => {
      const font: CustomFont = {
        id: preset.id,
        name: preset.nameEn,
        fileName: `preset-${preset.id}.woff2`,
        fontFamily: preset.fontFamily,
        format: preset.format,
        addedAt: Date.now(),
        source: "remote",
        remoteCssUrl: preset.remoteCssUrl,
        remoteUrlWoff2: preset.remoteUrlWoff2,
        remoteUrl: preset.remoteUrl,
      };
      addFont(font, { select: true });
      Alert.alert(
        t("fonts.imported", "Imported successfully"),
        t("fonts.importedDesc", 'Font "{{name}}" added', { name: font.name }),
      );
    },
    [addFont, t],
  );

  const [importing, setImporting] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [pendingFontFile, setPendingFontFile] = useState<{ uri: string; name: string } | null>(
    null,
  );
  const [fontNameInput, setFontNameInput] = useState("");

  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteUrlWoff2, setRemoteUrlWoff2] = useState("");
  const [remoteFontName, setRemoteFontName] = useState("");
  const [loadedPreviewFontIds, setLoadedPreviewFontIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    const loadPreviewFonts = async () => {
      const loadedIds = new Set<string>();
      for (const font of fonts) {
        if (font.source !== "local" || !font.filePath) continue;
        try {
          if (!Font.isLoaded(font.fontFamily)) {
            await Font.loadAsync({ [font.fontFamily]: font.filePath });
          }
          loadedIds.add(font.id);
        } catch (err) {
          console.warn("[FontSettings] Failed to load font preview:", font.name, err);
        }
      }
      if (!cancelled) setLoadedPreviewFontIds(loadedIds);
    };

    void loadPreviewFonts();
    return () => {
      cancelled = true;
    };
  }, [fonts]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/font-sfnt",
          "application/x-font-ttf",
          "application/x-font-otf",
          "font/ttf",
          "font/otf",
          "font/woff",
          "font/woff2",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setImporting(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name || "font.ttf";
      const nameWithoutExt = fileName.replace(/\.(ttf|otf|woff|woff2)$/i, "");

      setPendingFontFile({ uri: file.uri, name: fileName });
      setFontNameInput(nameWithoutExt);
      setNameModalVisible(true);
      setImporting(false);
    } catch (err) {
      console.error("[FontSettings] Pick error:", err);
      Alert.alert(t("fonts.error", "Error"), t("fonts.pickError", "Failed to select font file"));
      setImporting(false);
    }
  }, [t]);

  const handleConfirmImport = useCallback(async () => {
    if (!fontNameInput.trim()) {
      Alert.alert(t("fonts.error", "Error"), t("fonts.nameRequired", "Please enter font name"));
      return;
    }
    if (!pendingFontFile) return;

    setNameModalVisible(false);
    setImporting(true);

    try {
      const {
        filePath,
        fileName: savedName,
        size,
      } = await saveFontFile(pendingFontFile.uri, fontNameInput.trim(), pendingFontFile.name);

      const id = generateFontId();
      const font: CustomFont = {
        id,
        name: fontNameInput.trim(),
        fileName: savedName,
        filePath,
        fontFamily: createCustomFontFamily(id),
        format:
          (savedName.split(".").pop()?.toLowerCase() as "ttf" | "otf" | "woff" | "woff2") || "ttf",
        size,
        addedAt: Date.now(),
        source: "local",
      };

      addFont(font, { select: true });
      Alert.alert(
        t("fonts.imported", "Imported successfully"),
        t("fonts.importedDesc", 'Font "{{name}}" imported', { name: fontNameInput.trim() }),
      );
    } catch (err) {
      console.error("[FontSettings] Import error:", err);
      Alert.alert(t("fonts.error", "Error"), t("fonts.importError", "Failed to import font"));
    } finally {
      setImporting(false);
      setPendingFontFile(null);
      setFontNameInput("");
    }
  }, [fontNameInput, pendingFontFile, addFont, t]);

  const handleImportRemote = useCallback(async () => {
    if (!remoteFontName.trim()) {
      Alert.alert(t("fonts.error", "Error"), t("fonts.nameRequired", "Please enter font name"));
      return;
    }
    if (!remoteUrl.trim() && !remoteUrlWoff2.trim()) {
      Alert.alert(t("fonts.error", "Error"), t("fonts.urlRequired", "Please enter font link"));
      return;
    }

    setUrlModalVisible(false);
    setImporting(true);

    try {
      const id = generateFontId();
      const url = remoteUrl.trim();
      const woff2Url = remoteUrlWoff2.trim();
      const format = woff2Url ? "woff2" : url.endsWith(".woff2") ? "woff2" : "woff";

      const font: CustomFont = {
        id,
        name: remoteFontName.trim(),
        fileName: `remote-${Date.now()}.${format}`,
        fontFamily: createCustomFontFamily(id),
        format,
        addedAt: Date.now(),
        source: "remote",
        remoteUrl: url || undefined,
        remoteUrlWoff2: woff2Url || undefined,
      };

      addFont(font, { select: true });
      Alert.alert(
        t("fonts.imported", "Imported successfully"),
        t("fonts.importedDesc", 'Font "{{name}}" imported', { name: remoteFontName.trim() }),
      );
    } catch (err) {
      console.error("[FontSettings] Import remote error:", err);
      Alert.alert(t("fonts.error", "Error"), t("fonts.importError", "Failed to import font"));
    } finally {
      setImporting(false);
      setRemoteUrl("");
      setRemoteUrlWoff2("");
      setRemoteFontName("");
    }
  }, [remoteFontName, remoteUrl, remoteUrlWoff2, addFont, t]);

  const handleDelete = useCallback(
    (font: CustomFont) => {
      Alert.alert(
        t("fonts.deleteTitle", "Delete Font"),
        t("fonts.deleteConfirm", 'Are you sure you want to delete font "{{name}}"?', { name: font.name }),
        [
          { text: t("common.cancel", "Cancel"), style: "cancel" },
          {
            text: t("common.delete", "Delete"),
            style: "destructive",
            onPress: () => removeFont(font.id),
          },
        ],
      );
    },
    [removeFont, t],
  );

  const formatSize = (bytes?: number): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <SettingsHeader title={t("fonts.title", "Fonts")} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { alignItems: "center" }]}
      >
        <View style={{ width: "100%", maxWidth: layout.centeredContentWidth }}>
          <View style={s.section}>
            <Text style={[s.hint, { color: colors.mutedForeground }]}>
              {t("fonts.desc", "Import custom fonts for use in the reader. Supports TTF, OTF, WOFF, and WOFF2 formats.")}
            </Text>
            <Text style={[s.hint, { color: colors.mutedForeground, marginTop: 6, fontSize: 12 }]}>
              {t(
                "fonts.importHint",
                "Supports TTF / OTF / WOFF / WOFF2. WOFF2 is recommended for smaller file size.",
              )}
            </Text>
          </View>

          {!fontsHydrated ? (
            <View style={s.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[s.loadingText, { color: colors.mutedForeground }]}>
                {t("common.loading", "Loading...")}
              </Text>
            </View>
          ) : (
            <>
              <View style={s.buttonRow}>
                <TouchableOpacity
                  style={[s.importBtn, { backgroundColor: colors.primary }, s.importBtnHalf]}
                  onPress={handleImport}
                  disabled={importing}
                  activeOpacity={0.8}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <PlusIcon size={18} color={colors.primaryForeground} />
                      <Text style={[s.importBtnText, { color: colors.primaryForeground }]}>
                        {t("fonts.fromFile", "Local File")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.importBtn, { backgroundColor: colors.primary }, s.importBtnHalf]}
                  onPress={() => setUrlModalVisible(true)}
                  disabled={importing}
                  activeOpacity={0.8}
                >
                  <LinkIcon size={18} color={colors.primaryForeground} />
                  <Text style={[s.importBtnText, { color: colors.primaryForeground }]}>
                    {t("fonts.fromUrl", "Online Link")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Preset fonts */}
              {availablePresetFonts.length > 0 && (
                <View style={s.presetSection}>
                  <Text
                    style={[
                      s.hint,
                      { color: colors.mutedForeground, fontWeight: fontWeight.medium },
                    ]}
                  >
                    {t("fonts.presets", "Recommended Fonts (Online, click to add)")}
                  </Text>
                  {availablePresetFonts.map((preset) => {
                    const name = preset.nameEn;
                    const desc = preset.descriptionEn;
                    return (
                      <View
                        key={preset.id}
                        style={[
                          s.fontCard,
                          { backgroundColor: colors.card, borderColor: colors.border },
                        ]}
                      >
                        <View style={s.fontHeader}>
                          <View style={s.fontInfo}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={[s.fontName, { color: colors.foreground }]}>{name}</Text>
                              <View
                                style={[s.remoteBadge, { backgroundColor: `${colors.primary}22` }]}
                              >
                                <Text style={[s.remoteBadgeText, { color: colors.primary }]}>
                                  {preset.license}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[s.fontMetaText, { color: colors.mutedForeground }]}
                              numberOfLines={2}
                            >
                              {desc}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              {
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: radius.md,
                                marginLeft: 8,
                              },
                              { backgroundColor: colors.primary },
                            ]}
                            onPress={() => handleAddPreset(preset)}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.sm,
                                fontWeight: fontWeight.medium,
                                color: colors.primaryForeground,
                              }}
                            >
                              {t("fonts.add", "Add")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {fonts.length === 0 ? (
                <View style={s.emptyState}>
                  <TypeIcon size={48} color={colors.mutedForeground} />
                  <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                    {t("fonts.empty", "No custom fonts")}
                  </Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
                    {t("fonts.emptyHint", "Click buttons above to import font file")}
                  </Text>
                </View>
              ) : (
                <View style={s.fontList}>
                  {fonts.map((font) => (
                    <View
                      key={font.id}
                      style={[
                        s.fontCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <View style={s.fontHeader}>
                        <View style={s.fontInfo}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[s.fontName, { color: colors.foreground }]}>
                              {font.name}
                            </Text>
                            {font.source === "remote" && (
                              <View
                                style={[s.remoteBadge, { backgroundColor: `${colors.primary}22` }]}
                              >
                                <GlobeIcon size={12} color={colors.primary} />
                                <Text style={[s.remoteBadgeText, { color: colors.primary }]}>
                                  {t("fonts.remote", "Online")}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={s.fontMeta}>
                            <Text style={[s.fontMetaText, { color: colors.mutedForeground }]}>
                              {font.format.toUpperCase()}
                            </Text>
                            <Text style={[s.fontMetaDot, { color: colors.mutedForeground }]}>
                              ·
                            </Text>
                            <Text style={[s.fontMetaText, { color: colors.mutedForeground }]}>
                              {formatSize(font.size)}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={s.deleteBtn}
                          onPress={() => handleDelete(font)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2Icon size={20} color={colors.destructive} />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          s.previewBox,
                          { backgroundColor: colors.muted, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            s.previewText,
                            { color: colors.foreground },
                            loadedPreviewFontIds.has(font.id) && { fontFamily: font.fontFamily },
                          ]}
                        >
                          {t("fonts.preview", "The quick brown fox jumps over the lazy dog")}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Name Modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>
              {t("fonts.nameFont", "Font Name")}
            </Text>
            <Text style={[s.modalDesc, { color: colors.mutedForeground }]}>
              {t("fonts.nameFontDesc", "Enter display name for font")}
            </Text>
            <TextInput
              style={[
                s.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={fontNameInput}
              onChangeText={setFontNameInput}
              placeholder={t("fonts.namePlaceholder", "Enter display name")}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setNameModalVisible(false);
                  setPendingFontFile(null);
                  setFontNameInput("");
                }}
              >
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>
                  {t("common.cancel", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmImport}
              >
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>
                  {t("fonts.import", "Import")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Online Link Modal */}
      <Modal
        visible={urlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={[s.modalContent, s.scrollModal, { backgroundColor: colors.card }]}
            contentContainerStyle={s.scrollModalContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.modalTitle, { color: colors.foreground }]}>
              {t("fonts.fromUrl", "Online Link")}
            </Text>
            <Text style={[s.modalDesc, { color: colors.mutedForeground }]}>
              {t("fonts.urlHint", "Enter font CDN URL")}
            </Text>

            <Text style={[s.inputLabel, { color: colors.foreground }]}>
              {t("fonts.name", "Font Name")}
            </Text>
            <TextInput
              style={[
                s.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={remoteFontName}
              onChangeText={setRemoteFontName}
              placeholder={t("fonts.namePlaceholder", "Enter display name")}
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[s.inputLabel, { color: colors.foreground }]}>
              {t("fonts.urlWoff2", "WOFF2 URL")}
            </Text>
            <TextInput
              style={[
                s.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={remoteUrlWoff2}
              onChangeText={setRemoteUrlWoff2}
              placeholder="https://example.com/font.woff2"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text style={[s.inputLabel, { color: colors.foreground }]}>
              {t("fonts.urlWoff", "WOFF URL (Fallback)")}
            </Text>
            <TextInput
              style={[
                s.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              value={remoteUrl}
              onChangeText={setRemoteUrl}
              placeholder="https://example.com/font.woff"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setUrlModalVisible(false);
                  setRemoteUrl("");
                  setRemoteUrlWoff2("");
                  setRemoteFontName("");
                }}
              >
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>
                  {t("common.cancel", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleImportRemote}
              >
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>
                  {t("fonts.import", "Import")}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(_colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: 56,
      gap: 20,
    },
    section: { gap: 10 },
    hint: {
      fontSize: fontSize.sm,
      lineHeight: 22,
    },
    loadingState: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 20,
    },
    loadingText: { fontSize: fontSize.sm },
    buttonRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
    presetSection: { gap: 8, marginBottom: 16 },
    importBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radius.lg,
      paddingVertical: 14,
    },
    importBtnHalf: { flex: 1 },
    importBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
    emptyHint: { fontSize: fontSize.sm },
    fontList: { gap: 12 },
    fontCard: { borderRadius: radius.xl, borderWidth: 1, padding: 16, gap: 12 },
    fontHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    fontInfo: { flex: 1, gap: 4 },
    fontName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    fontMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    fontMetaText: { fontSize: fontSize.xs },
    fontMetaDot: { fontSize: fontSize.xs },
    deleteBtn: { padding: 4 },
    previewBox: { borderRadius: radius.md, borderWidth: 1, padding: 12 },
    previewText: { fontSize: fontSize.sm },
    remoteBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    remoteBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      borderRadius: radius.xl,
      padding: 20,
      width: "85%",
      maxWidth: 340,
      maxHeight: "85%",
    },
    scrollModal: { padding: 0 },
    scrollModalContent: { padding: 20 },
    modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginBottom: 8 },
    modalDesc: { fontSize: fontSize.sm, marginBottom: 16 },
    inputLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: 4 },
    modalInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: fontSize.base,
      marginBottom: 12,
    },
    modalButtons: { flexDirection: "row", gap: 12, marginTop: 4 },
    modalBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
    modalBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  });
}
