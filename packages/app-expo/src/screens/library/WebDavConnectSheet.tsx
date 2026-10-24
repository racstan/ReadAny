import {
  DEFAULT_WEBDAV_IMPORT_REMOTE_ROOT,
  getPlatformService,
  type PersistedWebDavImportInput,
  WEBDAV_IMPORT_TEMPORARY_CONFIG_KEY,
  WEBDAV_IMPORT_TEMPORARY_SECRET_KEY,
  type WebDavImportSource,
} from "@readany/core";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { fontSize, fontWeight, radius, useColors, withOpacity } from "@/styles/theme";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface WebDavConnectSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (source: WebDavImportSource) => Promise<void>;
}

export function WebDavConnectSheet({
  visible,
  onClose,
  onSubmit,
}: WebDavConnectSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remoteRoot, setRemoteRoot] = useState(DEFAULT_WEBDAV_IMPORT_REMOTE_ROOT);
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const platform = getPlatformService();
      try {
        const [rawConfig, savedPassword] = await Promise.all([
          platform.kvGetItem(WEBDAV_IMPORT_TEMPORARY_CONFIG_KEY),
          platform.kvGetItem(WEBDAV_IMPORT_TEMPORARY_SECRET_KEY),
        ]);
        if (cancelled) return;
        if (rawConfig) {
          const parsed = JSON.parse(rawConfig) as PersistedWebDavImportInput;
          setUrl(parsed.url ?? "");
          setUsername(parsed.username ?? "");
          setRemoteRoot(parsed.remoteRoot ?? DEFAULT_WEBDAV_IMPORT_REMOTE_ROOT);
          setAllowInsecure(parsed.allowInsecure ?? false);
        }
        if (savedPassword) {
          setPassword(savedPassword);
        }
      } catch (err) {
        console.warn("[import] failed to load saved WebDAV input", err);
      }
    })();
    setError(null);
    setSubmitting(false);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const canSubmit =
    url.trim().length > 0 && username.trim().length > 0 && password.trim().length > 0 && !submitting;

  const s = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.36)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 14,
          gap: 14,
          maxHeight: "92%",
        },
        keyboardWrap: {
          width: "100%",
          justifyContent: "flex-end",
        },
        handle: {
          alignSelf: "center",
          width: 38,
          height: 4,
          borderRadius: radius.full,
          backgroundColor: withOpacity(colors.border, 0.9),
        },
        title: {
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
          color: colors.foreground,
        },
        subtitle: {
          fontSize: fontSize.sm,
          lineHeight: 20,
          color: colors.mutedForeground,
        },
        form: {
          gap: 12,
        },
        scroll: {
          flexGrow: 0,
        },
        scrollContent: {
          gap: 14,
          paddingBottom: 4,
        },
        field: {
          gap: 8,
        },
        label: {
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: colors.foreground,
        },
        input: {
          height: 48,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: withOpacity(colors.border, 0.92),
          backgroundColor: colors.card,
          paddingHorizontal: 14,
          fontSize: fontSize.base,
          color: colors.foreground,
        },
        helper: {
          fontSize: fontSize.xs,
          lineHeight: 18,
          color: colors.mutedForeground,
        },
        switchRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: withOpacity(colors.border, 0.92),
          backgroundColor: colors.card,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        switchCopy: {
          flex: 1,
          minWidth: 0,
        },
        switchTitle: {
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: colors.foreground,
        },
        switchDesc: {
          marginTop: 2,
          fontSize: fontSize.xs,
          lineHeight: 18,
          color: colors.mutedForeground,
        },
        errorBox: {
          borderRadius: radius.xl,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: withOpacity(colors.destructive, 0.08),
          borderWidth: 1,
          borderColor: withOpacity(colors.destructive, 0.18),
        },
        errorText: {
          fontSize: fontSize.sm,
          lineHeight: 20,
          color: colors.destructive,
        },
        footer: {
          flexDirection: "row",
          gap: 10,
        },
        secondaryBtn: {
          flex: 1,
          height: 48,
          borderRadius: radius.xl,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: withOpacity(colors.border, 0.9),
          alignItems: "center",
          justifyContent: "center",
        },
        primaryBtn: {
          flex: 1.2,
          height: 48,
          borderRadius: radius.xl,
          backgroundColor: canSubmit ? colors.primary : withOpacity(colors.primary, 0.45),
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        },
        secondaryBtnText: {
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: colors.foreground,
        },
        primaryBtnText: {
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.primaryForeground,
        },
      }),
    [canSubmit, colors, insets.bottom],
  );

  const handleConnect = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        kind: "temporary",
        url: url.trim(),
        username: username.trim(),
        password,
        remoteRoot: remoteRoot.trim(),
        allowInsecure,
      });
      try {
        const platform = getPlatformService();
        const persisted: PersistedWebDavImportInput = {
          url: url.trim(),
          username: username.trim(),
          remoteRoot: remoteRoot.trim(),
          allowInsecure,
        };
        await Promise.all([
          platform.kvSetItem(WEBDAV_IMPORT_TEMPORARY_CONFIG_KEY, JSON.stringify(persisted)),
          platform.kvSetItem(WEBDAV_IMPORT_TEMPORARY_SECRET_KEY, password),
        ]);
      } catch (err) {
        console.warn("[import] failed to persist WebDAV input", err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          style={s.keyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={[
              s.sheet,
              layout.isTablet && {
                width: "100%",
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={s.handle} />
            <View>
              <Text style={s.title}>
                {t("library.importSourceTemporaryWebDav", "Connect to another WebDAV")}
              </Text>
              <Text style={s.subtitle}>
                {t(
                  "library.importSourceTemporaryWebDavDesc",
                  "Temporarily enter another address, account, and folder. It applies to this import only and won't change your current sync configuration.",
                )}
              </Text>
            </View>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.form}>
                <View style={s.field}>
                  <Text style={s.label}>{t("settings.webdavUrl", "WebDAV Server URL")}</Text>
                  <TextInput
                    style={s.input}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    placeholder="https://dav.example.com"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>{t("settings.webdavUsername", "Username")}</Text>
                  <TextInput
                    style={s.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t("settings.webdavUsername", "Username")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>{t("settings.webdavPassword", "App Password")}</Text>
                  <TextInput
                    style={s.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t("settings.webdavPassword", "App Password")}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>{t("settings.syncRemoteRoot", "Remote folder")}</Text>
                  <TextInput
                    style={s.input}
                    value={remoteRoot}
                    onChangeText={setRemoteRoot}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t(
                      "library.webdavImportRemoteRootPlaceholder",
                      "Leave empty to start from the server's base directory",
                    )}
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={s.helper}>
                    {t(
                      "library.importRemoteRootHint",
                      "You can enter a path of any depth; when left empty, browsing starts from the base directory of the current WebDAV service.",
                    )}
                  </Text>
                </View>
                <View style={s.switchRow}>
                  <View style={s.switchCopy}>
                    <Text style={s.switchTitle}>
                      {t("settings.syncAllowInsecure", "Allow insecure connection")}
                    </Text>
                    <Text style={s.switchDesc}>
                      {t(
                        "library.importAllowInsecureHint",
                        "Useful for self-signed certificates or plain HTTP servers. HTTPS is still recommended in production.",
                      )}
                    </Text>
                  </View>
                  <Switch value={allowInsecure} onValueChange={setAllowInsecure} />
                </View>
              </View>

              {error ? (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity style={s.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.secondaryBtnText}>{t("common.cancel", "Cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={handleConnect}
                activeOpacity={0.9}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : null}
                <Text style={s.primaryBtnText}>
                  {submitting
                    ? t("library.webdavImportConnecting", "Connecting...")
                    : t("library.webdavImportConnectAndBrowse", "Connect and browse")}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
