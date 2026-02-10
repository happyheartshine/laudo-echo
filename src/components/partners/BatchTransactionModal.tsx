import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface ClinicService {
  id: string;
  service_name: string;
  price: number;
}

export interface BatchLineItem {
  key: number;
  patientName: string;
  ownerName: string;
  serviceId: string;
  description: string;
  amount: string;
  date: string;
}

interface BatchTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: ClinicService[];
  onSave: (items: {
    description: string;
    amount: number;
    date: string;
    patientName: string;
    ownerName: string;
    serviceId?: string;
  }[]) => Promise<void>;
}

let nextKey = 1;

function createEmptyItem(): BatchLineItem {
  return {
    key: nextKey++,
    patientName: "",
    ownerName: "",
    serviceId: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BatchTransactionModal({
  open,
  onOpenChange,
  services,
  onSave,
}: BatchTransactionModalProps) {
  const [items, setItems] = useState<BatchLineItem[]>([createEmptyItem()]);
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setItems([createEmptyItem()]);
    }
    onOpenChange(isOpen);
  };

  const updateItem = (key: number, field: keyof BatchLineItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [field]: value } : item))
    );
  };

  const handleServiceChange = (key: number, serviceId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        if (serviceId && serviceId !== "other") {
          const svc = services.find((s) => s.id === serviceId);
          if (svc) {
            return {
              ...item,
              serviceId,
              description: svc.service_name,
              amount: formatDecimalForDisplay(svc.price.toString()),
            };
          }
        }
        return { ...item, serviceId, description: serviceId === "other" ? "" : item.description };
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((i) => i.key !== key);
    });
  };

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseDecimal(item.amount) || 0), 0);
  }, [items]);

  const canSubmit = items.some((item) => item.patientName.trim());

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.patientName.trim());
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      await onSave(
        validItems.map((item) => ({
          description: item.description.trim() || "Serviço Avulso",
          amount: parseDecimal(item.amount) || 0,
          date: item.date,
          patientName: item.patientName.trim(),
          ownerName: item.ownerName.trim(),
          serviceId: item.serviceId && item.serviceId !== "other" ? item.serviceId : undefined,
        }))
      );
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="border rounded-lg p-3 space-y-3 relative bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Item {index + 1}
                </span>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Patient */}
                <div className="space-y-1">
                  <Label className="text-xs">Paciente *</Label>
                  <Input
                    value={item.patientName}
                    onChange={(e) => updateItem(item.key, "patientName", e.target.value)}
                    placeholder="Nome do animal"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Owner */}
                <div className="space-y-1">
                  <Label className="text-xs">Tutor</Label>
                  <Input
                    value={item.ownerName}
                    onChange={(e) => updateItem(item.key, "ownerName", e.target.value)}
                    placeholder="Nome do responsável"
                    className="h-9 text-sm"
                  />
                </div>

                {/* Service */}
                <div className="space-y-1">
                  <Label className="text-xs">Serviço</Label>
                  {services.length > 0 ? (
                    <Select
                      value={item.serviceId}
                      onValueChange={(v) => handleServiceChange(item.key, v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.service_name} — {formatCurrency(s.price)}
                          </SelectItem>
                        ))}
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, "description", e.target.value)}
                      placeholder="Descrição"
                      className="h-9 text-sm"
                    />
                  )}
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={item.date}
                    onChange={(e) => updateItem(item.key, "date", e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Custom description when "other" */}
                {(item.serviceId === "other" || (!item.serviceId && services.length > 0)) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, "description", e.target.value)}
                      placeholder="Ex: Consultoria..."
                      className="h-9 text-sm"
                    />
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      R$
                    </span>
                    <Input
                      value={formatDecimalForDisplay(item.amount)}
                      onChange={(e) =>
                        updateItem(item.key, "amount", sanitizeDecimalInput(e.target.value))
                      }
                      className="h-9 text-sm pl-8"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addItem} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Item
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row items-center gap-3 border-t pt-4">
          <div className="flex-1 text-sm font-medium">
            Total: <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
            <span className="text-muted-foreground ml-2">
              ({items.filter((i) => i.patientName.trim()).length}{" "}
              {items.filter((i) => i.patientName.trim()).length === 1 ? "item" : "itens"})
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Lançamentos"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
