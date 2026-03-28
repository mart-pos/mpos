import {
  EyeIcon,
  MoreHorizontalIcon,
  PrinterIcon,
  RefreshCwIcon,
  Settings2Icon,
  StarIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { SectionTitle, Text } from "@/components/Typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ResolvedPrinter } from "@/types/bootstrap";

import { statusText, statusTone } from "./printer-shared";

type PrintersSectionProps = {
  printers: ResolvedPrinter[];
  defaultPrinterId: string | null;
  loading: boolean;
  refreshCooldownSeconds: number;
  printCooldownActive: boolean;
  printBusy: boolean;
  readyPrinters: number;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onSetDefault: (printerId: string) => void;
  onOpenProfile: (printer: ResolvedPrinter) => void;
  onPrintTest: (printerId?: string) => void;
  onPrintLastReceipt: (printer?: ResolvedPrinter) => void;
};

export function PrintersSection({
  printers,
  defaultPrinterId,
  loading,
  refreshCooldownSeconds,
  printCooldownActive,
  printBusy,
  readyPrinters,
  onRefresh,
  onOpenSettings,
  onSetDefault,
  onOpenProfile,
  onPrintTest,
  onPrintLastReceipt,
}: PrintersSectionProps) {
  const { t } = useTranslation();
  const defaultPrinter = printers.find((printer) => printer.id === defaultPrinterId);
  const firstReadyPrinter = printers.find(
    (printer) => printer.status === "online" && printer.receiptCapable,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionTitle>{t("printers.title")}</SectionTitle>
          <Text variant="muted">
            {t("printers.manageConnected", {
              ready: readyPrinters,
              total: printers.length,
            })}
          </Text>
        </div>
      </div>

      {printers.length > 0 && !defaultPrinter && !defaultPrinterId ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <div>
            <Text weight="medium">{t("printers.defaultMissingTitle")}</Text>
            <Text variant="caption" className="mt-1">
              {t("printers.defaultMissingDescription")}
            </Text>
          </div>
          {firstReadyPrinter ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSetDefault(firstReadyPrinter.id)}
            >
              {t("printers.useSuggested")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {printers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Text weight="medium">{t("printers.emptyTitle")}</Text>
              <Text variant="caption" className="mt-1">
                {t("printers.emptyDescription")}
              </Text>
              <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                <span>{t("printers.emptyStep1")}</span>
                <span>{t("printers.emptyStep2")}</span>
                <span>{t("printers.emptyStep3")}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                onClick={onRefresh}
                disabled={loading || refreshCooldownSeconds > 0}
              >
                <RefreshCwIcon />
                {t("common.refresh")}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={onOpenSettings}
              >
                <Settings2Icon />
                {t("printers.openSupport")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="not-last:border-b not-last:border-border p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full border bg-secondary">
                  <PrinterIcon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <Text weight="normal">{printer.name}</Text>
                  <Text variant="caption">
                    {printer.manufacturer ?? t("common.unknownBrand")}
                    {printer.model} - {printer.profile.paperWidthMm}
                  </Text>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {printer.isDefault ? (
                  <Badge variant="secondary" className="text-xs">
                    {t("printers.primary")}
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={`text-xs ${statusTone(printer.status)}`}
                >
                  {statusText(printer.status, t)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="h-8 w-8 cursor-pointer"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-62.5">
                    <DropdownMenuItem onClick={() => onSetDefault(printer.id)}>
                      <StarIcon />
                      {t("printers.useAsPrimary")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOpenProfile(printer)}>
                      <EyeIcon />
                      {t("printers.details")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPrintTest(printer.id)}
                      disabled={printBusy || printCooldownActive}
                    >
                      <PrinterIcon />
                      {t("printers.printTestTicket")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onPrintLastReceipt(printer)}
                      disabled={printBusy || printCooldownActive}
                    >
                      <RefreshCwIcon />
                      {t("printers.reprintLastReceipt")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
