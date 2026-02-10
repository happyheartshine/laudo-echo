import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Calendar, 
  Users, 
  TrendingUp, 
  Plus, 
  Search, 
  Settings,
  Eye,
  Stethoscope,
  CalendarDays,
  BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ExamData {
  id: string;
  patient_name: string;
  species: string | null;
  exam_date: string;
  owner_name: string | null;
}

interface MonthlyExamData {
  month: string;
  exames: number;
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [recentExams, setRecentExams] = useState<ExamData[]>([]);
  const [examCount, setExamCount] = useState(0);
  const [examsToday, setExamsToday] = useState(0);
  const [examsThisMonth, setExamsThisMonth] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyExamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      // Buscar últimos 5 exames
      const { data: recentData, error: recentError, count } = await supabase
        .from("exams")
        .select("id, patient_name, species, exam_date, owner_name", { count: "exact" })
        .order("exam_date", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      
      setRecentExams(recentData || []);
      setExamCount(count || 0);

      // Exames hoje
      const { count: todayCount } = await supabase
        .from("exams")
        .select("*", { count: "exact", head: true })
        .gte("exam_date", startOfDay.split("T")[0]);

      setExamsToday(todayCount || 0);

      // Exames este mês
      const { count: monthCount } = await supabase
        .from("exams")
        .select("*", { count: "exact", head: true })
        .gte("exam_date", startOfMonth.split("T")[0]);

      setExamsThisMonth(monthCount || 0);

      // Total de pacientes únicos
      const { data: patientsData } = await supabase
        .from("exams")
        .select("patient_name");

      const uniquePatients = new Set(patientsData?.map(e => e.patient_name.toLowerCase()));
      setTotalPatients(uniquePatients.size);

      // Dados dos últimos 6 meses para o gráfico
      const monthlyExams: MonthlyExamData[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        
        const { count: monthExamCount } = await supabase
          .from("exams")
          .select("*", { count: "exact", head: true })
          .gte("exam_date", monthDate.toISOString().split("T")[0])
          .lte("exam_date", monthEnd.toISOString().split("T")[0]);

        monthlyExams.push({
          month: monthDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          exames: monthExamCount || 0,
        });
      }
      setMonthlyData(monthlyExams);

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatFullDate = () => {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getGreetingPrefix = () => {
    if (profile?.sexo === "feminino") {
      return "Dra.";
    }
    return "Dr.";
  };

  const getUserDisplayName = () => {
    // 1. Tenta usar o nome do perfil
    if (profile?.nome) {
      const firstName = profile.nome.split(" ")[0];
      return firstName;
    }
    
    // 2. Tenta usar user_metadata do Supabase Auth
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(" ")[0];
    }
    if (user?.user_metadata?.name) {
      return user.user_metadata.name.split(" ")[0];
    }
    
    // 3. Usa o email sem domínio
    if (user?.email) {
      return user.email.split("@")[0];
    }
    
    // 4. Fallback final
    return "";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header de Boas-vindas */}
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Olá, {getGreetingPrefix()} {getUserDisplayName() || "Doutor(a)"}
          </h1>
          <p className="text-muted-foreground mt-1 capitalize">
            {formatFullDate()}
          </p>
        </div>

        {/* Cards de Métricas (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-vitaecor animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Exames Hoje</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "..." : examsToday}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-vitaecor animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Este Mês</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "..." : examsThisMonth}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-vitaecor animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Pacientes</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "..." : totalPatients}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-vitaecor animate-fade-in" style={{ animationDelay: "0.15s" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Exames</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? "..." : examCount}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas e Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ações Rápidas */}
          <Card className="card-vitaecor animate-fade-in lg:col-span-1" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full btn-cta justify-start gap-3 h-12"
                onClick={() => navigate('/novo-exame')}
              >
                <Plus className="h-5 w-5" />
                Novo Exame
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-11"
                onClick={() => navigate('/historico')}
              >
                <Search className="h-4 w-4" />
                Buscar Paciente
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-11"
                onClick={() => navigate('/configuracoes')}
              >
                <Settings className="h-4 w-4" />
                Configurações
              </Button>
            </CardContent>
          </Card>

          {/* Gráfico de Atividade */}
          <Card className="card-vitaecor animate-fade-in lg:col-span-2" style={{ animationDelay: "0.25s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Exames nos Últimos 6 Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                    />
                    <Bar 
                      dataKey="exames" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Exames"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista de Exames Recentes */}
        <Card className="card-vitaecor animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-accent" />
                Últimos Exames
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/historico')}>
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : recentExams.length === 0 ? (
              <div className="text-center py-12">
                <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum exame registrado ainda.</p>
                <Button onClick={() => navigate('/novo-exame')} className="btn-cta">
                  <FileText className="w-4 h-4 mr-2" />
                  Criar Primeiro Exame
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Data</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Paciente</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground hidden sm:table-cell">Responsável</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExams.map((exam) => (
                      <tr 
                        key={exam.id} 
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {formatDate(exam.exam_date)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground">{exam.patient_name}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            ({exam.species || "N/A"})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                          {exam.owner_name || "-"}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <Badge variant="secondary" className="bg-success/10 text-success border-0">
                            Concluído
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/exame/${exam.id}`)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
