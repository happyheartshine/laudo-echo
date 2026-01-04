import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { MeasurementsSection } from "@/components/exam/MeasurementsSection";
import { ValvesSection } from "@/components/exam/ValvesSection";
import { Button } from "@/components/ui/button";
import { FileDown, Save, ArrowLeft, User, Calendar, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { PatientData } from "@/components/exam/PatientSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StoredImageData {
  name: string;
  type: string;
  dataUrl: string;
}

export default function DadosExame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  const [patientData, setPatientData] = useState<PatientData>({
    nome: "",
    responsavel: "",
    especie: "",
    raca: "",
    sexo: "",
    idade: "",
    peso: "",
  });

  const [examInfo, setExamInfo] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    solicitante: "",
    clinica: "",
    ritmo: "",
    frequenciaCardiaca: "",
  });

  const [measurementsData, setMeasurementsData] = useState({
    dvedDiastole: "",
    dvedSistole: "",
    septoIVd: "",
    septoIVs: "",
    paredeLVd: "",
    paredeLVs: "",
    aorta: "",
    atrioEsquerdo: "",
  });

  const [valvesData, setValvesData] = useState({
    mitral: "",
    tricuspide: "",
    aortica: "",
    pulmonar: "",
  });

  const [achados, setAchados] = useState("");
  const [conclusoes, setConclusoes] = useState("");
  const [storedImages, setStoredImages] = useState<StoredImageData[]>([]);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);

  useEffect(() => {
    // Load patient data from session storage
    const storedPatient = sessionStorage.getItem("examPatientData");
    if (storedPatient) {
      setPatientData(JSON.parse(storedPatient));
    } else {
      // No patient data, redirect back
      navigate("/novo-exame");
      return;
    }

    // Load images from session storage
    const storedImagesData = sessionStorage.getItem("examImages");
    if (storedImagesData) {
      setStoredImages(JSON.parse(storedImagesData));
    }

    const storedSelected = sessionStorage.getItem("examSelectedImages");
    if (storedSelected) {
      setSelectedImages(JSON.parse(storedSelected));
    }
  }, [navigate]);

  const handleSave = () => {
    toast({
      title: "Laudo salvo!",
      description: "O laudo foi salvo com sucesso no sistema.",
    });
  };

  const handleGeneratePDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Colors
    const navyBlue = [26, 42, 82];
    const red = [229, 41, 41];

    // Helper function to add a new page if needed
    const checkPageBreak = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - 20) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Header
    pdf.setFillColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.rect(0, 0, pageWidth, 25, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("VitaeCor", 15, 12);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Cardiologia Veterinária", 15, 18);
    
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Ecodopplercardiograma", pageWidth - 15, 12, { align: "right" });
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text("Paulo Roberto de Sousa, MV. MSc. Esp. Dipl. (SBCV)", pageWidth - 15, 17, { align: "right" });
    pdf.text("CRMV-GO 6414 | Fone: (62) 99332-2002", pageWidth - 15, 21, { align: "right" });

    yPosition = 35;

    // Title
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATÓRIO DE ESTUDO ECOCARDIOGRÁFICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Patient Info Grid
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    
    const col1 = margin;
    const col2 = pageWidth / 3;
    const col3 = (pageWidth / 3) * 2;
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Paciente:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.nome || '-', col1 + 22, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Espécie:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.especie || '-', col2 + 18, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Raça:", col3, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.raca || '-', col3 + 12, yPosition);
    
    yPosition += 6;
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Sexo:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.sexo || '-', col1 + 12, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Idade:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.idade || '-', col2 + 14, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Peso:", col3, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.peso ? `${patientData.peso} kg` : '-', col3 + 12, yPosition);
    
    yPosition += 6;
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Tutor(a):", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.responsavel || '-', col1 + 18, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Data:", col3, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.data || '-', col3 + 12, yPosition);
    
    yPosition += 6;
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Solicitante:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.solicitante || '-', col1 + 24, yPosition);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Clínica/Hospital:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.clinica || '-', col2 + 35, yPosition);

    yPosition += 12;

    // Parâmetros Observados
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("PARÂMETROS OBSERVADOS", margin + 2, yPosition);
    yPosition += 8;

    pdf.setTextColor(60, 60, 60);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Ritmo: ${examInfo.ritmo || '-'}`, margin, yPosition);
    pdf.text(`Frequência Cardíaca: ${examInfo.frequenciaCardiaca || '-'} bpm`, col2, yPosition);
    yPosition += 10;

    // Ventrículo Esquerdo
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFont("helvetica", "bold");
    pdf.text("VENTRÍCULO ESQUERDO (MODO M)", margin + 2, yPosition);
    yPosition += 8;

    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    const pesoNum = parseFloat(patientData.peso);
    const dvedNum = parseFloat(measurementsData.dvedDiastole);
    const dvesNum = parseFloat(measurementsData.dvedSistole);
    const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '-';
    const fe = dvedNum && dvesNum ? (((dvedNum - dvesNum) / dvedNum) * 100).toFixed(1) : '-';

    const measurements = [
      [`Septo interventricular em diástole: ${measurementsData.septoIVd || '-'} cm`],
      [`Ventrículo esquerdo em diástole: ${measurementsData.dvedDiastole || '-'} cm`],
      [`Parede livre do VE em diástole: ${measurementsData.paredeLVd || '-'} cm`],
      [`Ventrículo esquerdo em sístole: ${measurementsData.dvedSistole || '-'} cm`],
      [`VE em diástole NORMALIZADO: ${dvedNorm}`],
      [`Fração de Encurtamento: ${fe}%`],
    ];

    measurements.forEach((m) => {
      pdf.text(m[0], margin, yPosition);
      yPosition += 5;
    });

    yPosition += 5;

    // Átrio Esquerdo e Aorta
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("ÁTRIO ESQUERDO E AORTA (MODO B)", margin + 2, yPosition);
    yPosition += 8;

    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta 
      ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2) 
      : '-';

    pdf.text(`Aorta: ${measurementsData.aorta || '-'} cm`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Átrio esquerdo: ${measurementsData.atrioEsquerdo || '-'} cm`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Relação Átrio esquerdo/Aorta: ${aeAo}`, margin, yPosition);
    yPosition += 10;

    // Achados Ecocardiográficos
    if (achados) {
      checkPageBreak(30);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("ACHADOS ECOCARDIOGRÁFICOS", margin + 2, yPosition);
      yPosition += 8;

      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(achados, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    }

    // Conclusões
    if (conclusoes) {
      checkPageBreak(30);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("CONCLUSÕES E COMENTÁRIOS", margin + 2, yPosition);
      yPosition += 8;

      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(conclusoes, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
    }

    // Add selected images on new page
    const selectedImageData = storedImages.filter((_, index) => selectedImages.includes(index));
    if (selectedImageData.length > 0) {
      pdf.addPage();
      yPosition = margin;
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.text("IMAGENS DO ECOCARDIOGRAMA", margin, yPosition);
      yPosition += 15;

      for (let i = 0; i < selectedImageData.length; i++) {
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }

        const img = selectedImageData[i];
        if (img.type.startsWith('image/')) {
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = 60;
          pdf.addImage(img.dataUrl, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        }
      }
    }

    // Footer
    const today = new Date().toLocaleDateString('pt-BR');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Documento gerado em ${today} - VitaeCor Cardiologia Veterinária`, pageWidth / 2, pageHeight - 10, { align: "center" });

    pdf.save(`laudo-${patientData.nome || 'paciente'}-${today.replace(/\//g, '-')}.pdf`);

    toast({
      title: "PDF gerado!",
      description: "O laudo foi exportado em formato PDF.",
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/novo-exame')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dados do Exame</h1>
              <p className="text-muted-foreground">Paciente: {patientData.nome || 'Não informado'}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button className="btn-cta" onClick={handleGeneratePDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Gerar PDF
            </Button>
          </div>
        </div>

        {/* Form Sections */}
        <div ref={reportRef} className="space-y-6">
          {/* Exam Info Card */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">
              <Calendar className="w-5 h-5 text-accent" />
              Informações do Exame
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <Label className="label-vitaecor">Data do Exame</Label>
                <Input
                  className="input-vitaecor"
                  type="text"
                  value={examInfo.data}
                  onChange={(e) => setExamInfo({ ...examInfo, data: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Solicitante</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Dr. Paulo Sousa"
                  value={examInfo.solicitante}
                  onChange={(e) => setExamInfo({ ...examInfo, solicitante: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Clínica/Hospital</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: VitaeCor"
                  value={examInfo.clinica}
                  onChange={(e) => setExamInfo({ ...examInfo, clinica: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Ritmo</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Regular sinusal"
                  value={examInfo.ritmo}
                  onChange={(e) => setExamInfo({ ...examInfo, ritmo: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Frequência Cardíaca (bpm)</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: 120"
                  type="number"
                  value={examInfo.frequenciaCardiaca}
                  onChange={(e) => setExamInfo({ ...examInfo, frequenciaCardiaca: e.target.value })}
                />
              </div>
            </div>
          </div>

          <MeasurementsSection 
            data={measurementsData} 
            peso={patientData.peso}
            onChange={setMeasurementsData} 
          />
          
          <ValvesSection 
            data={valvesData} 
            onChange={setValvesData}
            achados={achados}
            onTextChange={setAchados}
          />

          {/* Conclusões */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">
              <User className="w-5 h-5 text-accent" />
              Conclusões e Comentários
            </h2>
            <textarea
              className="w-full min-h-[120px] p-3 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Digite as conclusões e comentários do laudo..."
              value={conclusoes}
              onChange={(e) => setConclusoes(e.target.value)}
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex justify-end gap-3 pb-8">
          <Button variant="outline" size="lg" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button className="btn-cta" size="lg" onClick={handleGeneratePDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Gerar PDF do Laudo
          </Button>
        </div>
      </div>
    </Layout>
  );
}
