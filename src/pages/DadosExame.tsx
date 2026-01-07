import { useState, useEffect, useRef, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";
import { Layout } from "@/components/Layout";
import { MeasurementsSection } from "@/components/exam/MeasurementsSection";
import { ValvesSection } from "@/components/exam/ValvesSection";
import { Button } from "@/components/ui/button";
import { FileDown, Save, ArrowLeft, Calendar, Eye } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { PatientData } from "@/components/exam/PatientSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { loadExamImages } from "@/lib/imageStorage";
import { useProfile } from "@/hooks/useProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAllExamImages, imageUrlToBase64, StoredImageData } from "@/lib/examImageUpload";

// Função utilitária para formatar números no padrão BR (vírgula como separador decimal)
const formatNumber = (value: string | number): string => {
  if (value === "-" || value === "" || value === null || value === undefined) return "-";
  const str = typeof value === "number" ? value.toString() : value;
  return str.replace(".", ",");
};


// StoredImageData is now imported from examImageUpload

export default function DadosExame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("id"); // If present, we're in edit mode
  const isEditMode = !!examId;
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { clinic, profile } = useProfile();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Track current exam ID to avoid duplicates (INSERT once, then UPDATE)
  const [currentExamId, setCurrentExamId] = useState<string | null>(examId || null);

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
    data: new Date().toISOString().split('T')[0], // formato ISO para type=date
    solicitante: "",
    clinica: "",
    ritmo: "",
    frequenciaCardiaca: "",
    modoMedicao: "M" as "M" | "B", // Modo M ou B para medidas
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
    tempoDesaceleracao: "",
    triv: "",
    padraoDiastolico: "",
  });

  // Função Sistólica - Novos campos
  const [funcaoSistolica, setFuncaoSistolica] = useState({
    simpson: "",
    mapse: "",
    epss: "",
    statusFuncao: "",
    tipoDisfuncao: "",
  });

  // TDI - Dois grupos: Parede Livre e Parede Septal
  const [tdiLivre, setTdiLivre] = useState({
    s: "",
    e: "",
    a: "",
  });
  
  const [tdiSeptal, setTdiSeptal] = useState({
    s: "",
    e: "",
    a: "",
  });

  // Cálculos automáticos
  const calculatedValues = {
    // E/A
    relacaoEA: (() => {
      const e = parseFloat(funcaoDiastolica.ondaE);
      const a = parseFloat(funcaoDiastolica.ondaA);
      return e && a ? (e / a).toFixed(2) : "-";
    })(),
    // E/TRIV
    eTRIV: (() => {
      const e = parseFloat(funcaoDiastolica.ondaE);
      const triv = parseFloat(funcaoDiastolica.triv);
      return e && triv ? (e / triv).toFixed(2) : "-";
    })(),
    // E/e' Parede Livre
    relacaoEePrimeLivre: (() => {
      const e = parseFloat(funcaoDiastolica.ondaE);
      const ePrime = parseFloat(tdiLivre.e);
      return e && ePrime ? (e / ePrime).toFixed(2) : "-";
    })(),
    // E/e' Parede Septal
    relacaoEePrimeSeptal: (() => {
      const e = parseFloat(funcaoDiastolica.ondaE);
      const ePrime = parseFloat(tdiSeptal.e);
      return e && ePrime ? (e / ePrime).toFixed(2) : "-";
    })(),
    // Média E/e'
    mediaEePrime: (() => {
      const e = parseFloat(funcaoDiastolica.ondaE);
      const ePrimeLivre = parseFloat(tdiLivre.e);
      const ePrimeSeptal = parseFloat(tdiSeptal.e);
      if (!e) return "-";
      if (ePrimeLivre && ePrimeSeptal) {
        const mediaEPrime = (ePrimeLivre + ePrimeSeptal) / 2;
        return (e / mediaEPrime).toFixed(2);
      } else if (ePrimeLivre) {
        return (e / ePrimeLivre).toFixed(2);
      } else if (ePrimeSeptal) {
        return (e / ePrimeSeptal).toFixed(2);
      }
      return "-";
    })(),
    // Fração de Encurtamento (FE%)
    fracaoEncurtamento: (() => {
      const dved = parseFloat(measurementsData.dvedDiastole);
      const dves = parseFloat(measurementsData.dvedSistole);
      return dved && dves ? (((dved - dves) / dved) * 100).toFixed(1) : "-";
    })(),
    // Fração de Ejeção (Teicholz): FE = (VDF - VSF) / VDF * 100
    // VDF = 7 * DVED³ / (2.4 + DVED) e VSF = 7 * DVES³ / (2.4 + DVES)
    fracaoEjecaoTeicholz: (() => {
      const dved = parseFloat(measurementsData.dvedDiastole);
      const dves = parseFloat(measurementsData.dvedSistole);
      if (!dved || !dves) return "-";
      const vdf = (7 * Math.pow(dved, 3)) / (2.4 + dved);
      const vsf = (7 * Math.pow(dves, 3)) / (2.4 + dves);
      const fe = ((vdf - vsf) / vdf) * 100;
      return fe.toFixed(1);
    })(),
  };

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
  // Preview state no longer needed - opening in new tab

  // Load existing exam data if in edit mode
  const loadExamData = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({
          title: "Exame não encontrado",
          description: "O exame solicitado não foi encontrado.",
          variant: "destructive",
        });
        navigate("/historico");
        return;
      }

      // Parse content and populate all fields
      const content = data.content as {
        patientData?: PatientData;
        examInfo?: typeof examInfo;
        measurementsData?: typeof measurementsData;
        funcaoDiastolica?: typeof funcaoDiastolica;
        funcaoSistolica?: typeof funcaoSistolica;
        tdiLivre?: typeof tdiLivre;
        tdiSeptal?: typeof tdiSeptal;
        valvasDoppler?: typeof valvasDoppler;
        outros?: typeof outros;
        valvesData?: typeof valvesData;
        achados?: string;
        conclusoes?: string;
        storedImages?: StoredImageData[];
        selectedImages?: number[];
      };

      if (content.patientData) setPatientData(content.patientData);
      if (content.examInfo) setExamInfo(content.examInfo);
      if (content.measurementsData) setMeasurementsData(content.measurementsData);
      if (content.funcaoDiastolica) setFuncaoDiastolica(content.funcaoDiastolica);
      if (content.funcaoSistolica) setFuncaoSistolica(content.funcaoSistolica);
      if (content.tdiLivre) setTdiLivre(content.tdiLivre);
      if (content.tdiSeptal) setTdiSeptal(content.tdiSeptal);
      if (content.valvasDoppler) setValvasDoppler(content.valvasDoppler);
      if (content.outros) setOutros(content.outros);
      if (content.valvesData) setValvesData(content.valvesData);
      if (content.achados) setAchados(content.achados);
      if (content.conclusoes) setConclusoes(content.conclusoes);
      
      // Carregar imagens salvas no Storage
      if (content.storedImages && content.storedImages.length > 0) {
        setStoredImages(content.storedImages);
        setSelectedImages(content.selectedImages || content.storedImages.map((_, i) => i));
      }

    } catch (error) {
      console.error("Erro ao carregar exame:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o exame.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    const loadData = async () => {
      if (isEditMode && examId) {
        // Edit mode: load from database
        await loadExamData(examId);
      } else {
        // New exam mode: load from sessionStorage
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
      }
    };

    loadData();
  }, [navigate, isEditMode, examId, loadExamData]);

  const handleSave = async () => {
    await saveExam();
  };

  const addHeader = async (pdf: jsPDF, pageWidth: number) => {
    const navyBlue = [26, 42, 82];
    
    pdf.setFillColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.rect(0, 0, pageWidth, 25, 'F');

    // Try to add clinic logo if available
    if (clinic?.logo_url) {
      try {
        // Load the logo image
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = clinic.logo_url!;
        });
        
        // Calculate logo dimensions (max height 18mm, maintain aspect ratio)
        const maxHeight = 18;
        const ratio = img.width / img.height;
        const logoHeight = maxHeight;
        const logoWidth = logoHeight * ratio;
        
        pdf.addImage(img, 'PNG', 10, 3, logoWidth, logoHeight);
      } catch (e) {
        // Fallback to text if logo fails to load
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(clinic?.nome_fantasia || "VitaeCor", 15, 12);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text("Cardiologia Veterinária", 15, 18);
      }
    } else {
      // Default VitaeCor text header
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(clinic?.nome_fantasia || "VitaeCor", 15, 12);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Cardiologia Veterinária", 15, 18);
    }
    
    // Informações profissionais à direita (pilha vertical)
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Ecodopplercardiograma", pageWidth - 15, 8, { align: "right" });
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(profile?.nome || "Veterinário Responsável", pageWidth - 15, 13, { align: "right" });
    
    const crmvLine = profile?.crmv ? `CRMV-${profile?.uf_crmv || ""}  ${profile.crmv}` : "";
    if (crmvLine) {
      pdf.text(crmvLine, pageWidth - 15, 17, { align: "right" });
    }
    
    const telefoneLine = profile?.telefone || "";
    if (telefoneLine) {
      pdf.text(telefoneLine, pageWidth - 15, 21, { align: "right" });
    }
  };

  const generatePdfDocument = useCallback(async (): Promise<jsPDF> => {
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const headerHeight = 25; // Height of the header area
    const contentStartY = headerHeight + 10; // Content starts below header with padding
    const SAFE_PAGE_START_Y = 45; // altura reduzida para menos espaço em branco
    let yPosition = margin;

    const navyBlue = [26, 42, 82];
    const bottomSafeArea = 20; // keeps space for footer page numbers

    const checkPageBreak = async (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - bottomSafeArea) {
        pdf.addPage();
        await addHeader(pdf, pageWidth);
        yPosition = contentStartY; // Reset Y to below header
        return true;
      }
      return false;
    };

    const addSectionHeader = async (title: string) => {
      await checkPageBreak(15);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, "F");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(title, margin + 2, yPosition);
      yPosition += 8;
    };

    // Removida função isValueAbnormal - não usamos mais cores de alerta

    // Cor padrão para todos os textos (sem vermelho)
    const normalGray = [60, 60, 60];

    // Formatar TDI com 1 casa decimal
    const formatTdi = (value: string): string => {
      if (!value || value === "-") return "-";
      const num = parseFloat(value);
      return isNaN(num) ? "-" : num.toFixed(1).replace(".", ",");
    };

    // Verifica se um valor está vazio ou é "-"
    const isEmpty = (value: string | undefined): boolean => {
      return !value || value === "-" || value === "--" || value.trim() === "" || value === "- cm" || value === "- cm/s" || value === "- ms" || value === "- mmHg" || value === "- mmHg/s" || value === "- bpm" || value === "-%" || value === "- kg";
    };

    const addTableRow = (label: string, value: string, col2Label?: string, col2Value?: string) => {
      // Não imprime se valor estiver vazio
      if (isEmpty(value) && (!col2Value || isEmpty(col2Value))) return;
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      
      // Primeira coluna (só imprime se não estiver vazia)
      if (!isEmpty(value)) {
        pdf.text(`${label}: ${value}`, margin, yPosition);
      }
      
      // Segunda coluna (se existir e não estiver vazia)
      if (col2Label && col2Value && !isEmpty(col2Value)) {
        pdf.text(`${col2Label}: ${col2Value}`, pageWidth / 2, yPosition);
      }
      yPosition += 5;
    };

    const addSignatureBlock = async () => {
      const name = profile?.nome || "Veterinário Responsável";
      const crmvText = profile?.crmv
        ? `CRMV ${profile?.uf_crmv ? `${profile.uf_crmv} ` : ""}${profile.crmv}`
        : "";
      const specialtyText = profile?.especialidade || "";
      const signatureUrl = profile?.signature_url;

      // Approximate block height: signature image (if any) + text lines
      const hasSignatureImage = !!signatureUrl;
      const signatureImgHeight = hasSignatureImage ? 15 : 0; // ~1.5cm height
      const lineCount = 1 + (crmvText ? 1 : 0) + (specialtyText ? 1 : 0);
      const blockHeight = 10 + signatureImgHeight + lineCount * 4 + 4;
      const footerReserved = 12;

      if (yPosition + blockHeight > pageHeight - footerReserved) {
        pdf.addPage();
        await addHeader(pdf, pageWidth);
        yPosition = 35;
      }

      yPosition += 10;

      // If we have a signature image, add it instead of line
      if (signatureUrl) {
        try {
          const sigImg = new Image();
          sigImg.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            sigImg.onload = () => resolve();
            sigImg.onerror = () => reject();
            sigImg.src = signatureUrl;
          });
          
          // Calculate proportional dimensions (width ~4cm = 40mm)
          const targetWidth = 40;
          const ratio = sigImg.height / sigImg.width;
          const targetHeight = targetWidth * ratio;
          
          const imgX = pageWidth / 2 - targetWidth / 2;
          pdf.addImage(sigImg, 'PNG', imgX, yPosition, targetWidth, Math.min(targetHeight, 15));
          yPosition += Math.min(targetHeight, 15) + 2;
        } catch (e) {
          // Fallback: no image, just skip
          console.error('Error loading signature image:', e);
        }
      }

      // Name - fonte reduzida e linhas mais próximas
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(name, pageWidth / 2, yPosition, { align: "center" });

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      if (crmvText) {
        yPosition += 4;
        pdf.text(crmvText, pageWidth / 2, yPosition, { align: "center" });
      }

      if (specialtyText) {
        yPosition += 4;
        pdf.text(specialtyText, pageWidth / 2, yPosition, { align: "center" });
      }

      yPosition += 4;
    };

    // Page 1 Header
    await addHeader(pdf, pageWidth);
    yPosition = 35;

    // Title
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATÓRIO DE ESTUDO ECOCARDIOGRÁFICO", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 12;

    // Patient Info - More compact layout with reduced label-value spacing
    const col1 = margin;
    const col2 = pageWidth / 2;
    const labelOffset = 2; // Reduced spacing between label and value
    
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    
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

    // Formatar data de ISO para pt-BR para exibição no PDF
    const formatDateForPdf = (dateStr: string) => {
      if (!dateStr) return '-';
      // Se já estiver em formato pt-BR (dd/mm/yyyy), retorna como está
      if (dateStr.includes('/')) return dateStr;
      // Se estiver em formato ISO (yyyy-mm-dd), converte
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };

    addCompactRow("Paciente:", patientData.nome || '-', "Espécie:", patientData.especie || '-');
    addCompactRow("Raça:", patientData.raca || '-', "Sexo:", patientData.sexo || '-');
    addCompactRow("Idade:", patientData.idade || '-', "Peso:", patientData.peso ? `${formatNumber(patientData.peso)} kg` : '-');
    addCompactRow("Tutor(a):", patientData.responsavel || '-', "Data:", formatDateForPdf(examInfo.data));
    addCompactRow("Solicitante:", examInfo.solicitante || '-', "Clínica/Hospital:", examInfo.clinica || '-');
    yPosition += 6;

    // Parâmetros Observados - só imprime se houver dados
    if (examInfo.ritmo || examInfo.frequenciaCardiaca) {
      await addSectionHeader("PARÂMETROS OBSERVADOS");
      addTableRow("Ritmo", examInfo.ritmo, "Frequência Cardíaca", examInfo.frequenciaCardiaca ? `${examInfo.frequenciaCardiaca} bpm` : "");
      yPosition += 5;
    }

    // Ventrículo Esquerdo - título dinâmico baseado no modo
    const modoLabel = examInfo.modoMedicao === "B" ? "MODO B" : "MODO M";
    await addSectionHeader(`VENTRÍCULO ESQUERDO (${modoLabel})`);
    
    const pesoNum = parseFloat(patientData.peso);
    const dvedNum = parseFloat(measurementsData.dvedDiastole);
    const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '';

    if (measurementsData.septoIVd) addTableRow("Septo interventricular em diástole", `${formatNumber(measurementsData.septoIVd)} cm`);
    if (measurementsData.dvedDiastole) addTableRow("Ventrículo esquerdo em diástole", `${formatNumber(measurementsData.dvedDiastole)} cm`);
    if (measurementsData.paredeLVd) addTableRow("Parede livre do VE em diástole", `${formatNumber(measurementsData.paredeLVd)} cm`);
    if (measurementsData.dvedSistole) addTableRow("Ventrículo esquerdo em sístole", `${formatNumber(measurementsData.dvedSistole)} cm`);
    if (dvedNorm && dvedNorm !== '-') addTableRow("VE em diástole NORMALIZADO", formatNumber(dvedNorm));
    if (calculatedValues.fracaoEncurtamento && calculatedValues.fracaoEncurtamento !== '-') addTableRow("Fração de Encurtamento", `${formatNumber(calculatedValues.fracaoEncurtamento)}%`);
    if (calculatedValues.fracaoEjecaoTeicholz && calculatedValues.fracaoEjecaoTeicholz !== '-') addTableRow("Fração de Ejeção (Teicholz)", `${formatNumber(calculatedValues.fracaoEjecaoTeicholz)}%`);
    if (funcaoSistolica.simpson) addTableRow("Fração de Ejeção (Simpson)", `${formatNumber(funcaoSistolica.simpson)}%`);
    yPosition += 3;

    // Átrio Esquerdo e Aorta
    if (measurementsData.aorta || measurementsData.atrioEsquerdo) {
      await addSectionHeader("ÁTRIO ESQUERDO E AORTA (MODO B)");
      const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta 
        ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2) 
        : '';
      if (measurementsData.aorta) addTableRow("Aorta", `${formatNumber(measurementsData.aorta)} cm`);
      if (measurementsData.atrioEsquerdo) addTableRow("Átrio esquerdo", `${formatNumber(measurementsData.atrioEsquerdo)} cm`);
      if (aeAo) addTableRow("Relação Átrio esquerdo/Aorta", formatNumber(aeAo));
      yPosition += 3;
    }

    // Função Diastólica
    const hasDiastolicData = funcaoDiastolica.ondaE || funcaoDiastolica.ondaA || funcaoDiastolica.tempoDesaceleracao || funcaoDiastolica.triv || funcaoDiastolica.padraoDiastolico;
    if (hasDiastolicData) {
      await addSectionHeader("FUNÇÃO DIASTÓLICA DO VENTRÍCULO ESQUERDO");
      if (funcaoDiastolica.ondaE) addTableRow("Velocidade da onda E", `${formatNumber(funcaoDiastolica.ondaE)} cm/s`);
      if (funcaoDiastolica.ondaA) addTableRow("Velocidade da onda A", `${formatNumber(funcaoDiastolica.ondaA)} cm/s`);
      if (calculatedValues.relacaoEA && calculatedValues.relacaoEA !== '-') addTableRow("Relação onda E/A", formatNumber(calculatedValues.relacaoEA));
      if (funcaoDiastolica.tempoDesaceleracao) addTableRow("Tempo de desaceleração da onda E", `${formatNumber(funcaoDiastolica.tempoDesaceleracao)} ms`);
      if (funcaoDiastolica.triv) addTableRow("TRIV", `${formatNumber(funcaoDiastolica.triv)} ms`);
      if (calculatedValues.eTRIV && calculatedValues.eTRIV !== '-') addTableRow("E/TRIV", formatNumber(calculatedValues.eTRIV));
      yPosition += 3;
    }
    
    // TDI - Duas colunas: Parede Livre e Parede Septal
    const hasTdiData = tdiLivre.s || tdiLivre.e || tdiLivre.a || tdiSeptal.s || tdiSeptal.e || tdiSeptal.a;
    if (hasTdiData) {
      await addSectionHeader("DOPPLER TECIDUAL (TDI)");
      
      // TDI Parede Livre
      if (tdiLivre.s || tdiLivre.e || tdiLivre.a) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Parede Livre:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        const livreValues = [];
        if (tdiLivre.s) livreValues.push(`s': ${formatTdi(tdiLivre.s)} cm/s`);
        if (tdiLivre.e) livreValues.push(`e': ${formatTdi(tdiLivre.e)} cm/s`);
        if (tdiLivre.a) livreValues.push(`a': ${formatTdi(tdiLivre.a)} cm/s`);
        pdf.text(livreValues.join(" | "), margin + 25, yPosition);
        yPosition += 5;
        
        if (calculatedValues.relacaoEePrimeLivre && calculatedValues.relacaoEePrimeLivre !== '-') {
          addTableRow("E/e' Parede Livre", formatNumber(calculatedValues.relacaoEePrimeLivre));
        }
      }
      
      // TDI Parede Septal
      if (tdiSeptal.s || tdiSeptal.e || tdiSeptal.a) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Parede Septal:", margin, yPosition);
        pdf.setFont("helvetica", "normal");
        const septalValues = [];
        if (tdiSeptal.s) septalValues.push(`s': ${formatTdi(tdiSeptal.s)} cm/s`);
        if (tdiSeptal.e) septalValues.push(`e': ${formatTdi(tdiSeptal.e)} cm/s`);
        if (tdiSeptal.a) septalValues.push(`a': ${formatTdi(tdiSeptal.a)} cm/s`);
        pdf.text(septalValues.join(" | "), margin + 25, yPosition);
        yPosition += 5;
        
        if (calculatedValues.relacaoEePrimeSeptal && calculatedValues.relacaoEePrimeSeptal !== '-') {
          addTableRow("E/e' Parede Septal", formatNumber(calculatedValues.relacaoEePrimeSeptal));
        }
      }
      
      // Média E/e' (sem destaque)
      if (calculatedValues.mediaEePrime && calculatedValues.mediaEePrime !== '-') {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
        pdf.text(`Média E/e': ${formatNumber(calculatedValues.mediaEePrime)}`, margin, yPosition);
        yPosition += 5;
      }
      
      // Padrão Diastólico (texto longo com quebra de linha)
      if (funcaoDiastolica.padraoDiastolico) {
        yPosition += 2;
        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        const diastolicLines = pdf.splitTextToSize(funcaoDiastolica.padraoDiastolico, pageWidth - 2 * margin);
        for (const line of diastolicLines) {
          await checkPageBreak(5);
          pdf.text(line, margin, yPosition);
          yPosition += 5;
        }
      }
      yPosition += 3;
    }

    // Função Sistólica - MOVIDA PARA DEPOIS DA DIASTÓLICA
    const hasSystolicData = funcaoSistolica.mapse || funcaoSistolica.epss || funcaoSistolica.statusFuncao || funcaoSistolica.tipoDisfuncao;
    if (hasSystolicData) {
      await addSectionHeader("AVALIAÇÃO DA FUNÇÃO SISTÓLICA");
      if (funcaoSistolica.mapse) addTableRow("MAPSE", `${formatNumber(funcaoSistolica.mapse)} cm`);
      if (funcaoSistolica.epss) addTableRow("EPSS", `${formatNumber(funcaoSistolica.epss)} cm`);
      if (funcaoSistolica.statusFuncao) addTableRow("Status da Função", funcaoSistolica.statusFuncao);
      if (funcaoSistolica.tipoDisfuncao) addTableRow("Tipo de Disfunção", funcaoSistolica.tipoDisfuncao);
      yPosition += 3;
    }

    // Avaliação Hemodinâmica - Valvas (apenas se houver dados)
    const hasValveData = valvasDoppler.mitralVelocidade || valvasDoppler.mitralGradiente || valvasDoppler.mitralDpDt ||
      valvasDoppler.tricuspideVelocidade || valvasDoppler.tricuspideGradiente ||
      valvasDoppler.pulmonarVelocidade || valvasDoppler.pulmonarGradiente ||
      valvasDoppler.aorticaVelocidade || valvasDoppler.aorticaGradiente;
    
    if (hasValveData) {
      await addSectionHeader("AVALIAÇÃO HEMODINÂMICA");
      yPosition += 2;

      // Helper to check page break before each valve block
      const addValveBlock = async (title: string, rows: Array<{ label: string; value: string }>) => {
        // Filtrar linhas vazias
        const filledRows = rows.filter(r => r.value && !isEmpty(r.value));
        if (filledRows.length === 0) return;
        
        const blockHeight = 5 + filledRows.length * 5 + 3;
        await checkPageBreak(blockHeight);
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        pdf.text(title, margin, yPosition);
        yPosition += 5;
        
        for (const row of filledRows) {
          addTableRow(row.label, row.value);
        }
        yPosition += 3;
      };

      // Valva Mitral
      if (valvasDoppler.mitralVelocidade || valvasDoppler.mitralGradiente || valvasDoppler.mitralDpDt) {
        await addValveBlock("VALVA MITRAL", [
          { label: "Velocidade máxima do fluxo retrógrado da IM", value: valvasDoppler.mitralVelocidade ? `${formatNumber(valvasDoppler.mitralVelocidade)} cm/s` : "" },
          { label: "Gradiente", value: valvasDoppler.mitralGradiente ? `${formatNumber(valvasDoppler.mitralGradiente)} mmHg` : "" },
          { label: "+dP/dT", value: valvasDoppler.mitralDpDt ? `${formatNumber(valvasDoppler.mitralDpDt)} mmHg/s` : "" },
        ]);
      }

      // Valva Tricúspide
      if (valvasDoppler.tricuspideVelocidade || valvasDoppler.tricuspideGradiente) {
        await addValveBlock("VALVA TRICÚSPIDE", [
          { label: "Velocidade máxima do fluxo retrógrado da IT", value: valvasDoppler.tricuspideVelocidade ? `${formatNumber(valvasDoppler.tricuspideVelocidade)} cm/s` : "" },
          { label: "Gradiente", value: valvasDoppler.tricuspideGradiente ? `${formatNumber(valvasDoppler.tricuspideGradiente)} mmHg` : "" },
        ]);
      }

      // Valva Pulmonar
      if (valvasDoppler.pulmonarVelocidade || valvasDoppler.pulmonarGradiente) {
        if (yPosition > 220) {
          pdf.addPage();
          await addHeader(pdf, pageWidth);
          yPosition = SAFE_PAGE_START_Y;
        }
        if (yPosition < SAFE_PAGE_START_Y) {
          yPosition = SAFE_PAGE_START_Y;
        }
        await addValveBlock("VALVA PULMONAR", [
          { label: "Velocidade máxima do fluxo transvalvar", value: valvasDoppler.pulmonarVelocidade ? `${formatNumber(valvasDoppler.pulmonarVelocidade)} cm/s` : "" },
          { label: "Gradiente", value: valvasDoppler.pulmonarGradiente ? `${formatNumber(valvasDoppler.pulmonarGradiente)} mmHg` : "" },
        ]);
      }

      // Valva Aórtica
      if (valvasDoppler.aorticaVelocidade || valvasDoppler.aorticaGradiente) {
        if (yPosition > 220) {
          pdf.addPage();
          await addHeader(pdf, pageWidth);
          yPosition = SAFE_PAGE_START_Y;
        }
        if (yPosition < SAFE_PAGE_START_Y) {
          yPosition = SAFE_PAGE_START_Y;
        }
        await addValveBlock("VALVA AÓRTICA", [
          { label: "Velocidade máxima do fluxo transvalvar", value: valvasDoppler.aorticaVelocidade ? `${formatNumber(valvasDoppler.aorticaVelocidade)} cm/s` : "" },
          { label: "Gradiente", value: valvasDoppler.aorticaGradiente ? `${formatNumber(valvasDoppler.aorticaGradiente)} mmHg` : "" },
        ]);
      }
    }

    // Outros
    await addSectionHeader("OUTROS");
    addTableRow("Câmaras Direitas", outros.camarasDireitas);
    addTableRow("Septos", outros.septos);
    addTableRow("Pericárdio", outros.pericardio);
    yPosition += 5;

    // Achados
    if (achados) {
      await addSectionHeader("ACHADOS ECOCARDIOGRÁFICOS");
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(achados, pageWidth - 2 * margin);
      for (const line of lines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
      yPosition += 3;
    }

    // Conclusões
    if (conclusoes) {
      await addSectionHeader("CONCLUSÕES E COMENTÁRIOS");
      pdf.setTextColor(60, 60, 60);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(conclusoes, pageWidth - 2 * margin);
      for (const line of lines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
    }

    // Assinatura (uma única vez, ao final da parte descritiva)
    await addSignatureBlock();

    // Images - 8 per page (2 columns x 4 rows for better visibility)
    const selectedImageData = storedImages.filter((_, index) => selectedImages.includes(index));
    if (selectedImageData.length > 0) {
      pdf.addPage();
      await addHeader(pdf, pageWidth);
      
      // Add section title
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("ANEXOS / IMAGENS DO EXAME", pageWidth / 2, 35, { align: "center" });

      const imagesPerPage = 8;
      const cols = 2; // 2 columns
      const rows = 4; // 4 rows
      const imgMargin = 6;
      const startY = 42; // Start below title
      const availableWidth = pageWidth - 2 * margin;
      const availableHeight = pageHeight - startY - 15; // Leave space for footer
      const imgWidth = (availableWidth - (cols - 1) * imgMargin) / cols;
      const imgHeight = (availableHeight - (rows - 1) * imgMargin) / rows;

      let imageIndex = 0;
      
      while (imageIndex < selectedImageData.length) {
        if (imageIndex > 0 && imageIndex % imagesPerPage === 0) {
          pdf.addPage();
          await addHeader(pdf, pageWidth);
          pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.text("ANEXOS / IMAGENS DO EXAME (continuação)", pageWidth / 2, 35, { align: "center" });
        }

        const pageImageIndex = imageIndex % imagesPerPage;
        const row = Math.floor(pageImageIndex / cols);
        const col = pageImageIndex % cols;

        const x = margin + col * (imgWidth + imgMargin);
        const y = startY + row * (imgHeight + imgMargin);

        const img = selectedImageData[imageIndex];
        if (img.type.startsWith('image/') || img.dataUrl.startsWith('data:image') || img.dataUrl.startsWith('http')) {
          try {
            // Converter URL remota para base64 se necessário
            let imageData = img.dataUrl;
            if (img.dataUrl.startsWith('http')) {
              imageData = await imageUrlToBase64(img.dataUrl);
            }
            const format = imageData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            pdf.addImage(imageData, format as any, x, y, imgWidth, imgHeight);
          } catch (e) {
            console.error('Error adding image to PDF:', e);
          }
        }
        imageIndex++;
      }
    }

    // Footer: only page numbers (no repeated signature)
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    return pdf;
  }, [patientData, examInfo, measurementsData, funcaoDiastolica, funcaoSistolica, tdiLivre, tdiSeptal, valvasDoppler, outros, achados, conclusoes, storedImages, selectedImages, clinic, profile, addHeader, calculatedValues]);

  const handlePreviewPDF = async () => {
    try {
      const pdf = await generatePdfDocument();
      const pdfBlob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      const newWindow = window.open(blobUrl, "_blank");
      
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        URL.revokeObjectURL(blobUrl);
        toast({
          title: "Aba bloqueada",
          description: "Se a aba não abrir, por favor use o botão 'Baixar PDF'.",
          variant: "destructive",
        });
        // Fallback: tentar abrir via link clicável
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o preview.",
        variant: "destructive",
      });
    }
  };

  // Função para salvar o exame no banco de dados
  const saveExam = async (): Promise<boolean> => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para salvar o exame.",
        variant: "destructive",
      });
      return false;
    }

    try {
      setIsSaving(true);
      
      // Converter a data do formato PT-BR para ISO
      const dateParts = examInfo.data.split('/');
      const examDate = dateParts.length === 3 
        ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` 
        : new Date().toISOString().split('T')[0];

      // Use currentExamId if we already saved once, otherwise generate new
      const targetExamId = currentExamId || crypto.randomUUID();

      // Upload das imagens selecionadas para o Storage
      let uploadedImages: StoredImageData[] = [];
      const selectedImageData = storedImages.filter((_, index) => selectedImages.includes(index));
      
      if (selectedImageData.length > 0) {
        toast({
          title: "Fazendo upload das imagens...",
          description: `Enviando ${selectedImageData.length} imagem(ns)...`,
        });
        
        uploadedImages = await uploadAllExamImages(selectedImageData, targetExamId);
        
        // Atualizar storedImages com URLs permanentes
        setStoredImages(uploadedImages);
        setSelectedImages(uploadedImages.map((_, i) => i));
      }

      const examContent = {
        patientData,
        examInfo,
        measurementsData,
        funcaoDiastolica,
        funcaoSistolica,
        tdiLivre,
        tdiSeptal,
        valvasDoppler,
        outros,
        valvesData,
        achados,
        conclusoes,
        calculatedValues,
        storedImages: uploadedImages,
        selectedImages: uploadedImages.map((_, i) => i),
      };

      const examData = {
        patient_name: patientData.nome || "Paciente sem nome",
        owner_name: patientData.responsavel || null,
        species: patientData.especie || null,
        breed: patientData.raca || null,
        exam_date: examDate,
        content: JSON.parse(JSON.stringify(examContent)),
      };

      let error;
      const isUpdate = !!currentExamId;

      if (isUpdate) {
        // UPDATE existing exam (either edit mode or already saved in this session)
        const result = await supabase
          .from("exams")
          .update(examData)
          .eq("id", currentExamId);
        error = result.error;
      } else {
        // INSERT new exam with the generated ID
        const result = await supabase.from("exams").insert([{
          id: targetExamId,
          ...examData,
          user_id: user.id,
          clinic_id: profile?.clinic_id || null,
        }]);
        error = result.error;
        
        // Save the ID for future updates
        if (!error) {
          setCurrentExamId(targetExamId);
        }
      }

      if (error) throw error;

      toast({
        title: isUpdate ? "Exame atualizado!" : "Exame salvo!",
        description: isUpdate 
          ? "O exame foi atualizado com sucesso."
          : "O exame foi salvo no histórico com sucesso.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao salvar exame:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o exame no histórico.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Salvar exame antes de gerar o PDF
      await saveExam();
      
      const pdf = await generatePdfDocument();
      const today = new Date().toLocaleDateString('pt-BR');
      pdf.save(`laudo-${patientData.nome || 'paciente'}-${today.replace(/\//g, '-')}.pdf`);

      toast({
        title: "PDF gerado!",
        description: "O laudo foi exportado em formato PDF.",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(isEditMode ? '/historico' : '/novo-exame')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isEditMode ? "Editar Exame" : "Dados do Exame"}
              </h1>
              <p className="text-muted-foreground">Paciente: {patientData.nome || 'Não informado'}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handlePreviewPDF}>
              <Eye className="w-4 h-4 mr-2" />
              Pré-visualizar
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Baixar PDF
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
                  type="date"
                  value={examInfo.data}
                  onChange={(e) => setExamInfo({ ...examInfo, data: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Solicitante</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Dr. [Nome do Veterinário]"
                  value={examInfo.solicitante}
                  onChange={(e) => setExamInfo({ ...examInfo, solicitante: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Clínica/Hospital</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Nome da Clínica"
                  value={examInfo.clinica}
                  onChange={(e) => setExamInfo({ ...examInfo, clinica: e.target.value })}
                />
              </div>
              <div>
                <Label className="label-vitaecor">Ritmo</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Sinusal"
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
            modoMedicao={examInfo.modoMedicao}
            onModoChange={(modo) => setExamInfo({ ...examInfo, modoMedicao: modo })}
            onChange={setMeasurementsData} 
          />

          {/* Função Sistólica */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Avaliação da Função Sistólica</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="label-vitaecor">FE Teicholz (%)</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.fracaoEjecaoTeicholz} />
              </div>
              <div>
                <Label className="label-vitaecor">FE Simpson (%)</Label>
                <Input className="input-vitaecor" type="number" step="0.1" value={funcaoSistolica.simpson} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, simpson: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">MAPSE (cm)</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoSistolica.mapse} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, mapse: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">EPSS (cm)</Label>
                <Input className="input-vitaecor" type="number" step="0.01" value={funcaoSistolica.epss} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, epss: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Fração Encurt. (%)</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.fracaoEncurtamento} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label className="label-vitaecor">Status da Função</Label>
                <Select 
                  value={funcaoSistolica.statusFuncao} 
                  onValueChange={(value) => setFuncaoSistolica({...funcaoSistolica, statusFuncao: value})}
                >
                  <SelectTrigger className="input-vitaecor">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preservada">Preservada</SelectItem>
                    <SelectItem value="Reduzida">Reduzida</SelectItem>
                    <SelectItem value="Moderadamente reduzida">Moderadamente reduzida</SelectItem>
                    <SelectItem value="Gravemente reduzida">Gravemente reduzida</SelectItem>
                    <SelectItem value="Hiperdinâmica">Hiperdinâmica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-vitaecor">Tipo de Disfunção</Label>
                <Input className="input-vitaecor" placeholder="Ex: Global, Segmentar..." value={funcaoSistolica.tipoDisfuncao} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, tipoDisfuncao: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Função Diastólica */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Função Diastólica do Ventrículo Esquerdo</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.relacaoEA} />
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
                <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.eTRIV} />
              </div>
            </div>
            
            {/* Padrão Diastólico */}
            <div className="mt-4">
              <Label className="label-vitaecor">Padrão Diastólico</Label>
              <Select 
                value={funcaoDiastolica.padraoDiastolico} 
                onValueChange={(value) => setFuncaoDiastolica({...funcaoDiastolica, padraoDiastolico: value})}
              >
                <SelectTrigger className="input-vitaecor">
                  <SelectValue placeholder="Selecione o padrão diastólico..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="O estudo Doppler mostrou padrão diastólico de enchimento ventricular normal.">
                    Padrão normal
                  </SelectItem>
                  <SelectItem value="O estudo Doppler mostrou padrão diastólico de enchimento ventricular tipo E < A, compatível com distúrbio no relaxamento ventricular. Padrão diastólico tipo I. Esse achado pode ser considerado normal em cães com idade superior a 10 anos.">
                    Tipo I (E &lt; A) - Distúrbio relaxamento
                  </SelectItem>
                  <SelectItem value="O estudo Doppler mostrou padrão diastólico de enchimento ventricular pseudonormalizado ou tipo II.">
                    Tipo II - Pseudonormalizado
                  </SelectItem>
                  <SelectItem value="O estudo Doppler mostrou padrão diastólico de enchimento ventricular restritivo ou tipo III.">
                    Tipo III - Restritivo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* TDI - Doppler Tecidual */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Doppler Tecidual (TDI)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TDI Parede Livre */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Parede Livre</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="label-vitaecor">s' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiLivre.s} onChange={(e) => setTdiLivre({...tdiLivre, s: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">e' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiLivre.e} onChange={(e) => setTdiLivre({...tdiLivre, e: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">a' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiLivre.a} onChange={(e) => setTdiLivre({...tdiLivre, a: e.target.value})} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="label-vitaecor">E/e' Parede Livre</Label>
                  <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.relacaoEePrimeLivre} />
                </div>
              </div>

              {/* TDI Parede Septal */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Parede Septal</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="label-vitaecor">s' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiSeptal.s} onChange={(e) => setTdiSeptal({...tdiSeptal, s: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">e' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiSeptal.e} onChange={(e) => setTdiSeptal({...tdiSeptal, e: e.target.value})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">a' (cm/s)</Label>
                    <Input className="input-vitaecor" type="number" step="0.01" value={tdiSeptal.a} onChange={(e) => setTdiSeptal({...tdiSeptal, a: e.target.value})} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="label-vitaecor">E/e' Parede Septal</Label>
                  <Input className="input-vitaecor bg-muted" readOnly value={calculatedValues.relacaoEePrimeSeptal} />
                </div>
              </div>
            </div>
            
            {/* Média E/e' em destaque */}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Média E/e':</span>
                <span className="text-xl font-bold text-primary">{calculatedValues.mediaEePrime}</span>
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
          <Button variant="outline" size="lg" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" size="lg" onClick={handlePreviewPDF}>
            <Eye className="w-4 h-4 mr-2" />
            Pré-visualizar
          </Button>
          <Button variant="outline" size="lg" onClick={handleDownloadPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </div>

      </div>
    </Layout>
  );
}
