import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { FileText, Clock, TrendingUp, Activity, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ExamData {
  id: string;
  patient_name: string;
  species: string | null;
  exam_date: string;
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentExams, setRecentExams] = useState<ExamData[]>([]);
  const [examCount, setExamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRecentExams();
    }
  }, [user]);

  const fetchRecentExams = async () => {
    try {
      setLoading(true);
      
      // Buscar últimos 5 exames
      const { data, error, count } = await supabase
        .from("exams")
        .select("id, patient_name, species, exam_date", { count: "exact" })
        .order("exam_date", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setRecentExams(data || []);
      setExamCount(count || 0);
    } catch (error) {
      console.error("Erro ao carregar exames:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao VitaeCor
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema de laudos ecocardiográficos veterinários
          </p>
        </div>

        {/* Quick Actions */}
        <div className="card-vitaecor mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Iniciar Novo Exame
              </h2>
              <p className="text-muted-foreground">
                Crie um novo laudo ecocardiográfico com cálculos automáticos
              </p>
            </div>
            <Button 
              className="btn-cta"
              size="lg"
              onClick={() => navigate('/novo-exame')}
            >
              <FileText className="w-5 h-5 mr-2" />
              Novo Exame
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card-vitaecor animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Exames</p>
                <p className="text-3xl font-bold text-foreground">{loading ? "..." : examCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Exames Recentes</p>
                <p className="text-3xl font-bold text-foreground">{loading ? "..." : recentExams.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sistema</p>
                <p className="text-3xl font-bold text-foreground">Ativo</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Exams */}
        <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Exames Recentes
            </h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/historico')}>
              Ver todos
            </Button>
          </div>

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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Espécie</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.map((exam) => (
                    <tr 
                      key={exam.id} 
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                      onClick={() => navigate('/historico')}
                    >
                      <td className="py-3 px-4 font-medium text-foreground">{exam.patient_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{exam.species || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(exam.exam_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}