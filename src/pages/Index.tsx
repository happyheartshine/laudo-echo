import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { FileText, Clock, TrendingUp, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  const stats = [
    { label: "Exames este mês", value: "24", icon: FileText, trend: "+12%" },
    { label: "Tempo médio por laudo", value: "8 min", icon: Clock, trend: "-15%" },
    { label: "Taxa de conclusão", value: "98%", icon: TrendingUp, trend: "+3%" },
  ];

  const recentExams = [
    { patient: "Rex", species: "Canino", date: "03/01/2026", status: "Concluído" },
    { patient: "Mia", species: "Felino", date: "02/01/2026", status: "Concluído" },
    { patient: "Thor", species: "Canino", date: "02/01/2026", status: "Rascunho" },
    { patient: "Luna", species: "Felino", date: "01/01/2026", status: "Concluído" },
  ];

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
          {stats.map((stat, index) => (
            <div 
              key={stat.label} 
              className="card-vitaecor animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="mt-3 text-sm text-success font-medium">{stat.trend} vs. mês anterior</p>
            </div>
          ))}
        </div>

        {/* Recent Exams */}
        <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Exames Recentes
            </h2>
            <Button variant="outline" size="sm">
              Ver todos
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Paciente</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Espécie</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentExams.map((exam, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">{exam.patient}</td>
                    <td className="py-3 px-4 text-muted-foreground">{exam.species}</td>
                    <td className="py-3 px-4 text-muted-foreground">{exam.date}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        exam.status === 'Concluído' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {exam.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
