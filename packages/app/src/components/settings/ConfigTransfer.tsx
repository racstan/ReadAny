import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { decodeConfig, encodeConfig } from "@readany/core/utils";
import { Check, Copy, Download, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface ConfigTransferProps<T> {
  getData: () => T;
  applyData: (data: unknown) => void;
  validate: (data: unknown) => boolean;
  label: string;
}

export function ConfigTransfer<T>({ getData, applyData, validate, label }: ConfigTransferProps<T>) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"idle" | "export" | "import">("idle");
  const [token, setToken] = useState("");
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(() => {
    try {
      const data = getData();
      const encoded = encodeConfig(data);
      setToken(encoded);
      setMode("export");
    } catch {
      toast.error(t("settings.exportFailed", "Export failed, data may be too large"));
    }
  }, [getData, t]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success(t("common.copied", "Copied"));
    setTimeout(() => setCopied(false), 2000);
  }, [token, t]);

  const applyImportedData = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        toast.error(t("settings.invalidConfig", "Invalid configuration"));
        return;
      }
      const data = decodeConfig(trimmed);
      if (!data) {
        toast.error(t("settings.invalidConfig", "Invalid configuration"));
        return;
      }
      if (!validate(data)) {
        toast.error(t("settings.invalidConfig", "Invalid configuration"));
        return;
      }
      try {
        applyData(data);
        toast.success(t("settings.configImported", "Configuration imported"));
        setMode("idle");
        setImportText("");
      } catch {
        toast.error(t("settings.importFailed", "Import failed"));
      }
    },
    [validate, applyData, t],
  );

  const handleImport = useCallback(() => applyImportedData(importText), [importText, applyImportedData]);

  if (mode === "export") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <textarea
          readOnly
          value={token}
          className="min-h-[60px] w-full rounded-md border border-input bg-background p-2 font-mono text-xs text-foreground"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <p className="text-xs text-muted-foreground">
          {t("settings.copyToken", "Copy code below to import on another device")}
        </p>
        <div className="flex w-full gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy}>
            {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
            {t("common.copy", "Copy")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("idle")}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <Textarea
          placeholder={t("settings.pasteConfig", "Paste configuration code...")}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="min-h-[80px] font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleImport} disabled={!importText.trim()}>
            <Download className="mr-1.5 size-3.5" />
            {t("settings.importConfig", "Import")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setMode("idle"); setImportText(""); }}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        <Copy className="mr-1.5 size-3.5" />
        {t("settings.exportConfig", "Export")} {label}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMode("import")}>
        <Download className="mr-1.5 size-3.5" />
        {t("settings.importConfig", "Import")} {label}
      </Button>
    </div>
  );
}
