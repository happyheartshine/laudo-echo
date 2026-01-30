import { useState } from "react";
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

interface PartnerClinic {
  id: string;
  nome: string;
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
  }) => Promise<void>;
}

export function ManualTransactionModal({
  open,
  onOpenChange,
  partnerClinics,
  selectedClinicId,
  onSave,
}: ManualTransactionModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("a_receber");
  const [clinicId, setClinicId] = useState(selectedClinicId || "");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setStatus("a_receber");
    setClinicId(selectedClinicId || "");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9,\.]/g, "");
    setAmount(value);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !clinicId) return;

    setIsSaving(true);
    try {
      const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;
      await onSave({
        description: description.trim(),
        amount: parsedAmount,
        date,
        status,
        partnerClinicId: clinicId,
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = description.trim() && clinicId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Novo Lançamento Manual
          </DialogTitle>
          <DialogDescription>
            Registre um serviço avulso que não está vinculado a um laudo
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Serviço *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Consultoria, Exame Extra, Revisão..."
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
                value={amount}
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
