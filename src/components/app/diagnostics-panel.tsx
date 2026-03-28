import type { ReactNode } from "react";
import { ChevronDown, LifeBuoyIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/Typography";

type DiagnosisItem = {
  title: string;
  detail: string;
  action: ReactNode | null;
};

type DiagnosticsPanelProps = {
  socketConnected: boolean;
  martposConnected: boolean;
  allowedOrigin: string | null;
  defaultPrinterName: string | null;
  readyPrinters: number;
  onlinePrinters: number;
  diagnosisItems: DiagnosisItem[];
};

export function DiagnosticsPanel({
  socketConnected,
  martposConnected,
  allowedOrigin,
  defaultPrinterName,
  readyPrinters,
  onlinePrinters,
  diagnosisItems,
}: DiagnosticsPanelProps) {
  const { t } = useTranslation();

  return (
    <details className="order-3 rounded-2xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border bg-secondary">
            <LifeBuoyIcon className="size-4 text-muted-foreground" />
          </div>
          <div>
            <Text weight="medium">{t("printers.diagnostics.title")}</Text>
            <Text variant="caption">{t("printers.diagnostics.subtitle")}</Text>
          </div>
        </div>
        <div className="px-2">
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-5 py-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Text variant="caption">{t("printers.diagnostics.liveSocket")}</Text>
            <Text className="mt-1">
              {socketConnected ? t("common.connected") : t("common.reconnecting")}
            </Text>
          </div>
          <div>
            <Text variant="caption">{t("printers.diagnostics.martposState")}</Text>
            <Text className="mt-1">
              {martposConnected
                ? t("printers.diagnostics.martposLinked")
                : t("printers.diagnostics.martposPending")}
            </Text>
          </div>
          <div>
            <Text variant="caption">
              {t("printers.diagnostics.allowedOrigin")}
            </Text>
            <Text className="mt-1">
              {allowedOrigin ?? t("common.undefined")}
            </Text>
          </div>
          <div>
            <Text variant="caption">
              {t("printers.diagnostics.defaultPrinter")}
            </Text>
            <Text className="mt-1">
              {defaultPrinterName ?? t("common.undefined")}
            </Text>
          </div>
          <div>
            <Text variant="caption">
              {t("printers.diagnostics.readyPrinters")}
            </Text>
            <Text className="mt-1">
              {t("printers.diagnostics.onlineCount", {
                ready: readyPrinters,
                online: onlinePrinters,
              })}
            </Text>
          </div>
        </div>

        {diagnosisItems.length > 0 ? (
          <div className="flex flex-col gap-3">
            {diagnosisItems.map((item) => (
              <div
                key={item.title}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
              >
                <div>
                  <Text weight="medium">{item.title}</Text>
                  <Text variant="caption" className="mt-1">
                    {item.detail}
                  </Text>
                </div>
                {item.action}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <Text weight="medium">{t("printers.diagnostics.allGoodTitle")}</Text>
            <Text variant="caption" className="mt-1">
              {t("printers.diagnostics.allGoodDescription")}
            </Text>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Text variant="caption">
              {t("printers.diagnostics.whatIfNoPrintTitle")}
            </Text>
            <Text className="mt-1">
              {t("printers.diagnostics.whatIfNoPrintDescription")}
            </Text>
          </div>
          <div>
            <Text variant="caption">
              {t("printers.diagnostics.whatIfMissingTitle")}
            </Text>
            <Text className="mt-1">
              {t("printers.diagnostics.whatIfMissingDescription")}
            </Text>
          </div>
        </div>
      </div>
    </details>
  );
}
