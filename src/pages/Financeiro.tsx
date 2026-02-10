import { useState, useEffect, useMemo, Fragment } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  TrendingUp,
  Building2,
  FileText,
  Filter,
  CalendarIcon,
  MessageCircle,
  Mail,
  Download,
  X,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BatchTransactionModal, type BatchSaveItem } from "@/components/partners/BatchTransactionModal";

interface PartnerClinic {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  logo_url: string | null;
}

interface ExamRecord {
  id: string;
  patient_name: string;
  exam_date: string;
  exam_price: number | null;
  partner_clinic_id: string | null;
  partner_clinics: PartnerClinic | null;
}

interface FinancialTransaction {
  id: string;
  description: string;
  transaction_date: string;
  amount: number;
  status: string;
  partner_clinic_id: string | null;
  exam_id: string | null;
  service_id: string | null;
  patient_name: string | null;
  owner_name: string | null;
  partner_clinics: PartnerClinic | null;
}

interface ClinicSummary {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  logo_url: string | null;
  total_exames: number;
  total_devido: number;
}

export default function Financeiro() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [allExams, setAllExams] = useState<ExamRecord[]>([]);
  const [manualTransactions, setManualTransactions] = useState<FinancialTransaction[]>([]);
  const [partnerClinics, setPartnerClinics] = useState<PartnerClinic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [showReport, setShowReport] = useState(false);

  // Manual transaction modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [batchPrefill, setBatchPrefill] = useState<{ patientName?: string; ownerName?: string; date?: string } | undefined>(undefined);

  // Sharing states
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  // Expanded groups for manual transactions
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all partner clinics
    const { data: clinicsData } = await supabase
      .from("partner_clinics")
      .select("id, nome, telefone, email, logo_url")
      .eq("active", true)
      .order("nome");

    if (clinicsData) {
      setPartnerClinics(clinicsData);
    }

    // Fetch all exams with price and clinic info
    const { data: examsData, error: examsError } = await supabase
      .from("exams")
      .select(`
        id,
        patient_name,
        exam_date,
        exam_price,
        partner_clinic_id,
        partner_clinics (
          id,
          nome,
          telefone,
          email,
          logo_url
        )
      `)
      .not("partner_clinic_id", "is", null)
      .order("exam_date", { ascending: false });

    if (examsError) {
      console.error("Error fetching exams:", examsError);
    } else {
      setAllExams((examsData || []) as unknown as ExamRecord[]);
    }

    // Fetch manual transactions (without exam_id linked)
    const { data: transactionsData, error: transactionsError } = await supabase
      .from("financial_transactions")
      .select(`
        id,
        description,
        transaction_date,
        amount,
        status,
        partner_clinic_id,
        exam_id,
        service_id,
        patient_name,
        owner_name,
        partner_clinics (
          id,
          nome,
          telefone,
          email,
          logo_url
        )
      `)
      .is("exam_id", null)
      .order("transaction_date", { ascending: false });

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
    } else {
      setManualTransactions((transactionsData || []) as unknown as FinancialTransaction[]);
    }

    setLoading(false);
  };

  // Handle batch transaction save from global modal
  const handleBatchTransactionSave = async (items: BatchSaveItem[]) => {
    if (!user) return;

    const rows = items.map((item) => ({
      user_id: user.id,
      clinic_id: profile?.clinic_id || null,
      partner_clinic_id: item.partnerClinicId,
      description: item.description,
      transaction_date: item.date,
      amount: item.amount,
      status: "a_receber" as const,
      service_id: item.serviceId || null,
      patient_name: item.patientName || null,
      owner_name: item.ownerName || null,
    }));

    const { error } = await supabase.from("financial_transactions").insert(rows);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o(s) lançamento(s).",
        variant: "destructive",
      });
      throw error;
    }

    toast({
      title: "Lançamento(s) registrado(s)!",
      description: `${items.length} lançamento(s) salvo(s) com sucesso.`,
    });

    fetchData();
  };

  // Filter exams based on selected filters
  const filteredExams = useMemo(() => {
    return allExams.filter((exam) => {
      // Filter by clinic
      if (selectedClinicId !== "all" && exam.partner_clinic_id !== selectedClinicId) {
        return false;
      }

      // Filter by date range
      if (dateFrom && exam.exam_date < format(dateFrom, "yyyy-MM-dd")) {
        return false;
      }
      if (dateTo && exam.exam_date > format(dateTo, "yyyy-MM-dd")) {
        return false;
      }

      return true;
    });
  }, [allExams, selectedClinicId, dateFrom, dateTo]);

  // Filter manual transactions based on selected filters
  const filteredManualTransactions = useMemo(() => {
    return manualTransactions.filter((tx) => {
      // Filter by clinic
      if (selectedClinicId !== "all" && tx.partner_clinic_id !== selectedClinicId) {
        return false;
      }

      // Filter by date range
      if (dateFrom && tx.transaction_date < format(dateFrom, "yyyy-MM-dd")) {
        return false;
      }
      if (dateTo && tx.transaction_date > format(dateTo, "yyyy-MM-dd")) {
        return false;
      }

      return true;
    });
  }, [manualTransactions, selectedClinicId, dateFrom, dateTo]);

  // Group manual transactions by date + patient + clinic
  interface TxGroup {
    key: string;
    date: string;
    patientName: string;
    ownerName: string | null;
    clinicName: string | null;
    partnerId: string | null;
    transactions: FinancialTransaction[];
    totalAmount: number;
    descriptions: string[];
    allPago: boolean;
    allAReceber: boolean;
  }

  const groupedManualTransactions = useMemo(() => {
    const map = new Map<string, TxGroup>();

    for (const tx of filteredManualTransactions) {
      const key = `${tx.transaction_date}__${(tx.patient_name || "").toLowerCase().trim()}__${tx.partner_clinic_id || ""}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          date: tx.transaction_date,
          patientName: tx.patient_name || "—",
          ownerName: tx.owner_name,
          clinicName: tx.partner_clinics?.nome || null,
          partnerId: tx.partner_clinic_id,
          transactions: [],
          totalAmount: 0,
          descriptions: [],
          allPago: true,
          allAReceber: true,
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
    }

    return Array.from(map.values());
  }, [filteredManualTransactions]);

  const toggleTxGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getGroupServiceSummary = (group: TxGroup) => {
    const count = group.transactions.length;
    if (count === 1) return group.descriptions[0] || "Serviço Avulso";
    const first = group.descriptions[0] || "Serviço";
    if (count === 2) return `${first} + 1 outro`;
    return `${first} + ${count - 1} outros`;
  };

  const getGroupStatusBadge = (group: TxGroup) => {
    if (group.allPago) return <Badge variant="default">Pago</Badge>;
    if (group.allAReceber) return <Badge variant="outline">A Receber</Badge>;
    return <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30">Parcial</Badge>;
  };

  const clinicsSummary = useMemo(() => {
    const clinicMap = new Map<string, ClinicSummary>();

    // Add exams
    filteredExams.forEach((exam) => {
      if (!exam.partner_clinic_id || !exam.partner_clinics) return;

      const clinicId = exam.partner_clinic_id;
      const price = Number(exam.exam_price) || 0;

      if (!clinicMap.has(clinicId)) {
        clinicMap.set(clinicId, {
          id: clinicId,
          nome: exam.partner_clinics.nome,
          telefone: exam.partner_clinics.telefone,
          email: exam.partner_clinics.email,
          logo_url: exam.partner_clinics.logo_url,
          total_exames: 0,
          total_devido: 0,
        });
      }

      const clinic = clinicMap.get(clinicId)!;
      clinic.total_exames += 1;
      clinic.total_devido += price;
    });

    // Add manual transactions
    filteredManualTransactions.forEach((tx) => {
      if (!tx.partner_clinic_id || !tx.partner_clinics) return;

      const clinicId = tx.partner_clinic_id;
      const amount = Number(tx.amount) || 0;

      if (!clinicMap.has(clinicId)) {
        clinicMap.set(clinicId, {
          id: clinicId,
          nome: tx.partner_clinics.nome,
          telefone: tx.partner_clinics.telefone,
          email: tx.partner_clinics.email,
          logo_url: tx.partner_clinics.logo_url,
          total_exames: 0,
          total_devido: 0,
        });
      }

      const clinic = clinicMap.get(clinicId)!;
      clinic.total_devido += amount;
    });

    return Array.from(clinicMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filteredExams, filteredManualTransactions]);

  // Calculate totals
  const totalAReceber = useMemo(() => {
    const examTotal = clinicsSummary.reduce((acc, c) => acc + c.total_devido, 0);
    return examTotal;
  }, [clinicsSummary]);

  const totalExames = useMemo(() => {
    return clinicsSummary.reduce((acc, c) => acc + c.total_exames, 0);
  }, [clinicsSummary]);

  // Get current month stats (for cards)
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    let total = 0;
    let count = 0;

    allExams.forEach((exam) => {
      if (exam.exam_date >= monthStart && exam.exam_date <= monthEnd) {
        total += Number(exam.exam_price) || 0;
        count += 1;
      }
    });

    return { total, count };
  }, [allExams]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
  };

  const getMonthName = () => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const getSelectedClinic = () => {
    return partnerClinics.find((c) => c.id === selectedClinicId);
  };

  // Generate report text for sharing
  const generateReportText = () => {
    const clinic = getSelectedClinic();
    const clinicName = clinic?.nome || "Todas as Clínicas";
    const fromStr = dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início";
    const toStr = dateTo ? format(dateTo, "dd/MM/yyyy") : "Hoje";

    let text = `📋 *EXTRATO DE SERVIÇOS*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🏥 Parceiro: ${clinicName}\n`;
    text += `📅 Período: ${fromStr} a ${toStr}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (selectedClinicId !== "all") {
      // Detailed report for single clinic
      filteredExams.forEach((exam, index) => {
        text += `${index + 1}. ${exam.patient_name}\n`;
        text += `   📅 ${formatDate(exam.exam_date)} - ${formatCurrency(Number(exam.exam_price) || 0)}\n\n`;
      });
    } else {
      // Summary by clinic
      clinicsSummary.forEach((clinic) => {
        text += `🏥 ${clinic.nome}\n`;
        text += `   ${clinic.total_exames} exames - ${formatCurrency(clinic.total_devido)}\n\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *TOTAL: ${formatCurrency(totalAReceber)}*\n`;
    text += `📈 Total de Exames: ${totalExames}\n`;

    return text;
  };

  // Share via WhatsApp
  const handleWhatsAppShare = () => {
    const clinic = getSelectedClinic();
    const phone = clinic?.telefone?.replace(/\D/g, "") || "";
    const fromStr = dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início";
    const toStr = dateTo ? format(dateTo, "dd/MM/yyyy") : "Hoje";

    const message = `Olá ${clinic?.nome || "Parceiro"}, segue o resumo dos serviços prestados de ${fromStr} a ${toStr}.\n\n*Total: ${formatCurrency(totalAReceber)}*\n\nExames realizados: ${totalExames}\n\nAguardo confirmação para envio do extrato detalhado. 📋`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = phone
      ? `https://wa.me/55${phone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
  };

  // Share via Email
  const handleEmailShare = () => {
    const clinic = getSelectedClinic();
    const email = clinic?.email || "";
    const fromStr = dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início";
    const toStr = dateTo ? format(dateTo, "dd/MM/yyyy") : "Hoje";

    const subject = encodeURIComponent(
      `Extrato de Serviços - ${fromStr} a ${toStr}`
    );
    const body = encodeURIComponent(generateReportText().replace(/\*/g, ""));

    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, "_blank");
  };

  // Quick date filters
  const setQuickFilter = (period: "thisMonth" | "lastMonth" | "last3Months" | "all") => {
    const now = new Date();
    switch (period) {
      case "thisMonth":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setDateFrom(startOfMonth(lastMonth));
        setDateTo(endOfMonth(lastMonth));
        break;
      case "last3Months":
        setDateFrom(startOfMonth(subMonths(now, 2)));
        setDateTo(endOfMonth(now));
        break;
      case "all":
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
    }
  };

  const clearFilters = () => {
    setSelectedClinicId("all");
    setDateFrom(startOfMonth(new Date()));
    setDateTo(endOfMonth(new Date()));
    setShowReport(false);
  };

  return (
    <TooltipProvider>
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">
            Acompanhe sua receita e gerencie cobranças de parceiros
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Filtrado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totalAReceber)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalExames} exames no período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(currentMonthStats.total)}
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {getMonthName()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exames no Mês</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMonthStats.count}</div>
              <p className="text-xs text-muted-foreground capitalize">
                {getMonthName()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clínicas Parceiras</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clinicsSummary.length}</div>
              <p className="text-xs text-muted-foreground">
                No período filtrado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros e Relatório de Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter("thisMonth")}
              >
                Este Mês
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter("lastMonth")}
              >
                Mês Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter("last3Months")}
              >
                Últimos 3 Meses
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickFilter("all")}
              >
                Todo Período
              </Button>
            </div>

            <Separator />

            {/* Main Filters */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Partner Clinic Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Clínica Parceira</label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Clínicas</SelectItem>
                    {partnerClinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Hoje"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => { setBatchPrefill(undefined); setShowManualModal(true); }} variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Novo Lançamento
              </Button>
              <Button onClick={() => setShowReport(true)} variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Gerar Extrato
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Report (when generated) */}
        {showReport && (
          <Card className="border-primary/50">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Extrato de Serviços
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedClinicId !== "all"
                      ? getSelectedClinic()?.nome
                      : "Todas as Clínicas"}{" "}
                    • {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Início"} a{" "}
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Hoje"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowReport(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {filteredExams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum exame encontrado no período selecionado.
                </div>
              ) : (
                <>
                  {/* Exams Table */}
                  {filteredExams.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Exames</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Paciente</TableHead>
                            {selectedClinicId === "all" && <TableHead>Clínica</TableHead>}
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredExams.map((exam) => (
                            <TableRow key={exam.id}>
                              <TableCell>{formatDate(exam.exam_date)}</TableCell>
                              <TableCell className="font-medium">{exam.patient_name}</TableCell>
                              {selectedClinicId === "all" && (
                                <TableCell>
                                  <Badge variant="secondary">
                                    {exam.partner_clinics?.nome}
                                  </Badge>
                                </TableCell>
                              )}
                              <TableCell className="text-right">
                                {formatCurrency(Number(exam.exam_price) || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}

                  {/* Manual Transactions Table - Grouped */}
                  {groupedManualTransactions.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 mt-6">Outros Lançamentos</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead>Serviço</TableHead>
                            {selectedClinicId === "all" && <TableHead>Clínica</TableHead>}
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedManualTransactions.map((group) => {
                            const isMulti = group.transactions.length > 1;
                            const isExpanded = expandedGroups.has(group.key);

                            return (
                              <Fragment key={group.key}>
                                <TableRow
                                  className={`${group.allPago ? "opacity-60" : ""} ${isMulti ? "cursor-pointer hover:bg-muted/50" : ""}`}
                                  onClick={isMulti ? () => toggleTxGroup(group.key) : undefined}
                                >
                                  <TableCell className="px-2">
                                    {isMulti && (
                                      isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                  </TableCell>
                                  <TableCell>{formatDate(group.date)}</TableCell>
                                  <TableCell>
                                    {group.ownerName && (
                                      <span className="text-sm">{group.ownerName}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-medium">{group.patientName}</span>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {isMulti ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-default">{getGroupServiceSummary(group)}</span>
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
                                  {selectedClinicId === "all" && (
                                    <TableCell>
                                      {group.clinicName && <Badge variant="secondary">{group.clinicName}</Badge>}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(group.totalAmount)}
                                  </TableCell>
                                  <TableCell>{getGroupStatusBadge(group)}</TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Adicionar Serviço"
                                      onClick={() => {
                                        setBatchPrefill({
                                          patientName: group.patientName !== "—" ? group.patientName : "",
                                          ownerName: group.ownerName || "",
                                          date: group.date,
                                        });
                                        setShowManualModal(true);
                                      }}
                                      className="text-primary hover:text-primary"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>

                                {/* Expanded sub-items */}
                                {isMulti && isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={selectedClinicId === "all" ? 10 : 9} className="p-0 border-b">
                                      <div className="bg-muted/30 px-6 py-3 space-y-1.5">
                                        {group.transactions.map((tx) => (
                                          <div
                                            key={tx.id}
                                            className={`flex items-center justify-between gap-4 py-1.5 px-3 rounded-md text-sm ${
                                              tx.status === "pago" ? "opacity-60" : tx.status === "cancelado" ? "opacity-40 line-through" : "bg-background/60"
                                            }`}
                                          >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                              <span className="text-muted-foreground text-xs">1×</span>
                                              <span className="truncate">{tx.description}</span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                              <span className="font-medium">{formatCurrency(Number(tx.amount))}</span>
                                              <Badge
                                                variant={tx.status === "pago" ? "default" : tx.status === "cancelado" ? "destructive" : "outline"}
                                                className="text-xs"
                                              >
                                                {tx.status === "a_receber" ? "A Receber" : tx.status === "pago" ? "Pago" : "Cancelado"}
                                              </Badge>
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
                    </>
                  )}

                  {filteredExams.length === 0 && filteredManualTransactions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado no período selecionado.
                    </div>
                  )}

                  {/* Totals */}
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Exames</p>
                        <p className="text-xl font-bold">{totalExames}</p>
                        {filteredManualTransactions.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            + {filteredManualTransactions.length} lançamento(s) manual(is)
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Valor Total</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(totalAReceber)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Share Buttons */}
                  <Separator className="my-6" />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleWhatsAppShare}
                      className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Enviar via WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleEmailShare}
                      className="flex-1"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar por E-mail
                    </Button>
                  </div>

                  {selectedClinicId !== "all" && !getSelectedClinic()?.telefone && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      💡 Para enviar diretamente ao parceiro, cadastre o telefone na página de{" "}
                      <a href="/parceiros" className="text-primary underline">
                        Parceiros
                      </a>
                      .
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary by Clinic Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Resumo por Clínica
              {(selectedClinicId !== "all" || dateFrom || dateTo) && (
                <Badge variant="secondary" className="ml-2">
                  Filtrado
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando...
              </div>
            ) : clinicsSummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum exame encontrado no período.</p>
                <p className="text-sm">
                  Ajuste os filtros ou vincule clínicas aos exames.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead className="text-right">Qtd. Exames</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinicsSummary.map((clinic) => (
                    <TableRow key={clinic.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {clinic.logo_url ? (
                            <img
                              src={clinic.logo_url}
                              alt={clinic.nome}
                              className="w-8 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{clinic.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{clinic.total_exames}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(clinic.total_devido)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedClinicId(clinic.id);
                            setShowReport(true);
                          }}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Extrato
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Note */}
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          <p className="font-medium mb-1">💡 Como funciona</p>
          <p>
            Os valores são calculados automaticamente com base nos exames cadastrados
            e seus respectivos preços. Use o botão "Novo Lançamento" para registrar serviços 
            avulsos. Para definir preços por serviço, acesse a página
            de <a href="/parceiros" className="text-primary underline">Parceiros</a> e
            configure a Tabela de Preços de cada clínica.
          </p>
        </div>
      </div>

      {/* Batch Transaction Modal */}
      <BatchTransactionModal
        open={showManualModal}
        onOpenChange={setShowManualModal}
        partnerClinics={partnerClinics}
        prefill={batchPrefill}
        onSave={handleBatchTransactionSave}
      />
    </Layout>
    </TooltipProvider>
  );
}
