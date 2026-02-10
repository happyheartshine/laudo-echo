import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface PartnerClinic {
  id: string;
  nome: string;
}

interface ClinicService {
  id: string;
  service_name: string;
  price: number;
}

interface ManualTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerClinics: PartnerClinic[];
  selectedClinicId?: string;
  onSave: (data: {
    description: string;
    amount: number;
    date: string;
    status: string;
    partnerClinicId: string;
    serviceId?: string;
    patientName: string;
    ownerName: string;
  }) => Promise<void>;
}

export function ManualTransactionModal({
  open,
  onOpenChange,
  partnerClinics,
  selectedClinicId,
  onSave,
}: ManualTransactionModalProps) {
  const [clinicId, setClinicId] = useState(selectedClinicId || "");
  const [services, setServices] = useState<ClinicService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [customDescription, setCustomDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("a_receber");
  const [patientName, setPatientName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setClinicId(selectedClinicId || "");
      setSelectedServiceId("");
      setCustomDescription("");
      setAmount("");
      setDate(new Date().toISOString().split("T")[0]);
      setStatus("a_receber");
      setPatientName("");
      setOwnerName("");
      setServices([]);
    }
  }, [open, selectedClinicId]);

  // Fetch services when clinic changes
  useEffect(() => {
    if (clinicId) {
      fetchServicesForClinic(clinicId);
    } else {
      setServices([]);
      setSelectedServiceId("");
    }
  }, [clinicId]);

  const fetchServicesForClinic = async (partnerClinicId: string) => {
    setLoadingServices(true);
    const { data, error } = await supabase
      .from("clinic_services")
      .select("id, service_name, price")
      .eq("partner_clinic_id", partnerClinicId)
      .order("service_name");

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
    setLoadingServices(false);
  };

  // Auto-fill price when service is selected
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    
    if (serviceId === "other") {
      // Custom service, clear amount for manual input
      setAmount("");
      setCustomDescription("");
    } else {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        setAmount(formatDecimalForDisplay(service.price.toString()));
        setCustomDescription("");
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(sanitizeDecimalInput(e.target.value));
  };

  const handleSubmit = async () => {
    if (!clinicId || !patientName.trim()) return;

    setIsSaving(true);
    try {
      const parsedAmount = parseDecimal(amount) || 0;
      
      // Determine description
      let description = "";
      if (selectedServiceId === "other") {
        description = customDescription.trim() || "Serviço Avulso";
      } else if (selectedServiceId) {
        const service = services.find((s) => s.id === selectedServiceId);
        description = service?.service_name || "Serviço";
      } else {
        description = customDescription.trim() || "Serviço Avulso";
      }

      await onSave({
        description,
        amount: parsedAmount,
        date,
        status,
        partnerClinicId: clinicId,
        serviceId: selectedServiceId && selectedServiceId !== "other" ? selectedServiceId : undefined,
        patientName: patientName.trim(),
        ownerName: ownerName.trim(),
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = clinicId && patientName.trim();
  const showCustomDescription = selectedServiceId === "other" || !selectedServiceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Novo Lançamento Manual
          </DialogTitle>
          <DialogDescription>
            Registre um serviço avulso vinculado a um paciente e clínica parceira
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Partner Clinic */}
          <div className="space-y-2">
            <Label htmlFor="clinic">Clínica Parceira *</Label>
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger id="clinic">
                <SelectValue placeholder="Selecione a clínica" />
              </SelectTrigger>
              <SelectContent>
                {partnerClinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Type - Only show if clinic is selected */}
          {clinicId && (
            <div className="space-y-2">
              <Label htmlFor="service">Tipo de Serviço</Label>
              <Select 
                value={selectedServiceId} 
                onValueChange={handleServiceChange}
                disabled={loadingServices}
              >
                <SelectTrigger id="service">
                  <SelectValue placeholder={loadingServices ? "Carregando..." : "Selecione o serviço"} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.service_name} - R$ {service.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Outro (especificar)</SelectItem>
                </SelectContent>
              </Select>
              {services.length === 0 && !loadingServices && (
                <p className="text-xs text-muted-foreground">
                  Nenhum serviço cadastrado. Cadastre na aba Parceiros → Tabela de Preços.
                </p>
              )}
            </div>
          )}

          {/* Custom Description - Show when "other" or no service selected */}
          {showCustomDescription && (
            <div className="space-y-2">
              <Label htmlFor="description">Descrição do Serviço</Label>
              <Input
                id="description"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Ex: Consultoria, Exame Extra, Revisão..."
              />
            </div>
          )}

          {/* Patient Name */}
          <div className="space-y-2">
            <Label htmlFor="patient">Nome do Paciente *</Label>
            <Input
              id="patient"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Nome do animal"
            />
          </div>

          {/* Owner Name */}
          <div className="space-y-2">
            <Label htmlFor="owner">Responsável</Label>
            <Input
              id="owner"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Nome do responsável"
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="amount"
                type="text"
                value={formatDecimalForDisplay(amount)}
                onChange={handleAmountChange}
                className="pl-10"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_receber">A Receber</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Lançamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
