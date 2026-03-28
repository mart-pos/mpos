import { useTranslation } from "react-i18next";

import { Text } from "@/components/Typography";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PaperWidth, PrinterType, ResolvedPrinter } from "@/types/bootstrap";

import {
  connectionLabel,
  paperLabel,
  paperWidths,
  printerTypes,
  PrinterProfileDraft,
  statusText,
  typeLabel,
} from "./printer-shared";

function SwitchRow({
  label,
  helper,
  checked,
  onCheckedChange,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <Text weight="medium">{label}</Text>
        {helper ? (
          <Text variant="caption" className="mt-1">
            {helper}
          </Text>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

type PrinterProfileDialogProps = {
  printer: ResolvedPrinter | null;
  draft: PrinterProfileDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (
    updater: (current: PrinterProfileDraft | null) => PrinterProfileDraft | null,
  ) => void;
  onReset: () => void;
  onSave: () => void;
};

export function PrinterProfileDialog({
  printer,
  draft,
  open,
  onOpenChange,
  onDraftChange,
  onReset,
  onSave,
}: PrinterProfileDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-125 max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {t("printers.profile.title", {
              name: printer?.name ?? t("common.undefined"),
            })}
          </DialogTitle>
          <DialogDescription>{t("printers.profile.description")}</DialogDescription>
        </DialogHeader>

        {draft ? (
          <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col gap-5">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">{t("printers.profile.info")}</TabsTrigger>
              <TabsTrigger value="settings">
                {t("printers.profile.settings")}
              </TabsTrigger>
              <TabsTrigger value="advanced">
                {t("printers.profile.advanced")}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="min-h-0 flex-1 pr-4">
              <TabsContent value="info" className="mt-0">
                <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                  <div>
                    <Text variant="caption">{t("printers.profile.fields.name")}</Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.name ?? t("common.noName")}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">
                      {t("printers.profile.fields.brandModel")}
                    </Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.manufacturer ?? t("common.noBrand")}
                      {printer?.model ? ` · ${printer.model}` : ""}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">
                      {t("printers.profile.fields.connection")}
                    </Text>
                    <Text className="mt-1" weight="medium">
                      {printer
                        ? connectionLabel(printer.connectionType, t)
                        : t("common.undefined")}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">{t("printers.profile.fields.status")}</Text>
                    <Text className="mt-1" weight="medium">
                      {printer ? statusText(printer.status, t) : t("common.undefined")}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">{t("printers.profile.fields.driver")}</Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.driver ?? t("common.undefined")}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">
                      {t("printers.profile.fields.systemQueue")}
                    </Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.systemQueue ?? t("common.notApplicable")}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">
                      {t("printers.profile.fields.vendorProduct")}
                    </Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.vendorId ?? "--"} / {printer?.productId ?? "--"}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption">{t("printers.profile.fields.series")}</Text>
                    <Text className="mt-1" weight="medium">
                      {printer?.serialNumber ?? t("common.notRecorded")}
                    </Text>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <div className="flex flex-col gap-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Text asChild weight="medium">
                        <label>{t("printers.profile.fields.type")}</label>
                      </Text>
                      <Select
                        value={draft.kind}
                        onValueChange={(value) =>
                          onDraftChange((current) =>
                            current
                              ? { ...current, kind: value as PrinterType }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {printerTypes.map((value) => (
                            <SelectItem key={value} value={value}>
                              {typeLabel(value, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Text asChild weight="medium">
                        <label>{t("printers.profile.fields.paper")}</label>
                      </Text>
                      <Select
                        value={draft.paperWidthMm}
                        onValueChange={(value) =>
                          onDraftChange((current) =>
                            current
                              ? { ...current, paperWidthMm: value as PaperWidth }
                              : current,
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paperWidths.map((value) => (
                            <SelectItem key={value} value={value}>
                              {paperLabel(value, t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Text asChild weight="medium">
                        <label>{t("printers.profile.fields.charsPerLine")}</label>
                      </Text>
                      <Input
                        type="number"
                        value={String(draft.charsPerLineNormal)}
                        onChange={(event) =>
                          onDraftChange((current) =>
                            current
                              ? {
                                  ...current,
                                  charsPerLineNormal: Number(event.target.value),
                                }
                              : current,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Text asChild weight="medium">
                        <label>{t("printers.profile.fields.encoding")}</label>
                      </Text>
                      <Input value={draft.encoding} disabled readOnly />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <SwitchRow
                      label={t("printers.profile.switches.receiptReady")}
                      checked={draft.receiptCapable}
                      onCheckedChange={(checked) =>
                        onDraftChange((current) =>
                          current ? { ...current, receiptCapable: checked } : current,
                        )
                      }
                    />

                    <SwitchRow
                      label={t("printers.profile.switches.autoCut")}
                      checked={draft.supportsCut}
                      onCheckedChange={(checked) =>
                        onDraftChange((current) =>
                          current ? { ...current, supportsCut: checked } : current,
                        )
                      }
                    />

                    <SwitchRow
                      label={t("printers.profile.switches.cashDrawer")}
                      checked={draft.supportsCashDrawer}
                      onCheckedChange={(checked) =>
                        onDraftChange((current) =>
                          current
                            ? { ...current, supportsCashDrawer: checked }
                            : current,
                        )
                      }
                    />

                    <SwitchRow
                      label={t("printers.profile.switches.qrAndBarcode")}
                      helper={t("printers.profile.switches.qrAndBarcodeHelp")}
                      checked={draft.supportsQr || draft.supportsBarcode}
                      onCheckedChange={(checked) =>
                        onDraftChange((current) =>
                          current
                            ? {
                                ...current,
                                supportsQr: checked,
                                supportsBarcode: checked,
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-0">
                <div className="flex flex-col gap-4">
                  <div>
                    <Text weight="medium">
                      {t("printers.profile.advancedTitle")}
                    </Text>
                    <Text variant="caption" className="mt-1">
                      {t("printers.profile.advancedDescription")}
                    </Text>
                  </div>

                  <SwitchRow
                    label={t("printers.profile.switches.advancedUsb")}
                    checked={draft.rawSupport}
                    onCheckedChange={(checked) =>
                      onDraftChange((current) =>
                        current ? { ...current, rawSupport: checked } : current,
                      )
                    }
                  />

                  <div className="space-y-2">
                    <Text asChild weight="medium">
                      <label>{t("printers.profile.fields.rawDevicePath")}</label>
                    </Text>
                    <Input
                      value={draft.rawDevicePath}
                      onChange={(event) =>
                        onDraftChange((current) =>
                          current
                            ? { ...current, rawDevicePath: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={onReset}
            disabled={!printer}
          >
            {t("common.reset")}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" size="lg" onClick={onSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
