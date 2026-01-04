import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { MeasurementsSection } from "@/components/exam/MeasurementsSection";
import { ValvesSection } from "@/components/exam/ValvesSection";
import { Button } from "@/components/ui/button";
import { FileDown, Save, ArrowLeft, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { PatientData } from "@/components/exam/PatientSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { loadExamImages } from "@/lib/imageStorage";

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

  // Novos campos de função diastólica
  const [funcaoDiastolica, setFuncaoDiastolica] = useState({
    ondaE: "",
    ondaA: "",
    relacaoEA: "",
    tempoDesaceleracao: "",
    triv: "",
    eTRIV: "",
    tdiParedeLateral: "",
    ePrime: "",
    aPrime: "",
    relacaoEePrime: "",
  });

  // Campos das valvas com velocidades e gradientes
  const [valvasDoppler, setValvasDoppler] = useState({
    mitralVelocidade: "",
    mitralGradiente: "",
    mitralDpDt: "",
    tricuspideVelocidade: "",
    tricuspideGradiente: "",
    pulmonarVelocidade: "",
    pulmonarGradiente: "",
    aorticaVelocidade: "",
    aorticaGradiente: "",
  });

  const [outros, setOutros] = useState({
    camarasDireitas: "normais",
    septos: "interventricular e interatrial íntegros",
    pericardio: "normal, sem derrame",
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
    const loadData = async () => {
      const storedPatient = sessionStorage.getItem("examPatientData");
      if (storedPatient) {
        setPatientData(JSON.parse(storedPatient));
      } else {
        navigate("/novo-exame");
        return;
      }

      // Load images from IndexedDB
      try {
        const images = await loadExamImages();
        setStoredImages(images);
        setSelectedImages(images.map((_, i) => i));
      } catch (error) {
        console.error("Error loading images:", error);
      }
    };

    loadData();
  }, [navigate]);

  const handleSave = () => {
    toast({
      title: "Laudo salvo!",
      description: "O laudo foi salvo com sucesso no sistema.",
    });
  };

  const addHeader = (pdf: jsPDF, pageWidth: number) => {
    const navyBlue = [26, 42, 82];
    
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
  };

  const handleGeneratePDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    const navyBlue = [26, 42, 82];

    const checkPageBreak = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - 20) {
        pdf.addPage();
        addHeader(pdf, pageWidth);
        yPosition = 35;
        return true;
      }
      return false;
    };

    const addSectionHeader = (title: string) => {
      checkPageBreak(15);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, margin + 2, yPosition);
      yPosition += 8;
    };

    const addTableRow = (label: string, value: string, col2Label?: string, col2Value?: string) => {
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${label}: ${value}`, margin, yPosition);
      if (col2Label && col2Value) {
        pdf.text(`${col2Label}: ${col2Value}`, pageWidth / 2, yPosition);
      }
      yPosition += 5;
    };

    // Page 1 Header
    addHeader(pdf, pageWidth);
    yPosition = 35;

    // Title
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATÓRIO DE ESTUDO ECOCARDIOGRÁFICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Patient Info
    const col1 = margin;
    const col2 = pageWidth / 2;
    
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("Paciente:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.nome || '-', col1 + 22, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.text("Espécie:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.especie || '-', col2 + 18, yPosition);
    yPosition += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Raça:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.raca || '-', col1 + 12, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.text("Sexo:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.sexo || '-', col2 + 12, yPosition);
    yPosition += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Idade:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.idade || '-', col1 + 14, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.text("Peso:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.peso ? `${patientData.peso} kg` : '-', col2 + 12, yPosition);
    yPosition += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Tutor(a):", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(patientData.responsavel || '-', col1 + 18, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.text("Data:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.data || '-', col2 + 12, yPosition);
    yPosition += 5;

    pdf.setFont("helvetica", "bold");
    pdf.text("Solicitante:", col1, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.solicitante || '-', col1 + 24, yPosition);
    pdf.setFont("helvetica", "bold");
    pdf.text("Clínica/Hospital:", col2, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(examInfo.clinica || '-', col2 + 35, yPosition);
    yPosition += 10;

    // Parâmetros Observados
    addSectionHeader("PARÂMETROS OBSERVADOS");
    addTableRow("Ritmo", examInfo.ritmo || '-', "Frequência Cardíaca", `${examInfo.frequenciaCardiaca || '-'} bpm`);
    yPosition += 5;

    // Ventrículo Esquerdo
    addSectionHeader("VENTRÍCULO ESQUERDO (MODO M)");
    
    const pesoNum = parseFloat(patientData.peso);
    const dvedNum = parseFloat(measurementsData.dvedDiastole);
    const dvesNum = parseFloat(measurementsData.dvedSistole);
    const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '-';
    const feEnc = dvedNum && dvesNum ? (((dvedNum - dvesNum) / dvedNum) * 100).toFixed(1) : '-';
    const feEj = dvedNum && dvesNum ? (66.2).toFixed(1) : '-'; // Placeholder Teicholz

    addTableRow("Septo interventricular em diástole", `${measurementsData.septoIVd || '-'} cm`);
    addTableRow("Ventrículo esquerdo em diástole", `${measurementsData.dvedDiastole || '-'} cm`);
    addTableRow("Parede livre do VE em diástole", `${measurementsData.paredeLVd || '-'} cm`);
    addTableRow("Ventrículo esquerdo em sístole", `${measurementsData.dvedSistole || '-'} cm`);
    addTableRow("VE em diástole NORMALIZADO", dvedNorm);
    addTableRow("Fração de Encurtamento", `${feEnc}%`);
    addTableRow("Fração de Ejeção (Teicholz)", `${feEj}%`);
    yPosition += 3;

    // Átrio Esquerdo e Aorta
    addSectionHeader("ÁTRIO ESQUERDO E AORTA (MODO B)");
    const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta 
      ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2) 
      : '-';
    addTableRow("Aorta", `${measurementsData.aorta || '-'} cm`);
    addTableRow("Átrio esquerdo", `${measurementsData.atrioEsquerdo || '-'} cm`);
    addTableRow("Relação Átrio esquerdo/Aorta", aeAo);
    yPosition += 3;

    // Função Diastólica
    addSectionHeader("FUNÇÃO DIASTÓLICA DO VENTRÍCULO ESQUERDO");
    addTableRow("Velocidade da onda E", `${funcaoDiastolica.ondaE || '-'} cm/s`);
    addTableRow("Velocidade da onda A", `${funcaoDiastolica.ondaA || '-'} cm/s`);
    addTableRow("Relação onda E/A", funcaoDiastolica.relacaoEA || '-');
    addTableRow("Tempo de desaceleração da onda E", `${funcaoDiastolica.tempoDesaceleracao || '-'} ms`);
    addTableRow("TRIV", `${funcaoDiastolica.triv || '-'} ms`);
    addTableRow("E/TRIV", funcaoDiastolica.eTRIV || '-');
    addTableRow("TDI Parede lateral s'", `${funcaoDiastolica.tdiParedeLateral || '-'} cm/s`);
    addTableRow("e'", `${funcaoDiastolica.ePrime || '-'} cm/s`);
    addTableRow("a'", `${funcaoDiastolica.aPrime || '-'} cm/s`);
    addTableRow("Relação E/e'", funcaoDiastolica.relacaoEePrime || '-');
    yPosition += 3;

    // Avaliação Hemodinâmica - Valvas
    addSectionHeader("AVALIAÇÃO HEMODINÂMICA");
    yPosition += 2;

    // Valva Mitral
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("VALVA MITRAL", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo retrógrado da IM", `${valvasDoppler.mitralVelocidade || '-'} cm/s`);
    addTableRow("Gradiente", `${valvasDoppler.mitralGradiente || '-'} mmHg`);
    addTableRow("+dP/dT", `${valvasDoppler.mitralDpDt || '-'} mmHg/s`);
    yPosition += 3;

    // Valva Tricúspide
    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA TRICÚSPIDE", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo retrógrado da IT", `${valvasDoppler.tricuspideVelocidade || '-'} cm/s`);
    addTableRow("Gradiente", `${valvasDoppler.tricuspideGradiente || '-'} mmHg`);
    yPosition += 3;

    // Valva Pulmonar
    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA PULMONAR", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo transvalvar", `${valvasDoppler.pulmonarVelocidade || '-'} cm/s`);
    addTableRow("Gradiente", `${valvasDoppler.pulmonarGradiente || '-'} mmHg`);
    yPosition += 3;

    // Valva Aórtica
    pdf.setFont("helvetica", "bold");
    pdf.text("VALVA AÓRTICA", margin, yPosition);
    yPosition += 5;
    addTableRow("Velocidade máxima do fluxo transvalvar", `${valvasDoppler.aorticaVelocidade || '-'} cm/s`);
    addTableRow("Gradiente", `${valvasDoppler.aorticaGradiente || '-'} mmHg`);
    yPosition += 3;

    // Outros
    addSectionHeader("OUTROS");
    addTableRow("Câmaras Direitas", outros.camarasDireitas);
    addTableRow("Septos", outros.septos);
    addTableRow("Pericárdio", outros.pericardio);
    yPosition += 5;

    // Achados
    if (achados) {
      addSectionHeader("ACHADOS ECOCARDIOGRÁFICOS");
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(achados, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    }

    // Conclusões
    if (conclusoes) {
      addSectionHeader("CONCLUSÕES E COMENTÁRIOS");
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

    // Images - 8 per page (4x2 grid)
    const selectedImageData = storedImages.filter((_, index) => selectedImages.includes(index));
    if (selectedImageData.length > 0) {
      pdf.addPage();
      addHeader(pdf, pageWidth);
      yPosition = 35;

      const imagesPerPage = 8;
      const cols = 4;
      const rows = 2;
      const imgMargin = 5;
      const availableWidth = pageWidth - 2 * margin;
      const availableHeight = pageHeight - 50 - margin;
      const imgWidth = (availableWidth - (cols - 1) * imgMargin) / cols;
      const imgHeight = (availableHeight - (rows - 1) * imgMargin) / rows;

      let imageIndex = 0;
      
      while (imageIndex < selectedImageData.length) {
        if (imageIndex > 0 && imageIndex % imagesPerPage === 0) {
          pdf.addPage();
          addHeader(pdf, pageWidth);
          yPosition = 35;
        }

        const pageImageIndex = imageIndex % imagesPerPage;
        const row = Math.floor(pageImageIndex / cols);
        const col = pageImageIndex % cols;

        const x = margin + col * (imgWidth + imgMargin);
        const y = 35 + row * (imgHeight + imgMargin);

        const img = selectedImageData[imageIndex];
        if (img.type.startsWith('image/') || img.dataUrl.startsWith('data:image')) {
          try {
            pdf.addImage(img.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);
          } catch (e) {
            console.error('Error adding image to PDF:', e);
          }
        }
        imageIndex++;
      }
    }

    // Footer on last page
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    const today = new Date().toLocaleDateString('pt-BR');
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

          {/* Função Diastólica */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Função Diastólica do Ventrículo Esquerdo</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="label-vitaecor">Onda E (cm/s)</Label>
                <Input className="input-vitaecor" type="number" step="0.1" value={funcaoDiastolica.ondaE} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, ondaE: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Onda A (cm/s)</Label>
                <Input className="input-vitaecor" type="number" step="0.1" value={funcaoDiastolica.ondaA} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, ondaA: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Relação E/A</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoDiastolica.relacaoEA} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, relacaoEA: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Tempo Desac. E (ms)</Label>
                <Input className="input-vitaecor" type="number" value={funcaoDiastolica.tempoDesaceleracao} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, tempoDesaceleracao: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">TRIV (ms)</Label>
                <Input className="input-vitaecor" type="number" value={funcaoDiastolica.triv} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, triv: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">E/TRIV</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoDiastolica.eTRIV} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, eTRIV: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">TDI s' (cm/s)</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoDiastolica.tdiParedeLateral} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, tdiParedeLateral: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">e' (cm/s)</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoDiastolica.ePrime} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, ePrime: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">a' (cm/s)</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoDiastolica.aPrime} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, aPrime: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">E/e'</Label>
                <Input className="input-vitaecor" type="number" step="0.1" value={funcaoDiastolica.relacaoEePrime} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, relacaoEePrime: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Avaliação Hemodinâmica - Doppler das Valvas */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Avaliação Hemodinâmica (Doppler)</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Valva Mitral */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Mitral</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Retrógrado IM (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.1" value={valvasDoppler.mitralVelocidade} onChange={(e) => setValvasDoppler({...valvasDoppler, mitralVelocidade: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={valvasDoppler.mitralGradiente} onChange={(e) => setValvasDoppler({...valvasDoppler, mitralGradiente: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">+dP/dT (mmHg/s)</Label>
                    <Input className="input-vitaecor" type="number" value={valvasDoppler.mitralDpDt} onChange={(e) => setValvasDoppler({...valvasDoppler, mitralDpDt: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Tricúspide */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Tricúspide</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Retrógrado IT (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.1" value={valvasDoppler.tricuspideVelocidade} onChange={(e) => setValvasDoppler({...valvasDoppler, tricuspideVelocidade: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={valvasDoppler.tricuspideGradiente} onChange={(e) => setValvasDoppler({...valvasDoppler, tricuspideGradiente: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Pulmonar */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Pulmonar</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Transvalvar (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.1" value={valvasDoppler.pulmonarVelocidade} onChange={(e) => setValvasDoppler({...valvasDoppler, pulmonarVelocidade: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={valvasDoppler.pulmonarGradiente} onChange={(e) => setValvasDoppler({...valvasDoppler, pulmonarGradiente: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Aórtica */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Aórtica</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Transvalvar (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.1" value={valvasDoppler.aorticaVelocidade} onChange={(e) => setValvasDoppler({...valvasDoppler, aorticaVelocidade: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={valvasDoppler.aorticaGradiente} onChange={(e) => setValvasDoppler({...valvasDoppler, aorticaGradiente: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Outros */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Outros Achados</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="label-vitaecor">Câmaras Direitas</Label>
                <Input className="input-vitaecor" value={outros.camarasDireitas} onChange={(e) => setOutros({...outros, camarasDireitas: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Septos</Label>
                <Input className="input-vitaecor" value={outros.septos} onChange={(e) => setOutros({...outros, septos: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Pericárdio</Label>
                <Input className="input-vitaecor" value={outros.pericardio} onChange={(e) => setOutros({...outros, pericardio: e.target.value})} />
              </div>
            </div>
          </div>
          
          <ValvesSection 
            data={valvesData} 
            onChange={setValvesData}
            achados={achados}
            onTextChange={setAchados}
          />

          {/* Conclusões */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Conclusões e Comentários</h2>
            <Textarea
              className="input-vitaecor min-h-[120px]"
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
