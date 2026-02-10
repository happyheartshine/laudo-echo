import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, CheckCircle2, DollarSign, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface ClinicService {
  id: string;
  service_name: string;
  price: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  status: string;
  patient_name: string | null;
  owner_name: string | null;
  service_id: string | null;
  exam_id: string | null;
}

interface PartnerFinanceSectionProps {
  clinicId: string;
}

export function PartnerFinanceSection({ clinicId }: PartnerFinanceSectionProps) {
  const { user } = useAuth();
  const { clinic } = useProfile();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [services, setServices] = useState<ClinicService[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txDescription, setTxDescription] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txStatus, setTxStatus] = useState("a_receber");
  const [txPatientName, setTxPatientName] = useState("");
  const [txOwnerName, setTxOwnerName] = useState("");
  const [txServiceId, setTxServiceId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [clinicId]);

  const fetchData = async () => {
    setLoading(true);
    const [txRes, svcRes] = await Promise.all([
      supabase
        .from("financial_transactions")
        .select("id, description, amount, transaction_date, status, patient_name, owner_name, service_id, exam_id")
        .eq("partner_clinic_id", clinicId)
        .order("transaction_date", { ascending: false }),
      supabase
        .from("clinic_services")
        .select("id, service_name, price")
        .eq("partner_clinic_id", clinicId)
        .order("service_name"),
    ]);

    if (!txRes.error) setTransactions(txRes.data || []);
    if (!svcRes.error) setServices(svcRes.data || []);
    setLoading(false);
  };

  const totals = useMemo(() => {
    let aberto = 0;
    let pago = 0;
    for (const t of transactions) {
      if (t.status === "pago") pago += Number(t.amount);
      else if (t.status === "a_receber") aberto += Number(t.amount);
    }
    return { aberto, pago };
  }, [transactions]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // ---- Dialog ----
  const openNewDialog = () => {
    setEditingTx(null);
    setTxDescription("");
    setTxAmount("");
    setTxDate(new Date().toISOString().split("T")[0]);
    setTxStatus("a_receber");
    setTxPatientName("");
    setTxOwnerName("");
    setTxServiceId("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (tx: Transaction) => {
    setEditingTx(tx);
    setTxDescription(tx.description);
    setTxAmount(String(tx.amount).replace(".", ","));
    setTxDate(tx.transaction_date);
    setTxStatus(tx.status);
    setTxPatientName(tx.patient_name || "");
    setTxOwnerName(tx.owner_name || "");
    setTxServiceId(tx.service_id || "");
    setIsDialogOpen(true);
  };

  const handleServiceChange = (serviceId: string) => {
    setTxServiceId(serviceId);
    if (serviceId && serviceId !== "other") {
      const svc = services.find((s) => s.id === serviceId);
      if (svc) {
        setTxAmount(formatDecimalForDisplay(svc.price.toString()));
        setTxDescription(svc.service_name);
      }
    }
  };

  const handleSave = async () => {
    if (!txPatientName.trim()) {
      toast({ title: "Erro", description: "Nome do paciente é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const amount = parseDecimal(txAmount) || 0;
    const description = txDescription.trim() || "Serviço Avulso";

    if (editingTx) {
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          description,
          amount,
          transaction_date: txDate,
          status: txStatus,
          patient_name: txPatientName.trim(),
          owner_name: txOwnerName.trim() || null,
          service_id: txServiceId && txServiceId !== "other" ? txServiceId : null,
        })
        .eq("id", editingTx.id);

      if (error) {
        toast({ title: "Erro", description: "Erro ao atualizar lançamento", variant: "destructive" });
      } else {
        toast({ title: "Sucesso", description: "Lançamento atualizado!" });
        setIsDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("financial_transactions").insert({
        user_id: user?.id,
        clinic_id: clinic?.id || null,
        partner_clinic_id: clinicId,
        description,
        amount,
        transaction_date: txDate,
        status: txStatus,
        patient_name: txPatientName.trim(),
        owner_name: txOwnerName.trim() || null,
        service_id: txServiceId && txServiceId !== "other" ? txServiceId : null,
      });

      if (error) {
        toast({ title: "Erro", description: "Erro ao criar lançamento", variant: "destructive" });
      } else {
        toast({ title: "Sucesso", description: "Lançamento criado!" });
        setIsDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Erro ao excluir lançamento", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Lançamento excluído!" });
      fetchData();
    }
  };

  const handleToggleStatus = async (tx: Transaction) => {
    const newStatus = tx.status === "pago" ? "a_receber" : "pago";
    const { error } = await supabase
      .from("financial_transactions")
      .update({ status: newStatus })
      .eq("id", tx.id);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({
        title: "Sucesso",
        description: newStatus === "pago" ? "Pagamento confirmado!" : "Reaberto como pendente.",
      });
      fetchData();
    }
  };

  const statusLabel = (s: string) => {
    if (s === "pago") return "Pago";
    if (s === "a_receber") return "Em Aberto";
    if (s === "cancelado") return "Cancelado";
    return s;
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total em Aberto</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.aberto)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.pago)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h4 className="font-medium">Lançamentos</h4>
        </div>
        <Button variant="outline" size="sm" onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Cobrança
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum lançamento registrado para este parceiro.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-28">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow
                key={tx.id}
                className={
                  tx.status === "pago"
                    ? "opacity-60"
                    : tx.status === "cancelado"
                    ? "opacity-40 line-through"
                    : ""
                }
              >
                <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{tx.patient_name || "—"}</span>
                    {tx.owner_name && (
                      <span className="block text-xs text-muted-foreground">{tx.owner_name}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{tx.description}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(tx.amount))}</TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={tx.status === "pago" ? "default" : tx.status === "cancelado" ? "secondary" : "outline"}
                    className={
                      tx.status === "pago"
                        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/25"
                        : tx.status === "a_receber"
                        ? "bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/25"
                        : ""
                    }
                  >
                    {statusLabel(tx.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {tx.status !== "cancelado" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={tx.status === "pago" ? "Reabrir" : "Dar Baixa"}
                        onClick={() => handleToggleStatus(tx)}
                        className={tx.status === "a_receber" ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(tx)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Lançamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(tx.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Editar Lançamento" : "Nova Cobrança"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Service selector */}
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={txServiceId} onValueChange={handleServiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.service_name} — {formatCurrency(s.price)}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Outro (especificar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Description */}
            {(!txServiceId || txServiceId === "other" || services.length === 0) && (
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="Ex: Ecocardiograma, Consultoria..."
                />
              </div>
            )}

            {/* Patient */}
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Input
                value={txPatientName}
                onChange={(e) => setTxPatientName(e.target.value)}
                placeholder="Nome do animal"
              />
            </div>

            {/* Owner */}
            <div className="space-y-2">
              <Label>Tutor</Label>
              <Input
                value={txOwnerName}
                onChange={(e) => setTxOwnerName(e.target.value)}
                placeholder="Nome do responsável"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  value={formatDecimalForDisplay(txAmount)}
                  onChange={(e) => setTxAmount(sanitizeDecimalInput(e.target.value))}
                  className="pl-10"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={txStatus} onValueChange={setTxStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_receber">Em Aberto</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : editingTx ? "Salvar Alterações" : "Criar Lançamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
