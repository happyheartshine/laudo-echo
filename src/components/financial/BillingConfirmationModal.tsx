import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface BillingConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerClinicName: string;
  suggestedAmount: number;
  onConfirm: (amount: number) => void;
  onSkip: () => void;
}

export function BillingConfirmationModal({
  open,
  onOpenChange,
  partnerClinicName,
  suggestedAmount,
  onConfirm,
  onSkip,
}: BillingConfirmationModalProps) {
  const [amount, setAmount] = useState(suggestedAmount.toString());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;
    onConfirm(parsedAmount);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow numbers and comma/dot for decimals
    const value = e.target.value.replace(/[^0-9,\.]/g, "");
    setAmount(value);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Lançar Cobrança
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              Deseja lançar a cobrança deste exame para{" "}
              <strong className="text-foreground">{partnerClinicName}</strong>?
            </p>
            
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div>
                <Label htmlFor="billing-amount" className="text-sm font-medium">
                  Valor do Exame
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="billing-amount"
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    className="pl-10 text-lg font-semibold"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor sugerido da tabela: {formatCurrency(suggestedAmount)}
                </p>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Este valor será registrado como "A Receber" no módulo Financeiro.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onSkip} className="mt-0">
            Pular
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-primary">
            Confirmar Lançamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
