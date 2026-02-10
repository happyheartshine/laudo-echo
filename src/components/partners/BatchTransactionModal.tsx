import { useState, useEffect, useMemo } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface ClinicService {
  id: string;
  service_name: string;
  price: number;
}

interface PartnerClinic {
  id: string;
  nome: string;
}

interface ServiceLineItem {
  key: number;
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

export interface BatchSaveItem {
  description: string;
  amount: number;
  date: string;
  patientName: string;
  ownerName: string;
  serviceId?: string;
  partnerClinicId: string;
}

interface PrefillData {
  patientName?: string;
  ownerName?: string;
  date?: string;
}

interface BatchTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, services are passed directly and partner is locked */
  services?: ClinicService[];
  /** If provided, the partner dropdown is locked to this clinic */
  partnerClinicId?: string;
  /** List of partner clinics for the dropdown (global mode) */
  partnerClinics?: PartnerClinic[];
  /** Pre-fill header fields (for adding service to existing group) */
  prefill?: PrefillData;
  onSave: (items: BatchSaveItem[]) => Promise<void>;
}

let nextKey = 1;

function createEmptyServiceLine(): ServiceLineItem {
  return {
    key: nextKey++,
    serviceId: "",
    description: "",
    quantity: 1,
    unitPrice: "",
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BatchTransactionModal({
  open,
  onOpenChange,
  services: externalServices,
  partnerClinicId,
  partnerClinics,
  prefill,
  onSave,
}: BatchTransactionModalProps) {
  // Header fields
  const [selectedClinicId, setSelectedClinicId] = useState(partnerClinicId || "");
  const [patientName, setPatientName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Service items
  const [items, setItems] = useState<ServiceLineItem[]>([createEmptyServiceLine()]);
  const [saving, setSaving] = useState(false);

  // Services fetched dynamically when in global mode
  const [fetchedServices, setFetchedServices] = useState<ClinicService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const isLockedPartner = !!partnerClinicId;
  const services = externalServices || fetchedServices;

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedClinicId(partnerClinicId || "");
      setPatientName(prefill?.patientName || "");
      setOwnerName(prefill?.ownerName || "");
      setDate(prefill?.date || new Date().toISOString().split("T")[0]);
      setItems([createEmptyServiceLine()]);
      if (!partnerClinicId) {
        setFetchedServices([]);
      }
    }
  }, [open, partnerClinicId, prefill]);

  // Fetch services when clinic changes in global mode
  useEffect(() => {
    if (!externalServices && selectedClinicId && open) {
      fetchServicesForClinic(selectedClinicId);
    }
  }, [selectedClinicId, externalServices, open]);

  const fetchServicesForClinic = async (clinicId: string) => {
    setLoadingServices(true);
    const { data } = await supabase
      .from("clinic_services")
      .select("id, service_name, price")
      .eq("partner_clinic_id", clinicId)
      .order("service_name");
    setFetchedServices(data || []);
    setLoadingServices(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const updateItem = (key: number, updates: Partial<ServiceLineItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...updates } : item))
    );
  };

  const handleServiceChange = (key: number, serviceId: string) => {
    if (serviceId && serviceId !== "other") {
      const svc = services.find((s) => s.id === serviceId);
      if (svc) {
        updateItem(key, {
          serviceId,
          description: svc.service_name,
          unitPrice: formatDecimalForDisplay(svc.price.toString()),
        });
        return;
      }
    }
    updateItem(key, { serviceId, description: serviceId === "other" ? "" : "" });
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyServiceLine()]);
  };

  const removeItem = (key: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.key !== key)));
  };

  const getSubtotal = (item: ServiceLineItem) => {
    const unit = parseDecimal(item.unitPrice) || 0;
    return unit * item.quantity;
  };

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + getSubtotal(item), 0);
  }, [items]);

  const canSubmit = selectedClinicId && patientName.trim() && items.some((i) => i.serviceId || i.description.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const validItems = items.filter((i) => i.serviceId || i.description.trim());
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      const saveItems: BatchSaveItem[] = validItems.map((item) => ({
        description: item.description.trim() || "Serviço Avulso",
        amount: getSubtotal(item),
        date,
        patientName: patientName.trim(),
        ownerName: ownerName.trim(),
        serviceId: item.serviceId && item.serviceId !== "other" ? item.serviceId : undefined,
        partnerClinicId: selectedClinicId,
      }));

      await onSave(saveItems);
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ===== HEADER: Atendimento ===== */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do Atendimento
            </h4>

            {/* Partner clinic - only show dropdown in global mode */}
            {!isLockedPartner && partnerClinics && (
              <div className="space-y-1">
                <Label className="text-xs">Clínica Parceira *</Label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione a clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerClinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Paciente *</Label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome do animal"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Nome do responsável"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1 max-w-[200px]">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* ===== SERVICE ITEMS ===== */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Serviços Realizados
            </h4>

            {/* Column headers */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_60px_100px_90px_32px] gap-2 px-1 text-xs text-muted-foreground font-medium">
              <span>Serviço</span>
              <span className="text-center">Qtd</span>
              <span className="text-right">Valor Unit.</span>
              <span className="text-right">Subtotal</span>
              <span></span>
            </div>

            {items.map((item) => (
              <div
                key={item.key}
                className="border rounded-lg p-3 sm:p-2 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_60px_100px_90px_32px] sm:gap-2 sm:items-center bg-muted/30"
              >
                {/* Service */}
                <div className="space-y-1 sm:space-y-0">
                  <Label className="text-xs sm:hidden">Serviço</Label>
                  {services.length > 0 && selectedClinicId ? (
                    <Select
                      value={item.serviceId}
                      onValueChange={(v) => handleServiceChange(item.key, v)}
                      disabled={loadingServices}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={loadingServices ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.service_name}
                          </SelectItem>
                        ))}
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="Descrição do serviço"
                      className="h-9 text-sm"
                    />
                  )}
                  {item.serviceId === "other" && (
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      placeholder="Descrição..."
                      className="h-9 text-sm mt-1"
                    />
                  )}
                </div>

                {/* Quantity */}
                <div className="space-y-1 sm:space-y-0">
                  <Label className="text-xs sm:hidden">Qtd</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="h-9 text-sm text-center"
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-1 sm:space-y-0">
                  <Label className="text-xs sm:hidden">Valor Unit.</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                    <Input
                      value={formatDecimalForDisplay(item.unitPrice)}
                      onChange={(e) => updateItem(item.key, { unitPrice: sanitizeDecimalInput(e.target.value) })}
                      className="h-9 text-sm pl-7 text-right"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                {/* Subtotal */}
                <div className="flex items-center justify-end">
                  <span className="text-sm font-medium sm:hidden mr-1">Subtotal: </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(getSubtotal(item))}
                  </span>
                </div>

                {/* Remove */}
                <div className="flex justify-end">
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.key)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Serviço
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row items-center gap-3 border-t pt-4">
          <div className="flex-1 text-sm font-medium">
            Total:{" "}
            <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
            <span className="text-muted-foreground ml-2">
              ({items.filter((i) => i.serviceId || i.description.trim()).length}{" "}
              {items.filter((i) => i.serviceId || i.description.trim()).length === 1 ? "serviço" : "serviços"})
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
