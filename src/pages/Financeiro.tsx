import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, Building2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ClinicSummary {
  id: string;
  nome: string;
  total_exames: number;
  total_devido: number;
}

export default function Financeiro() {
  const { user } = useAuth();
  const [clinicsSummary, setClinicsSummary] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAReceber, setTotalAReceber] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);
  const [totalExamesMes, setTotalExamesMes] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch exams with price and clinic info
    const { data: examsData, error: examsError } = await supabase
      .from("exams")
      .select(`
        id,
        exam_date,
        exam_price,
        partner_clinic_id,
        partner_clinics (
          id,
          nome
        )
      `)
      .not("partner_clinic_id", "is", null);

    if (examsError) {
      console.error("Error fetching exams:", examsError);
      setLoading(false);
      return;
    }

    // Get current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Group exams by clinic and calculate totals
    const clinicMap = new Map<string, { nome: string; total_exames: number; total_devido: number }>();
    let monthTotal = 0;
    let monthExamCount = 0;

    (examsData || []).forEach((exam: any) => {
      if (!exam.partner_clinic_id || !exam.partner_clinics) return;
      
      const clinicId = exam.partner_clinic_id;
      const clinicName = exam.partner_clinics.nome || "Clínica Desconhecida";
      const price = Number(exam.exam_price) || 0;
      
      if (!clinicMap.has(clinicId)) {
        clinicMap.set(clinicId, {
          nome: clinicName,
          total_exames: 0,
          total_devido: 0,
        });
      }
      
      const clinic = clinicMap.get(clinicId)!;
      clinic.total_exames += 1;
      clinic.total_devido += price;
      
      // Check if exam is from current month
      if (exam.exam_date >= startOfMonth && exam.exam_date <= endOfMonth) {
        monthTotal += price;
        monthExamCount += 1;
      }
    });

    // Convert map to array and sort by name
    const summary: ClinicSummary[] = Array.from(clinicMap.entries())
      .map(([id, data]) => ({
        id,
        ...data,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    setClinicsSummary(summary);

    // Calculate totals
    const total = summary.reduce((acc, c) => acc + c.total_devido, 0);
    setTotalAReceber(total);
    setReceitaMes(monthTotal);
    setTotalExamesMes(monthExamCount);

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMonthName = () => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">
            Acompanhe sua receita e valores a receber
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(totalAReceber)}
              </div>
              <p className="text-xs text-muted-foreground">
                Soma de todos os exames
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
                {formatCurrency(receitaMes)}
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
              <div className="text-2xl font-bold">{totalExamesMes}</div>
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
                Com exames registrados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Clinics Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Resumo por Clínica
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : clinicsSummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum exame com clínica vinculada.</p>
                <p className="text-sm">
                  Vincule clínicas aos exames para ver o resumo financeiro.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead className="text-right">Exames</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinicsSummary.map((clinic) => (
                    <TableRow key={clinic.id}>
                      <TableCell className="font-medium">{clinic.nome}</TableCell>
                      <TableCell className="text-right">{clinic.total_exames}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(clinic.total_devido)}
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
