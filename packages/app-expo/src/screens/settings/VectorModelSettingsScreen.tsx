import { ChevronLeftIcon, EditIcon, PlusIcon, Trash2Icon, XIcon } from "@/components/ui/Icon";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useVectorModelStore } from "@/stores/vector-model-store";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
  withOpacity,
} from "@/styles/theme";
import { useNavigation } from "@react-navigation/native";
import { BUILTIN_EMBEDDING_MODELS } from "@readany/core/ai/builtin-embedding-models";
import { clearModelCache, loadEmbeddingPipeline } from "@readany/core/ai/local-embedding-service";
import { ensureNativeEmbeddingEngine } from "@/lib/rag/configure-search";
import type { VectorModelConfig } from "@readany/core/types";
import {
  EmbeddingEndpointTestError,
  normalizeEmbeddingEndpointUrl,
  testEmbeddingEndpoint,
} from "@readany/core/utils/api";
/**
 * VectorModelSettingsScreen — Mobile version only supports remote embedding APIs.
 * Local embedding is not supported to reduce APK size by ~100MB.
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfigTransfer } from "../../components/settings/ConfigTransfer";
import { PasswordInput } from "../../components/ui/PasswordInput";

export default function VectorModelSettingsScreen() {
  const colors = useColors();
  const s = makeStyles(colors);
  const nav = useNavigation();
  const { t } = useTranslation();
  const layout = useResponsiveLayout();
  const {
    vectorModelEnabled,
    autoVectorizeOnImport,
    setVectorModelEnabled,
    setAutoVectorizeOnImport,
  } = useVectorModelStore();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.headerInner, { maxWidth: layout.centeredContentWidth }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
            <ChevronLeftIcon size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t("settings.vm_title", "Embedding models")}</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bottomOffset={spacing.xxl * 3}
        extraKeyboardSpace={spacing.xxl * 2}
        contentBottomInset={spacing.xxl * 3}
      >
          <View style={{ width: "100%", maxWidth: layout.centeredContentWidth }}>
            {/* Enable switch */}
            <View style={s.section}>
              <View style={s.enableCard}>
                <View style={s.enableInfo}>
                  <Text style={s.enableTitle}>{t("settings.vm_title", "Embedding models")}</Text>
                  <Text style={s.enableDesc}>
                    {t("settings.vm_desc", "Enable vector search and knowledge retrieval")}
                  </Text>
                </View>
                <Switch
                  value={vectorModelEnabled}
                  onValueChange={setVectorModelEnabled}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>
            </View>

            {vectorModelEnabled && (
              <>
                <View style={s.section}>
                  <View style={s.enableCard}>
                    <View style={s.enableInfo}>
                      <Text style={s.enableTitle}>
                        {t("settings.vm_autoVectorizeOnImport", "Auto-vectorize on import")}
                      </Text>
                      <Text style={s.enableDesc}>
                        {t(
                          "settings.vm_autoVectorizeOnImportDesc",
                          "New books imported or downloaded from sync are queued for indexing automatically. Off by default to avoid unexpectedly consuming model quota.",
                        )}
                      </Text>
                    </View>
                    <Switch
                      value={autoVectorizeOnImport}
                      onValueChange={setAutoVectorizeOnImport}
                      trackColor={{ false: colors.muted, true: colors.primary }}
                      thumbColor={colors.card}
                    />
                  </View>
                </View>

                <RemoteModelsSection />
                <BuiltinModelsSection />
              </>
            )}

            {/* Transfer */}
            <View style={{ marginTop: 16 }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: colors.foreground,
                  marginBottom: 8,
                }}
              >
                {t("settings.transferConfig", "Configuration transfer")}
              </Text>
              <ConfigTransfer
                label={t("settings.vectorConfig", "Vectorization configuration")}
                getData={() => {
                  const state = useVectorModelStore.getState();
                  return {
                    vectorModels: state.vectorModels,
                    selectedVectorModelId: state.selectedVectorModelId,
                    vectorModelEnabled: state.vectorModelEnabled,
                    autoVectorizeOnImport: state.autoVectorizeOnImport,
                    vectorModelMode: state.vectorModelMode,
                    selectedBuiltinModelId: state.selectedBuiltinModelId,
                  };
                }}
                applyData={(data) => {
                  const d = data as Record<string, unknown>;
                  const store = useVectorModelStore.getState();
                  if (Array.isArray(d.vectorModels)) {
                    for (const m of store.vectorModels) store.deleteVectorModel(m.id);
                    for (const m of d.vectorModels as VectorModelConfig[]) store.addVectorModel(m);
                  }
                  if (d.selectedVectorModelId)
                    store.setSelectedVectorModelId(d.selectedVectorModelId as string);
                  if (typeof d.vectorModelEnabled === "boolean")
                    store.setVectorModelEnabled(d.vectorModelEnabled);
                  if (typeof d.autoVectorizeOnImport === "boolean")
                    store.setAutoVectorizeOnImport(d.autoVectorizeOnImport);
                  if (d.vectorModelMode === "remote" || d.vectorModelMode === "builtin")
                    store.setVectorModelMode(d.vectorModelMode);
                  if (d.selectedBuiltinModelId)
                    store.setSelectedBuiltinModelId(d.selectedBuiltinModelId as string);
                }}
                validate={(d) => typeof d === "object" && d !== null && "vectorModels" in d}
              />
            </View>

            <View style={{ height: 24 }} />
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function BuiltinModelsSection() {
  const colors = useColors();
  const s = makeStyles(colors);
    const model = BUILTIN_EMBEDDING_MODELS.find((candidate) => candidate.id === "bge-small-zh-v1.5");
  const {
    selectedBuiltinModelId, builtinModelStates, vectorModelMode, setSelectedBuiltinModelId,
    setVectorModelMode, updateBuiltinModelState,
  } = useVectorModelStore();
  const [clearing, setClearing] = useState(false);
  if (!model) return null;
  const state = builtinModelStates[model.id];
  const ready = state?.status === "ready";
  const downloading = state?.status === "downloading";
  const selected = selectedBuiltinModelId === model.id && vectorModelMode === "builtin";

  const select = async () => {
    if (ready) { setSelectedBuiltinModelId(model.id); setVectorModelMode("builtin"); return; }
      updateBuiltinModelState(model.id, { status: "downloading", progress: 0, error: undefined });
      try {
        await ensureNativeEmbeddingEngine();
        await loadEmbeddingPipeline(model.id, (progress) => updateBuiltinModelState(model.id, { progress }));
      updateBuiltinModelState(model.id, { status: "ready", progress: 100 });
      setSelectedBuiltinModelId(model.id); setVectorModelMode("builtin");
    } catch (error) {
      updateBuiltinModelState(model.id, { status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  };
  const clear = async () => {
    setClearing(true);
    try { await clearModelCache(model.id); setSelectedBuiltinModelId(null); updateBuiltinModelState(model.id, { status: "idle", progress: 0, error: undefined }); }
    catch (error) { updateBuiltinModelState(model.id, { status: "error", error: error instanceof Error ? error.message : String(error) }); }
    finally { setClearing(false); }
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Local models</Text>
      <Text style={s.sectionDesc}>Models run offline on this device after download; no book content is ever sent. BGE works best for Chinese, MiniLM for English. Each model requires its own re-vectorization.</Text>
      <View style={[s.modelCard, selected && s.modelCardActive]}>
          <View style={s.modelCardTop}>
            <View style={s.modelInfo}><Text style={s.modelName}>{model.name}</Text><Text style={s.modelSize}>{model.dimension} dims · {model.size}</Text></View>
          {ready ? <Switch value={selected} onValueChange={(value) => value ? select() : setSelectedBuiltinModelId(null)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.card} /> :
            <TouchableOpacity style={s.downloadBtn} disabled={downloading} onPress={select}><Text style={s.downloadBtnText}>{downloading ? `Download ${state?.progress ?? 0}%` : "Download and use"}</Text></TouchableOpacity>}
        </View>
        {ready && <TouchableOpacity style={s.clearBtn} disabled={clearing} onPress={clear}><Text style={s.clearBtnText}>{clearing ? "Clearing…" : "Delete local model"}</Text></TouchableOpacity>}
        {state?.error ? <Text style={[s.testResult, s.testError]}>{state.error}</Text> : null}
      </View>
      <BuiltinEnglishModelCard />
    </View>
  );
}

function BuiltinEnglishModelCard() {
  const colors = useColors();
  const s = makeStyles(colors);
  const model = BUILTIN_EMBEDDING_MODELS.find((candidate) => candidate.id === "all-MiniLM-L6-v2");
  const {
    selectedBuiltinModelId, builtinModelStates, vectorModelMode, setSelectedBuiltinModelId,
    setVectorModelMode, updateBuiltinModelState,
  } = useVectorModelStore();
  const [clearing, setClearing] = useState(false);
  if (!model) return null;
  const state = builtinModelStates[model.id];
  const ready = state?.status === "ready";
  const downloading = state?.status === "downloading";
  const selected = selectedBuiltinModelId === model.id && vectorModelMode === "builtin";

  const select = async () => {
    if (ready) {
      setSelectedBuiltinModelId(model.id);
      setVectorModelMode("builtin");
      return;
    }
    updateBuiltinModelState(model.id, { status: "downloading", progress: 0, error: undefined });
    try {
      await ensureNativeEmbeddingEngine();
      await loadEmbeddingPipeline(model.id, (progress) => updateBuiltinModelState(model.id, { progress }));
      updateBuiltinModelState(model.id, { status: "ready", progress: 100 });
      setSelectedBuiltinModelId(model.id);
      setVectorModelMode("builtin");
    } catch (error) {
      updateBuiltinModelState(model.id, { status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  };
  const clear = async () => {
    setClearing(true);
    try {
      await clearModelCache(model.id);
      setSelectedBuiltinModelId(null);
      updateBuiltinModelState(model.id, { status: "idle", progress: 0, error: undefined });
    } catch (error) {
      updateBuiltinModelState(model.id, { status: "error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setClearing(false);
    }
  };

  return (
    <View style={[s.modelCard, selected && s.modelCardActive]}>
      <View style={s.modelCardTop}>
        <View style={s.modelInfo}>
          <Text style={s.modelName}>{model.name}</Text>
          <Text style={s.modelSize}>{model.dimension} dims · {model.size} · English</Text>
        </View>
        {ready ? (
          <Switch value={selected} onValueChange={(value) => value ? select() : setSelectedBuiltinModelId(null)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.card} />
        ) : (
          <TouchableOpacity style={s.downloadBtn} disabled={downloading} onPress={select}>
            <Text style={s.downloadBtnText}>{downloading ? `Download ${state?.progress ?? 0}%` : "Download and use"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {ready && <TouchableOpacity style={s.clearBtn} disabled={clearing} onPress={clear}><Text style={s.clearBtnText}>{clearing ? "Clearing…" : "Delete local model"}</Text></TouchableOpacity>}
      {state?.error ? <Text style={[s.testResult, s.testError]}>{state.error}</Text> : null}
    </View>
  );
}

function RemoteModelsSection() {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t } = useTranslation();
  const {
    vectorModels,
    selectedVectorModelId,
    addVectorModel,
    updateVectorModel,
    deleteVectorModel,
    setSelectedVectorModelId,
    setVectorModelMode,
  } = useVectorModelStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formModelId, setFormModelId] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setFormName("");
    setFormUrl("");
    setFormModelId("");
    setFormApiKey("");
    setFormDesc("");
    setShowAddForm(false);
    setEditingId(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!formName.trim() || !formUrl.trim() || !formModelId.trim()) return;
    const newModel: VectorModelConfig = {
      id: `vm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: formName.trim(),
      url: normalizeEmbeddingEndpointUrl(formUrl),
      modelId: formModelId.trim(),
      apiKey: formApiKey.trim(),
      description: formDesc.trim(),
    };
    addVectorModel(newModel);
    resetForm();
  }, [formName, formUrl, formModelId, formApiKey, formDesc, addVectorModel, resetForm]);

  const startEdit = useCallback((model: VectorModelConfig) => {
    setFormName(model.name);
    setFormUrl(model.url);
    setFormModelId(model.modelId);
    setFormApiKey(model.apiKey);
    setFormDesc(model.description || "");
    setEditingId(model.id);
    setShowAddForm(false);
  }, []);

  const handleEdit = useCallback(() => {
    if (!editingId || !formName.trim() || !formUrl.trim() || !formModelId.trim()) return;
    updateVectorModel(editingId, {
      name: formName.trim(),
      url: normalizeEmbeddingEndpointUrl(formUrl),
      modelId: formModelId.trim(),
      apiKey: formApiKey.trim(),
      description: formDesc.trim(),
    });
    resetForm();
  }, [
    editingId,
    formName,
    formUrl,
    formModelId,
    formApiKey,
    formDesc,
    updateVectorModel,
    resetForm,
  ]);

  const detectModelDimension = useCallback(
    async (model: VectorModelConfig) => {
      setTestingId(model.id);
      setTestResults((prev) => ({ ...prev, [model.id]: t("settings.vm_testing", "Testing...") }));
      const normalizedUrl = normalizeEmbeddingEndpointUrl(model.url);
      if (normalizedUrl && normalizedUrl !== model.url) {
        updateVectorModel(model.id, { url: normalizedUrl });
      }
      try {
        const result = await testEmbeddingEndpoint({
          url: normalizedUrl,
          modelId: model.modelId,
          apiKey: model.apiKey,
        });
        updateVectorModel(model.id, { dimension: result.dimension, url: result.url });
        setTestResults((prev) => ({
          ...prev,
          [model.id]: t("settings.vm_testSuccess", { dimension: result.dimension }),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const testUrl =
          error instanceof EmbeddingEndpointTestError ? error.url : normalizedUrl || model.url;
        setTestResults((prev) => ({
          ...prev,
          [model.id]: t("settings.vm_testFailedWithUrl", { error: message, url: testUrl }),
        }));
      } finally {
        setTestingId(null);
      }
    },
    [t, updateVectorModel],
  );

  return (
    <View style={s.section}>
      <View style={s.remoteTitleRow}>
        <View>
          <Text style={s.sectionTitle}>{t("settings.vm_remoteModels", "Remote models")}</Text>
          <Text style={s.sectionDesc}>
            {t("settings.vm_remoteDesc", "Embedding models called through an API")}
          </Text>
        </View>
        {!showAddForm && !editingId && (
          <TouchableOpacity
            style={s.addModelBtn}
            onPress={() => {
              setShowAddForm(true);
              setEditingId(null);
            }}
          >
            <PlusIcon size={12} color={colors.foreground} />
            <Text style={s.addModelText}>{t("settings.vm_addModel", "Add model")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {vectorModels.length === 0 && !showAddForm && !editingId && (
        <Text style={s.noModels}>{t("settings.vm_noRemoteModels", "No remote models yet")}</Text>
      )}

      {vectorModels.map((model) => (
        <View
          key={model.id}
          style={[s.modelCard, selectedVectorModelId === model.id && s.modelCardActive]}
        >
          <View style={s.modelCardTop}>
            <View style={s.modelInfo}>
              <Text style={s.modelName}>{model.name}</Text>
              <Text style={s.modelSize}>{model.modelId}</Text>
              {model.dimension ? (
                <Text style={s.modelSize}>
                  {t("settings.vm_dimension", { dim: model.dimension })}
                </Text>
              ) : null}
            </View>
            <Switch
              value={selectedVectorModelId === model.id}
              onValueChange={(v) => {
                if (v) {
                  setSelectedVectorModelId(model.id);
                  setVectorModelMode("remote");
                } else {
                  setSelectedVectorModelId(null);
                }
              }}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          {model.url ? (
            <Text style={s.modelDesc} numberOfLines={1}>
              {model.url}
            </Text>
          ) : null}
          <View style={s.remoteActions}>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => detectModelDimension(model)}
              disabled={testingId === model.id}
            >
              <Text style={s.testBtnText}>
                {testingId === model.id
                  ? t("settings.vm_testing", "Testing...")
                  : t("settings.vm_test", "Test")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => startEdit(model)}>
              <EditIcon size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => deleteVectorModel(model.id)}>
              <Trash2Icon size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {testResults[model.id] ? (
            <Text
              style={[
                s.testResult,
                testResults[model.id].includes("✓") ? s.testSuccess : s.testError,
              ]}
            >
              {testResults[model.id]}
            </Text>
          ) : null}
        </View>
      ))}

      {/* Add/Edit form */}
      {(showAddForm || editingId) && (
        <View style={s.formCard}>
          <View style={s.formHeader}>
            <Text style={s.formTitle}>
              {editingId
                ? t("settings.vm_editModel", "Edit model")
                : t("settings.vm_addModelTitle", "Add model")}
            </Text>
            <TouchableOpacity onPress={resetForm}>
              <XIcon size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={s.fieldLabel}>{t("settings.vm_name", "Name")} *</Text>
          <TextInput
            style={s.fieldInput}
            value={formName}
            onChangeText={setFormName}
            placeholder="OpenAI Embedding"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={s.fieldLabel}>{t("settings.vm_modelId", "Model ID")} *</Text>
          <TextInput
            style={s.fieldInput}
            value={formModelId}
            onChangeText={setFormModelId}
            placeholder="text-embedding-3-small"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={s.fieldLabel}>{t("settings.vm_url", "URL")} *</Text>
          <TextInput
            style={s.fieldInput}
            value={formUrl}
            onChangeText={setFormUrl}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={s.fieldHint}>{t("settings.vm_urlHint")}</Text>

          <Text style={s.fieldLabel}>{t("settings.vm_apiKey", "API Key")}</Text>
          <PasswordInput
            style={s.fieldInput}
            value={formApiKey}
            onChangeText={setFormApiKey}
            placeholder="sk-..."
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={s.fieldLabel}>{t("settings.vm_description", "Description")}</Text>
          <TextInput
            style={s.fieldInput}
            value={formDesc}
            onChangeText={setFormDesc}
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={s.formActions}>
            <TouchableOpacity style={s.formCancelBtn} onPress={resetForm}>
              <Text style={s.formCancelText}>{t("common.cancel", "Cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.formSaveBtn,
                (!formName.trim() || !formUrl.trim() || !formModelId.trim()) &&
                  s.formSaveBtnDisabled,
              ]}
              onPress={editingId ? handleEdit : handleAdd}
              disabled={!formName.trim() || !formUrl.trim() || !formModelId.trim()}
            >
              <Text style={s.formSaveText}>
                {editingId ? t("common.save", "Save") : t("settings.vm_addModel", "Add model")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    keyboardView: { flex: 1 },
    header: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    headerInner: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
    },
    scrollView: { flex: 1 },
    scrollContent: {
      paddingTop: 24,
      paddingBottom: 48,
      alignItems: "center",
    },
    section: { paddingHorizontal: 16, paddingTop: 16 },
    sectionTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    sectionDesc: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      marginTop: 2,
      marginBottom: 12,
    },
    // Enable card
    enableCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 16,
    },
    enableInfo: { flex: 1, marginRight: 12 },
    enableTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground },
    enableDesc: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 2 },
    // Mode
    modeTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
      marginBottom: 8,
    },
    modeRow: { flexDirection: "row", gap: 8 },
    modeCard: {
      flex: 1,
      borderWidth: 0.5,
      borderColor: colors.border,
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      padding: 12,
    },
    modeCardActive: { borderColor: colors.primary, backgroundColor: colors.accent },
    modeCardTitle: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    modeCardDesc: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    // Model card
    modelCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 8,
    },
    modelCardActive: { borderColor: colors.primary, backgroundColor: colors.accent },
    modelCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardActions: { alignItems: "flex-end", justifyContent: "center" },
    iconBtn: { padding: 4 },
    modelNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    modelName: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground },
    modelSize: { fontSize: 11, color: colors.mutedForeground },
    modelBadges: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    recommendBadge: {
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    recommendText: { fontSize: 10, fontWeight: fontWeight.medium, color: colors.primary },
    readyBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
    readyText: { fontSize: 10, color: colors.emerald },
    modelDesc: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: 6 },
    downloadingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    downloadingText: { fontSize: fontSize.xs, color: colors.mutedForeground },
    readyActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.md,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    clearBtnText: { fontSize: 11, color: colors.mutedForeground },
    downloadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    downloadBtnText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.primary,
    },
    modelInfo: { flex: 1, minWidth: 0 },
    // Remote
    desktopOnlyNotice: {
      backgroundColor: withOpacity(colors.primary, 0.08),
      borderRadius: radius.md,
      padding: 10,
      marginBottom: 4,
    },
    desktopOnlyText: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    remoteTitleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    addModelBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 0.5,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    addModelText: { fontSize: fontSize.xs, color: colors.foreground },
    noModels: {
      textAlign: "center",
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      paddingVertical: 24,
    },
    remoteActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    testBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radius.md,
      backgroundColor: withOpacity(colors.primary, 0.1),
    },
    testBtnText: { fontSize: 11, fontWeight: fontWeight.medium, color: colors.primary },
    testResult: { fontSize: fontSize.xs, marginTop: 8, lineHeight: 17 },
    testSuccess: { color: colors.emerald },
    testError: { color: colors.destructive },
    // Form
    formCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 16,
      marginTop: 12,
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    formTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.foreground },
    fieldLabel: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      marginBottom: 4,
      marginTop: 12,
    },
    fieldInput: {
      height: 36,
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      paddingHorizontal: 12,
      fontSize: fontSize.sm,
      color: colors.foreground,
    },
    fieldHint: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 4,
      lineHeight: 16,
    },
    formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
    formCancelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.lg,
      borderWidth: 0.5,
      borderColor: colors.border,
    },
    formCancelText: { fontSize: fontSize.xs, color: colors.foreground },
    formSaveBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    formSaveBtnDisabled: { opacity: 0.5 },
    formSaveText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: colors.primaryForeground,
    },
  });
