import { useState, useEffect, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BatchTransactionModal } from "./BatchTransactionModal";
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
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Edit2, CheckCircle2, DollarSign, Clock, ChevronDown, ChevronRight } from "lucide-react";
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

interface TransactionGroup {
  key: string;
  date: string;
  patientName: string;
  ownerName: string | null;
  transactions: Transaction[];
  totalAmount: number;
  descriptions: string[];
  allPago: boolean;
  allAReceber: boolean;
  hasCancelado: boolean;
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

  // Batch modal state
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchPrefill, setBatchPrefill] = useState<{ patientName?: string; ownerName?: string; date?: string } | undefined>(undefined);

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Edit dialog state
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

  // Delete group dialog
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<TransactionGroup | null>(null);

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

  // ===== GROUPING LOGIC =====
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, TransactionGroup>();

    for (const tx of transactions) {
      const key = `${tx.transaction_date}__${(tx.patient_name || "").toLowerCase().trim()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          date: tx.transaction_date,
          patientName: tx.patient_name || "—",
          ownerName: tx.owner_name,
          transactions: [],
          totalAmount: 0,
          descriptions: [],
          allPago: true,
          allAReceber: true,
          hasCancelado: false,
        });
      }

      const group = map.get(key)!;
      group.transactions.push(tx);
      group.totalAmount += Number(tx.amount);
      if (tx.description && !group.descriptions.includes(tx.description)) {
        group.descriptions.push(tx.description);
      }
      if (!group.ownerName && tx.owner_name) group.ownerName = tx.owner_name;
      if (tx.status !== "pago") group.allPago = false;
      if (tx.status !== "a_receber") group.allAReceber = false;
      if (tx.status === "cancelado") group.hasCancelado = true;
    }

    return Array.from(map.values());
  }, [transactions]);

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

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ---- Dialog ----
  const openNewDialog = () => {
    setBatchPrefill(undefined);
    setIsBatchOpen(true);
  };

  const openAddServiceToGroup = (group: TransactionGroup) => {
    setBatchPrefill({
      patientName: group.patientName !== "—" ? group.patientName : "",
      ownerName: group.ownerName || "",
      date: group.date,
    });
    setIsBatchOpen(true);
  };

  const handleBatchSave = async (items: {
    description: string;
    amount: number;
    date: string;
    patientName: string;
    ownerName: string;
    serviceId?: string;
    partnerClinicId: string;
  }[]) => {
    const rows = items.map((item) => ({
      user_id: user?.id,
      clinic_id: clinic?.id || null,
      partner_clinic_id: item.partnerClinicId,
      description: item.description,
      amount: item.amount,
      transaction_date: item.date,
      status: "a_receber" as const,
      patient_name: item.patientName,
      owner_name: item.ownerName || null,
      service_id: item.serviceId || null,
    }));

    const { error } = await supabase.from("financial_transactions").insert(rows);
    if (error) {
      toast({ title: "Erro", description: "Erro ao criar lançamentos", variant: "destructive" });
      throw error;
    }
    toast({ title: "Sucesso", description: `${items.length} lançamento(s) criado(s)!` });
    fetchData();
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
    if (!editingTx || !txPatientName.trim()) {
      toast({ title: "Erro", description: "Nome do paciente é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const amount = parseDecimal(txAmount) || 0;
    const description = txDescription.trim() || "Serviço Avulso";

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

  const handleDeleteGroup = async (group: TransactionGroup) => {
    const ids = group.transactions.map((t) => t.id);
    const { error } = await supabase.from("financial_transactions").delete().in("id", ids);
    if (error) {
      toast({ title: "Erro", description: "Erro ao excluir lançamentos", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `${ids.length} lançamento(s) excluído(s)!` });
      setDeleteGroupTarget(null);
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

  const handleToggleGroupStatus = async (group: TransactionGroup) => {
    const newStatus = group.allPago ? "a_receber" : "pago";
    const ids = group.transactions.filter((t) => t.status !== "cancelado").map((t) => t.id);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("financial_transactions")
      .update({ status: newStatus })
      .in("id", ids);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({
        title: "Sucesso",
        description: newStatus === "pago"
          ? `${ids.length} pagamento(s) confirmado(s)!`
          : `${ids.length} lançamento(s) reaberto(s).`,
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

  const getGroupStatusBadge = (group: TransactionGroup) => {
    if (group.allPago) {
      return (
        <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
          Pago
        </Badge>
      );
    }
    if (group.allAReceber) {
      return (
        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">
          Em Aberto
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30">
        Parcial
      </Badge>
    );
  };

  const getServiceSummary = (group: TransactionGroup) => {
    const count = group.transactions.length;
    if (count === 1) return group.descriptions[0] || "Serviço Avulso";

    const first = group.descriptions[0] || "Serviço";
    if (count === 2) return `${first} + 1 outro`;
    return `${first} + ${count - 1} outros`;
  };

  return (
    <TooltipProvider>
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
        ) : groupedTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum lançamento registrado para este parceiro.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-36">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedTransactions.map((group) => {
                const isMulti = group.transactions.length > 1;
                const isExpanded = expandedGroups.has(group.key);

                return (
                  <Fragment key={group.key}>
                    {/* Group summary row */}
                    <TableRow
                      className={`${
                        group.allPago
                          ? "opacity-60"
                          : group.hasCancelado && !group.allAReceber
                          ? "opacity-80"
                          : ""
                      } ${isMulti ? "cursor-pointer hover:bg-muted/50" : ""}`}
                      onClick={isMulti ? () => toggleGroup(group.key) : undefined}
                    >
                      <TableCell className="px-2">
                        {isMulti && (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(group.date)}</TableCell>
                      <TableCell>
                        {group.ownerName && (
                          <span className="text-sm">{group.ownerName}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{group.patientName}</span>
                      </TableCell>
                      <TableCell>
                        {isMulti ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm cursor-default">
                                {getServiceSummary(group)}
                                {group.descriptions.length > 2 && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {group.transactions.length}
                                  </Badge>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-xs">
                              <ul className="text-xs space-y-1">
                                {group.transactions.map((tx) => (
                                  <li key={tx.id} className="flex justify-between gap-4">
                                    <span>{tx.description}</span>
                                    <span className="font-medium whitespace-nowrap">{formatCurrency(Number(tx.amount))}</span>
                                  </li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          group.transactions[0].description
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(group.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getGroupStatusBadge(group)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Adicionar Serviço"
                            onClick={() => openAddServiceToGroup(group)}
                            className="text-primary hover:text-primary"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          {!group.hasCancelado && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={group.allPago ? "Reabrir todos" : "Dar Baixa em todos"}
                              onClick={() => isMulti ? handleToggleGroupStatus(group) : handleToggleStatus(group.transactions[0])}
                              className={group.allAReceber ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                          {!isMulti && (
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(group.transactions[0])}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteGroupTarget(group)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded sub-items */}
                    {isMulti && isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="p-0 border-b">
                          <div className="bg-muted/30 px-6 py-3 space-y-1.5">
                            {group.transactions.map((tx) => (
                              <div
                                key={tx.id}
                                className={`flex items-center justify-between gap-4 py-1.5 px-3 rounded-md text-sm ${
                                  tx.status === "pago"
                                    ? "opacity-60"
                                    : tx.status === "cancelado"
                                    ? "opacity-40 line-through"
                                    : "bg-background/60"
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-muted-foreground text-xs">1×</span>
                                  <span className="truncate">{tx.description}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-medium w-24 text-right">{formatCurrency(Number(tx.amount))}</span>
                                  <Badge
                                    variant={tx.status === "pago" ? "default" : tx.status === "cancelado" ? "secondary" : "outline"}
                                    className={`text-xs w-20 justify-center ${
                                      tx.status === "pago"
                                        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                        : tx.status === "a_receber"
                                        ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                        : ""
                                    }`}
                                  >
                                    {statusLabel(tx.status)}
                                  </Badge>
                                  <div className="flex gap-0.5">
                                    {tx.status !== "cancelado" && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" title={tx.status === "pago" ? "Reabrir" : "Dar Baixa"} onClick={() => handleToggleStatus(tx)}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(tx)}>
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(tx.id)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Delete Group Dialog */}
        <AlertDialog open={!!deleteGroupTarget} onOpenChange={(open) => !open && setDeleteGroupTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Lançamento{deleteGroupTarget && deleteGroupTarget.transactions.length > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteGroupTarget && deleteGroupTarget.transactions.length > 1 ? (
                  <>
                    Este atendimento contém <strong>{deleteGroupTarget.transactions.length} serviços</strong> para{" "}
                    <strong>{deleteGroupTarget.patientName}</strong> em {formatDate(deleteGroupTarget.date)}.
                    <br /><br />
                    Deseja excluir todos os lançamentos deste atendimento? Para excluir itens específicos, expanda a linha e exclua individualmente.
                  </>
                ) : (
                  "Esta ação não pode ser desfeita. O lançamento será removido permanentemente."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              {deleteGroupTarget && deleteGroupTarget.transactions.length > 1 ? (
                <AlertDialogAction onClick={() => deleteGroupTarget && handleDeleteGroup(deleteGroupTarget)}>
                  Excluir Todos ({deleteGroupTarget.transactions.length})
                </AlertDialogAction>
              ) : (
                <AlertDialogAction onClick={() => deleteGroupTarget && handleDelete(deleteGroupTarget.transactions[0].id).then(() => setDeleteGroupTarget(null))}>
                  Excluir
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch New Modal */}
        <BatchTransactionModal
          open={isBatchOpen}
          onOpenChange={setIsBatchOpen}
          services={services}
          partnerClinicId={clinicId}
          prefill={batchPrefill}
          onSave={handleBatchSave}
        />

        {/* Edit Dialog (single item) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Lançamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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

              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Input
                  value={txPatientName}
                  onChange={(e) => setTxPatientName(e.target.value)}
                  placeholder="Nome do animal"
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={txOwnerName}
                  onChange={(e) => setTxOwnerName(e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>

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

              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
              </div>

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
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
