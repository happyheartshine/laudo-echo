import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();
  
  const [allExams, setAllExams] = useState<ExamRecord[]>([]);
  const [partnerClinics, setPartnerClinics] = useState<PartnerClinic[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [showReport, setShowReport] = useState(false);

  // Sharing states
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

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

    setLoading(false);
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

  // Calculate summary by clinic
  const clinicsSummary = useMemo(() => {
    const clinicMap = new Map<string, ClinicSummary>();

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

    return Array.from(clinicMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filteredExams]);

  // Calculate totals
  const totalAReceber = useMemo(() => {
    return clinicsSummary.reduce((acc, c) => acc + c.total_devido, 0);
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
              <Button onClick={() => setShowReport(true)}>
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

                  {/* Totals */}
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Exames</p>
                        <p className="text-xl font-bold">{totalExames}</p>
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
            e seus respectivos preços. Para definir preços por serviço, acesse a página
            de <a href="/parceiros" className="text-primary underline">Parceiros</a> e
            configure a Tabela de Preços de cada clínica.
          </p>
        </div>
      </div>
    </Layout>
  );
}
