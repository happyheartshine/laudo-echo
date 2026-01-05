import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileDown, Calendar, User, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface Exam {
  id: string;
  patient_name: string;
  owner_name: string | null;
  species: string | null;
  breed: string | null;
  exam_date: string;
  content: unknown;
  created_at: string;
}

// Função utilitária para formatar números no padrão BR
const formatNumber = (value: string | number): string => {
  if (value === "-" || value === "" || value === null || value === undefined) return "-";
  const str = typeof value === "number" ? value.toString() : value;
  return str.replace(".", ",");
};

export default function Historico() {
  const { user } = useAuth();
  const { profile, clinic } = useProfile();
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchExams();
    }
  }, [user]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("exam_date", { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error) {
      console.error("Erro ao carregar exames:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os exames.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter((exam) =>
    exam.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exam.owner_name && exam.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const generatePdfFromExam = useCallback(async (exam: Exam) => {
    const content = exam.content as {
      patientData?: { nome?: string; responsavel?: string; especie?: string; raca?: string; sexo?: string; idade?: string; peso?: string };
      examInfo?: { data?: string; solicitante?: string; clinica?: string; ritmo?: string; frequenciaCardiaca?: string };
      measurementsData?: { dvedDiastole?: string; dvedSistole?: string; septoIVd?: string; septoIVs?: string; paredeLVd?: string; paredeLVs?: string; aorta?: string; atrioEsquerdo?: string };
      funcaoDiastolica?: { ondaE?: string; ondaA?: string; tempoDesaceleracao?: string; triv?: string; tdiParedeLateral?: string; ePrime?: string; aPrime?: string; padraoDiastolico?: string };
      valvasDoppler?: { mitralVelocidade?: string; mitralGradiente?: string; mitralDpDt?: string; tricuspideVelocidade?: string; tricuspideGradiente?: string; pulmonarVelocidade?: string; pulmonarGradiente?: string; aorticaVelocidade?: string; aorticaGradiente?: string };
      outros?: { camarasDireitas?: string; septos?: string; pericardio?: string };
      valvesData?: { mitral?: string; tricuspide?: string; aortica?: string; pulmonar?: string };
      achados?: string;
      conclusoes?: string;
    };

    const patientData = content.patientData || {};
    const examInfo = content.examInfo || {};
    const measurementsData = content.measurementsData || {};
    const funcaoDiastolica = content.funcaoDiastolica || {};
    const valvasDoppler = content.valvasDoppler || {};
    const outros = content.outros || { camarasDireitas: "normais", septos: "interventricular e interatrial íntegros", pericardio: "normal, sem derrame" };
    const achados = content.achados || "";
    const conclusoes = content.conclusoes || "";

    // Cálculos automáticos
    const calculatedValues = {
      relacaoEA: (() => {
        const e = parseFloat(funcaoDiastolica.ondaE || "");
        const a = parseFloat(funcaoDiastolica.ondaA || "");
        return e && a ? (e / a).toFixed(2) : "-";
      })(),
      eTRIV: (() => {
        const e = parseFloat(funcaoDiastolica.ondaE || "");
        const triv = parseFloat(funcaoDiastolica.triv || "");
        return e && triv ? (e / triv).toFixed(2) : "-";
      })(),
      relacaoEePrime: (() => {
        const e = parseFloat(funcaoDiastolica.ondaE || "");
        const ePrime = parseFloat(funcaoDiastolica.ePrime || "");
        return e && ePrime ? (e / ePrime).toFixed(2) : "-";
      })(),
      fracaoEncurtamento: (() => {
        const dved = parseFloat(measurementsData.dvedDiastole || "");
        const dves = parseFloat(measurementsData.dvedSistole || "");
        return dved && dves ? (((dved - dves) / dved) * 100).toFixed(1) : "-";
      })(),
      fracaoEjecao: (() => {
        const dved = parseFloat(measurementsData.dvedDiastole || "");
        const dves = parseFloat(measurementsData.dvedSistole || "");
        if (!dved || !dves) return "-";
        const vdf = (7 * Math.pow(dved, 3)) / (2.4 + dved);
        const vsf = (7 * Math.pow(dves, 3)) / (2.4 + dves);
        const fe = ((vdf - vsf) / vdf) * 100;
        return fe.toFixed(1);
      })(),
    };

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const navyBlue = [26, 42, 82];
    let yPosition = 25;

    // Header
    const addHeader = async () => {
      pdf.setFillColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.rect(0, 0, pageWidth, 25, 'F');

      if (clinic?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = clinic.logo_url!;
          });
          const maxHeight = 18;
          const ratio = img.width / img.height;
          const imgHeight = Math.min(maxHeight, img.height);
          const imgWidth = imgHeight * ratio;
          pdf.addImage(img, 'PNG', margin, 3, Math.min(imgWidth, 35), imgHeight);
        } catch (e) {
          console.error('Error loading logo:', e);
        }
      }

      // Right side header info
      const rightX = pageWidth - margin;
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Ecodopplercardiograma", rightX, 8, { align: "right" });
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      if (profile?.nome) pdf.text(profile.nome, rightX, 13, { align: "right" });
      if (profile?.crmv) pdf.text(`CRMV ${profile.uf_crmv || ""} ${profile.crmv}`, rightX, 17, { align: "right" });
      if (profile?.telefone) pdf.text(profile.telefone, rightX, 21, { align: "right" });
    };

    await addHeader();
    yPosition = 35;

    // Title
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATÓRIO DE ESTUDO ECOCARDIOGRÁFICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Patient Info
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    const col1 = margin;
    const col2 = pageWidth / 2;
    const labelOffset = 2;

    const addCompactRow = (label1: string, value1: string, label2: string, value2: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label1, col1, yPosition);
      pdf.setFont("helvetica", "normal");
      const label1Width = pdf.getTextWidth(label1);
      pdf.text(value1, col1 + label1Width + labelOffset, yPosition);
      
      pdf.setFont("helvetica", "bold");
      pdf.text(label2, col2, yPosition);
      pdf.setFont("helvetica", "normal");
      const label2Width = pdf.getTextWidth(label2);
      pdf.text(value2, col2 + label2Width + labelOffset, yPosition);
      yPosition += 4.5;
    };

    addCompactRow("Paciente:", patientData.nome || '-', "Espécie:", patientData.especie || '-');
    addCompactRow("Raça:", patientData.raca || '-', "Sexo:", patientData.sexo || '-');
    addCompactRow("Idade:", patientData.idade || '-', "Peso:", patientData.peso ? `${formatNumber(patientData.peso)} kg` : '-');
    addCompactRow("Tutor(a):", patientData.responsavel || '-', "Data:", examInfo.data || '-');
    addCompactRow("Solicitante:", examInfo.solicitante || '-', "Clínica/Hospital:", examInfo.clinica || '-');
    yPosition += 6;

    // Helper functions
    const addSectionHeader = (title: string) => {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, "F");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, margin + 2, yPosition);
      yPosition += 8;
    };

    const addTableRow = (label: string, value: string) => {
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${label}: ${value}`, margin, yPosition);
      yPosition += 5;
    };

    // Parâmetros
    addSectionHeader("PARÂMETROS OBSERVADOS");
    addTableRow("Ritmo", examInfo.ritmo || '-');
    addTableRow("Frequência Cardíaca", `${examInfo.frequenciaCardiaca || '-'} bpm`);
    yPosition += 5;

    // Ventrículo Esquerdo
    addSectionHeader("VENTRÍCULO ESQUERDO (MODO M)");
    const pesoNum = parseFloat(patientData.peso || "");
    const dvedNum = parseFloat(measurementsData.dvedDiastole || "");
    const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '-';

    addTableRow("Septo interventricular em diástole", `${formatNumber(measurementsData.septoIVd || '-')} cm`);
    addTableRow("Ventrículo esquerdo em diástole", `${formatNumber(measurementsData.dvedDiastole || '-')} cm`);
    addTableRow("Parede livre do VE em diástole", `${formatNumber(measurementsData.paredeLVd || '-')} cm`);
    addTableRow("Ventrículo esquerdo em sístole", `${formatNumber(measurementsData.dvedSistole || '-')} cm`);
    addTableRow("VE em diástole NORMALIZADO", formatNumber(dvedNorm));
    addTableRow("Fração de Encurtamento", `${formatNumber(calculatedValues.fracaoEncurtamento)}%`);
    addTableRow("Fração de Ejeção (Teicholz)", `${formatNumber(calculatedValues.fracaoEjecao)}%`);
    yPosition += 3;

    // Átrio e Aorta
    addSectionHeader("ÁTRIO ESQUERDO E AORTA (MODO B)");
    const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta 
      ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2) 
      : '-';
    addTableRow("Aorta", `${formatNumber(measurementsData.aorta || '-')} cm`);
    addTableRow("Átrio esquerdo", `${formatNumber(measurementsData.atrioEsquerdo || '-')} cm`);
    addTableRow("Relação Átrio esquerdo/Aorta", formatNumber(aeAo));
    yPosition += 3;

    // Função Diastólica
    addSectionHeader("FUNÇÃO DIASTÓLICA DO VENTRÍCULO ESQUERDO");
    addTableRow("Velocidade da onda E", `${formatNumber(funcaoDiastolica.ondaE || '-')} cm/s`);
    addTableRow("Velocidade da onda A", `${formatNumber(funcaoDiastolica.ondaA || '-')} cm/s`);
    addTableRow("Relação onda E/A", formatNumber(calculatedValues.relacaoEA));
    addTableRow("Tempo de desaceleração da onda E", `${formatNumber(funcaoDiastolica.tempoDesaceleracao || '-')} ms`);
    addTableRow("TRIV", `${formatNumber(funcaoDiastolica.triv || '-')} ms`);
    addTableRow("E/TRIV", formatNumber(calculatedValues.eTRIV));
    addTableRow("Relação E/e'", formatNumber(calculatedValues.relacaoEePrime));
    yPosition += 3;

    // Avaliação Hemodinâmica
    addSectionHeader("AVALIAÇÃO HEMODINÂMICA");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("VALVA MITRAL", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo retrógrado da IM", `${formatNumber(valvasDoppler.mitralVelocidade || '-')} cm/s`);
    addTableRow("Gradiente", `${formatNumber(valvasDoppler.mitralGradiente || '-')} mmHg`);
    addTableRow("+dP/dT", `${formatNumber(valvasDoppler.mitralDpDt || '-')} mmHg/s`);
    yPosition += 3;

    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA TRICÚSPIDE", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo retrógrado da IT", `${formatNumber(valvasDoppler.tricuspideVelocidade || '-')} cm/s`);
    addTableRow("Gradiente", `${formatNumber(valvasDoppler.tricuspideGradiente || '-')} mmHg`);
    yPosition += 3;

    // Page break if needed
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      await addHeader();
      yPosition = 45;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA PULMONAR", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo transvalvar", `${formatNumber(valvasDoppler.pulmonarVelocidade || '-')} cm/s`);
    addTableRow("Gradiente", `${formatNumber(valvasDoppler.pulmonarGradiente || '-')} mmHg`);
    yPosition += 3;

    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA AÓRTICA", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo transvalvar", `${formatNumber(valvasDoppler.aorticaVelocidade || '-')} cm/s`);
    addTableRow("Gradiente", `${formatNumber(valvasDoppler.aorticaGradiente || '-')} mmHg`);
    yPosition += 3;

    // Outros
    addSectionHeader("OUTROS");
    addTableRow("Câmaras Direitas", outros.camarasDireitas || "normais");
    addTableRow("Septos", outros.septos || "interventricular e interatrial íntegros");
    addTableRow("Pericárdio", outros.pericardio || "normal, sem derrame");
    yPosition += 5;

    // Achados
    if (achados) {
      addSectionHeader("ACHADOS ECOCARDIOGRÁFICOS");
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(achados, pageWidth - 2 * margin);
      for (const line of lines) {
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
      yPosition += 3;
    }

    // Conclusões
    if (conclusoes) {
      addSectionHeader("CONCLUSÕES E COMENTÁRIOS");
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(conclusoes, pageWidth - 2 * margin);
      for (const line of lines) {
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
    }

    // Signature
    yPosition += 10;
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(profile?.nome || "Veterinário Responsável", pageWidth / 2, yPosition, { align: "center" });
    if (profile?.crmv) {
      yPosition += 4;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`CRMV ${profile.uf_crmv || ""} ${profile.crmv}`, pageWidth / 2, yPosition, { align: "center" });
    }
    if (profile?.especialidade) {
      yPosition += 4;
      pdf.text(profile.especialidade, pageWidth / 2, yPosition, { align: "center" });
    }

    // Page numbers
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    return pdf;
  }, [clinic, profile]);

  const handleReprint = async (exam: Exam) => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto o laudo é gerado.",
      });

      const pdf = await generatePdfFromExam(exam);
      const today = new Date().toLocaleDateString('pt-BR');
      pdf.save(`laudo-${exam.patient_name}-${today.replace(/\//g, '-')}.pdf`);

      toast({
        title: "PDF gerado!",
        description: "O laudo foi baixado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus Exames</h1>
            <p className="text-muted-foreground">Histórico de laudos gerados</p>
          </div>
        </div>

        {/* Search */}
        <div className="card-vitaecor mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do paciente ou tutor..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="card-vitaecor">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum exame encontrado para esta busca." : "Nenhum exame salvo ainda."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Data
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Paciente</th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Tutor
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Espécie</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((exam) => (
                    <tr key={exam.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-foreground">{formatDate(exam.exam_date)}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{exam.patient_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{exam.owner_name || "-"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{exam.species || "-"}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReprint(exam)}
                          className="gap-2"
                        >
                          <FileDown className="w-4 h-4" />
                          Reimprimir PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {!loading && filteredExams.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            {filteredExams.length} exame{filteredExams.length !== 1 ? "s" : ""} encontrado{filteredExams.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </Layout>
  );
}