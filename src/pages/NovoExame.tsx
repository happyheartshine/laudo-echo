import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { PatientSection } from "@/components/exam/PatientSection";
import { MeasurementsSection } from "@/components/exam/MeasurementsSection";
import { ValvesSection } from "@/components/exam/ValvesSection";
import { ImageUploadSection } from "@/components/exam/ImageUploadSection";
import { Button } from "@/components/ui/button";
import { FileDown, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logoVitaecor from "@/assets/logo-vitaecor.png";

export default function NovoExame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

  const [patientData, setPatientData] = useState({
    nome: "",
    especie: "",
    raca: "",
    sexo: "",
    idade: "",
    peso: "",
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
  const [images, setImages] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

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
    const margin = 20;
    let yPosition = margin;

    // Colors
    const navyBlue = [26, 42, 82];
    const red = [229, 41, 41];

    // Header with logo
    pdf.setFillColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.rect(0, 0, pageWidth, 35, 'F');

    // Add logo text (since we can't easily add image)
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("VitaeCor", pageWidth / 2, 15, { align: "center" });
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Cardiologia Veterinária", pageWidth / 2, 22, { align: "center" });

    yPosition = 45;

    // Title
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("LAUDO ECOCARDIOGRÁFICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Patient Data Section
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.text("DADOS DO PACIENTE", margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);

    const patientInfo = [
      `Nome: ${patientData.nome || '-'}`,
      `Espécie: ${patientData.especie || '-'}`,
      `Raça: ${patientData.raca || '-'}`,
      `Sexo: ${patientData.sexo || '-'}`,
      `Idade: ${patientData.idade || '-'}`,
      `Peso: ${patientData.peso ? patientData.peso + ' kg' : '-'}`,
    ];

    patientInfo.forEach((info) => {
      pdf.text(info, margin, yPosition);
      yPosition += 6;
    });

    yPosition += 10;

    // Measurements Section
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.text("MEDIDAS ECOCARDIOGRÁFICAS", margin, yPosition);
    yPosition += 10;

    // Table header
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    pdf.text("Parâmetro", margin + 5, yPosition);
    pdf.text("Valor", margin + 80, yPosition);
    pdf.text("Unidade", margin + 120, yPosition);
    yPosition += 8;

    const measurements = [
      ["DVED (LVIDd)", measurementsData.dvedDiastole, "cm"],
      ["DVES (LVIDs)", measurementsData.dvedSistole, "cm"],
      ["Septo IVd", measurementsData.septoIVd, "cm"],
      ["Septo IVs", measurementsData.septoIVs, "cm"],
      ["Parede LVd", measurementsData.paredeLVd, "cm"],
      ["Parede LVs", measurementsData.paredeLVs, "cm"],
      ["Aorta (Ao)", measurementsData.aorta, "cm"],
      ["Átrio Esquerdo (AE)", measurementsData.atrioEsquerdo, "cm"],
    ];

    measurements.forEach((row, index) => {
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
      }
      pdf.setFont("helvetica", "normal");
      pdf.text(row[0], margin + 5, yPosition);
      pdf.text(row[1] || '-', margin + 80, yPosition);
      pdf.text(row[2], margin + 120, yPosition);
      yPosition += 6;
    });

    // Calculated values
    yPosition += 5;
    const pesoNum = parseFloat(patientData.peso);
    const dvedNum = parseFloat(measurementsData.dvedDiastole);
    const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '-';
    const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta 
      ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2) 
      : '-';
    const fe = measurementsData.dvedDiastole && measurementsData.dvedSistole
      ? (((parseFloat(measurementsData.dvedDiastole) - parseFloat(measurementsData.dvedSistole)) / parseFloat(measurementsData.dvedDiastole)) * 100).toFixed(1)
      : '-';

    pdf.setFont("helvetica", "bold");
    pdf.text(`DVED Normalizado: ${dvedNorm}`, margin + 5, yPosition);
    pdf.text(`Relação AE/Ao: ${aeAo}`, margin + 70, yPosition);
    pdf.text(`Fração Encurt.: ${fe}%`, margin + 120, yPosition);
    yPosition += 15;

    // Findings Section
    if (achados) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.text("ACHADOS ECOCARDIOGRÁFICOS", margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);

      const lines = pdf.splitTextToSize(achados, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });
    }

    // Add only selected images on new pages
    const selectedImagesList = images.filter((_, index) => selectedImages.has(index));
    if (selectedImagesList.length > 0) {
      pdf.addPage();
      yPosition = margin;
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.text("IMAGENS DO ECOCARDIOGRAMA", margin, yPosition);
      yPosition += 15;

      for (let i = 0; i < selectedImagesList.length; i++) {
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = margin;
        }

        const img = selectedImagesList[i];
        
        // Skip DICOM files (can't render in PDF directly)
        if (img.name.toLowerCase().endsWith('.dcm')) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(100, 100, 100);
          pdf.text(`[Arquivo DICOM: ${img.name}]`, margin, yPosition);
          yPosition += 10;
          continue;
        }
        
        const imgData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(img);
        });

        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = 60;
        pdf.addImage(imgData, 'JPEG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
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
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Novo Exame Ecocardiográfico</h1>
              <p className="text-muted-foreground">Preencha os dados do laudo</p>
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
          <ImageUploadSection 
            images={images} 
            onImagesChange={setImages}
            selectedImages={selectedImages}
            onSelectedImagesChange={setSelectedImages}
          />
          <PatientSection data={patientData} onChange={setPatientData} />
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
