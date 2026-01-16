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
import { DollarSign, TrendingUp, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PartnerClinic {
  id: string;
  nome: string;
  valor_exame: number;
}

interface ClinicSummary {
  id: string;
  nome: string;
  valor_exame: number;
  total_exames: number;
  total_devido: number;
}

export default function Financeiro() {
  const { user } = useAuth();
  const [clinicsSummary, setClinicsSummary] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAReceber, setTotalAReceber] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch partner clinics
    const { data: clinicsData, error: clinicsError } = await supabase
      .from("partner_clinics")
      .select("id, nome, valor_exame")
      .order("nome");

    if (clinicsError) {
      console.error("Error fetching partner clinics:", clinicsError);
      setLoading(false);
      return;
    }

    // For now, we'll create placeholder data since exams aren't linked to partner_clinics yet
    // In the future, this will count exams per clinic
    const summary: ClinicSummary[] = (clinicsData || []).map((clinic) => ({
      id: clinic.id,
      nome: clinic.nome,
      valor_exame: clinic.valor_exame,
      total_exames: 0, // Placeholder - will be populated when exams are linked
      total_devido: 0, // Placeholder
    }));

    setClinicsSummary(summary);

    // Calculate totals (placeholder values for now)
    const total = summary.reduce((acc, c) => acc + c.total_devido, 0);
    setTotalAReceber(total);
    setReceitaMes(total); // Same for now

    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                Soma dos exames não pagos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(receitaMes)}
              </div>
              <p className="text-xs text-muted-foreground">
                Janeiro 2026
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
                Total de parceiros
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
                <p>Nenhuma clínica parceira cadastrada.</p>
                <p className="text-sm">
                  Cadastre suas clínicas na página "Parceiros" para começar.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead className="text-right">Valor/Exame</TableHead>
                    <TableHead className="text-right">Exames</TableHead>
                    <TableHead className="text-right">Total Devido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinicsSummary.map((clinic) => (
                    <TableRow key={clinic.id}>
                      <TableCell className="font-medium">{clinic.nome}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(clinic.valor_exame)}
                      </TableCell>
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
          <p className="font-medium mb-1">💡 Próximos Passos</p>
          <p>
            Ao vincular os exames às clínicas parceiras, os valores serão
            calculados automaticamente aqui.
          </p>
        </div>
      </div>
    </Layout>
  );
}
