import jsPDF from "jspdf";
import { imageUrlToBase64, StoredImageData } from "@/lib/examImageUpload";
import { PatientData } from "@/components/exam/PatientSection";
import { ClassificationsData, ReferencesData } from "@/components/exam/MeasurementsSection";
import { RightVentricleData } from "@/components/exam/RightVentricleSection";

// Função utilitária para formatar números no padrão BR (vírgula como separador decimal)
const formatNumber = (value: string | number): string => {
  if (value === "-" || value === "" || value === null || value === undefined) return "-";
  const str = typeof value === "number" ? value.toString() : value;
  return str.replace(".", ",");
};

export interface ProfileData {
  nome?: string;
  crmv?: string;
  uf_crmv?: string;
  telefone?: string;
  especialidade?: string;
  sexo?: string;
  signature_url?: string;
}

export interface ClinicData {
  nome_fantasia?: string;
  logo_url?: string;
}

export interface ExamInfo {
  data?: string;
  solicitante?: string;
  clinica?: string;
  ritmo?: string;
  frequenciaCardiaca?: string;
  modoMedicao?: "M" | "B";
}

export interface MeasurementsData {
  dvedDiastole?: string;
  dvedSistole?: string;
  septoIVd?: string;
  septoIVs?: string;
  paredeLVd?: string;
  paredeLVs?: string;
  aorta?: string;
  atrioEsquerdo?: string;
  fracaoEncurtamento?: string;
  fracaoEjecaoTeicholz?: string;
}

export interface FuncaoDiastolicaData {
  ondaE?: string;
  ondaA?: string;
  tempoDesaceleracao?: string;
  triv?: string;
  padraoDiastolico?: string;
  conclusaoDiastolica?: string;
}

export interface FuncaoSistolicaData {
  simpson?: string;
  mapse?: string;
  epss?: string;
  statusFuncao?: string;
  tipoDisfuncao?: string;
}

export interface TdiData {
  s?: string;
  e?: string;
  a?: string;
}

export interface ValvasDopplerData {
  mitralVelocidade?: string;
  mitralGradiente?: string;
  mitralDpDt?: string;
  tricuspideVelocidade?: string;
  tricuspideGradiente?: string;
  pulmonarVelocidade?: string;
  pulmonarGradiente?: string;
  aorticaVelocidade?: string;
  aorticaGradiente?: string;
}

export interface OutrosData {
  septos?: string;
  pericardio?: string;
  camarasDireitas?: string;
  observacoes?: string;
}

export interface ObservacoesSecoesData {
  atrioEsquerdoAorta?: string;
  funcaoSistolica?: string;
  ventriculoDireito?: string;
}

export interface ObservacoesValvasData {
  mitral?: string;
  tricuspide?: string;
  pulmonar?: string;
  aortica?: string;
}

export interface PdfExamData {
  patientData: PatientData;
  examInfo: ExamInfo;
  measurementsData: MeasurementsData;
  classificationsData?: ClassificationsData;
  referencesData?: ReferencesData;
  funcaoDiastolica?: FuncaoDiastolicaData;
  funcaoSistolica?: FuncaoSistolicaData;
  ventriculoDireito?: RightVentricleData;
  tdiLivre?: TdiData;
  tdiSeptal?: TdiData;
  valvasDoppler?: ValvasDopplerData;
  outros?: OutrosData;
  valvesData?: {
    mitral?: string;
    tricuspide?: string;
    aortica?: string;
    pulmonar?: string;
  };
  achados?: string;
  conclusoes?: string;
  storedImages?: StoredImageData[];
  selectedImages?: number[];
  observacoesSecoes?: ObservacoesSecoesData;
  observacoesValvas?: ObservacoesValvasData;
}

interface PdfGeneratorOptions {
  profile: ProfileData | null;
  clinic: ClinicData | null;
}

const parseDecimal = (value: string | undefined): number => {
  if (!value) return 0;
  return parseFloat(value.replace(",", "."));
};

export async function generateExamPdf(
  examData: PdfExamData,
  options: PdfGeneratorOptions
): Promise<jsPDF> {
  const { profile, clinic } = options;
  
  const patientData: PatientData = examData.patientData || { nome: '', responsavel: '', especie: '', raca: '', sexo: '', idade: '', peso: '' };
  const examInfo: ExamInfo = examData.examInfo || {};
  const measurementsData: MeasurementsData = examData.measurementsData || {};
  const classificationsData: ClassificationsData = (examData.classificationsData || {}) as ClassificationsData;
  const referencesData: ReferencesData = (examData.referencesData || {}) as ReferencesData;
  const funcaoDiastolica: FuncaoDiastolicaData = examData.funcaoDiastolica || {};
  const funcaoSistolica: FuncaoSistolicaData = examData.funcaoSistolica || {};
  const ventriculoDireito: RightVentricleData = (examData.ventriculoDireito || {}) as RightVentricleData;
  const tdiLivre: TdiData = examData.tdiLivre || {};
  const tdiSeptal: TdiData = examData.tdiSeptal || {};
  const valvasDoppler: ValvasDopplerData = examData.valvasDoppler || {};
  const outros: OutrosData = examData.outros || { septos: "interventricular e interatrial íntegros", pericardio: "normal, sem derrame" };
  const achados = examData.achados || "";
  const conclusoes = examData.conclusoes || "";
  const comentariosAdicionais = (examData as PdfExamData & { comentariosAdicionais?: string }).comentariosAdicionais || "";
  const storedImages = examData.storedImages || [];
  const selectedImages = examData.selectedImages || [];
  const observacoesSecoes: ObservacoesSecoesData = examData.observacoesSecoes || {};
  const observacoesValvas: ObservacoesValvasData = examData.observacoesValvas || {};

  // DEBUG: Log dos valores de FS, FE para verificar persistência
  console.log("=== DEBUG PDF GENERATION ===");
  console.log("measurementsData.fracaoEncurtamento:", measurementsData.fracaoEncurtamento);
  console.log("measurementsData.fracaoEjecaoTeicholz:", measurementsData.fracaoEjecaoTeicholz);
  console.log("funcaoSistolica.simpson:", funcaoSistolica.simpson);
  console.log("measurementsData (full):", JSON.stringify(measurementsData, null, 2));
  console.log("=== END DEBUG ===");

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const headerHeight = 25;
  const contentStartY = headerHeight + 10;
  const bottomSafeArea = 20;
  let yPosition = margin;

  const navyBlue = [26, 42, 82];
  const normalGray = [60, 60, 60];

  // Cálculos automáticos
  const calculatedValues = {
    relacaoEA: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const a = parseDecimal(funcaoDiastolica.ondaA);
      return e && a && !isNaN(e) && !isNaN(a) ? (e / a).toFixed(2) : "-";
    })(),
    eTRIV: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const triv = parseDecimal(funcaoDiastolica.triv);
      return e && triv && !isNaN(e) && !isNaN(triv) ? (e / triv).toFixed(2) : "-";
    })(),
    relacaoEePrimeLivre: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrime = parseDecimal(tdiLivre?.e);
      return e && ePrime && !isNaN(e) && !isNaN(ePrime) ? (e / ePrime).toFixed(2) : "-";
    })(),
    relacaoEePrimeSeptal: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrime = parseDecimal(tdiSeptal?.e);
      return e && ePrime && !isNaN(e) && !isNaN(ePrime) ? (e / ePrime).toFixed(2) : "-";
    })(),
    mediaEePrime: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrimeLivre = parseDecimal(tdiLivre?.e);
      const ePrimeSeptal = parseDecimal(tdiSeptal?.e);
      if (!e || isNaN(e)) return "-";
      const hasLivre = ePrimeLivre && !isNaN(ePrimeLivre);
      const hasSeptal = ePrimeSeptal && !isNaN(ePrimeSeptal);
      if (hasLivre && hasSeptal) {
        const mediaEPrime = (ePrimeLivre + ePrimeSeptal) / 2;
        return (e / mediaEPrime).toFixed(2);
      } else if (hasLivre) {
        return (e / ePrimeLivre).toFixed(2);
      } else if (hasSeptal) {
        return (e / ePrimeSeptal).toFixed(2);
      }
      return "-";
    })(),
    fracaoEncurtamento: (() => {
      const dved = parseDecimal(measurementsData.dvedDiastole);
      const dves = parseDecimal(measurementsData.dvedSistole);
      return dved && dves && !isNaN(dved) && !isNaN(dves) ? (((dved - dves) / dved) * 100).toFixed(1) : "-";
    })(),
    fracaoEjecaoTeicholz: (() => {
      const dved = parseDecimal(measurementsData.dvedDiastole);
      const dves = parseDecimal(measurementsData.dvedSistole);
      if (!dved || !dves || isNaN(dved) || isNaN(dves)) return "-";
      const vdf = (7 * Math.pow(dved, 3)) / (2.4 + dved);
      const vsf = (7 * Math.pow(dves, 3)) / (2.4 + dves);
      const fe = ((vdf - vsf) / vdf) * 100;
      return fe.toFixed(1);
    })(),
  };

  // ========== HELPER FUNCTIONS ==========

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
        const logoHeight = maxHeight;
        const logoWidth = logoHeight * ratio;
        pdf.addImage(img, 'PNG', 10, 3, logoWidth, logoHeight);
      } catch (e) {
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text(clinic?.nome_fantasia || "VitaeCor", 15, 12);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text("Cardiologia Veterinária", 15, 18);
      }
    } else {
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(clinic?.nome_fantasia || "VitaeCor", 15, 12);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Cardiologia Veterinária", 15, 18);
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Ecodopplercardiograma", pageWidth - 15, 8, { align: "right" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(profile?.nome || "Veterinário Responsável", pageWidth - 15, 13, { align: "right" });
    const crmvLine = profile?.crmv ? `CRMV-${profile?.uf_crmv || ""}  ${profile.crmv}` : "";
    if (crmvLine) pdf.text(crmvLine, pageWidth - 15, 17, { align: "right" });
    if (profile?.telefone) pdf.text(profile.telefone, pageWidth - 15, 21, { align: "right" });
  };

  const checkPageBreak = async (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - bottomSafeArea) {
      pdf.addPage();
      await addHeader();
      yPosition = contentStartY;
      return true;
    }
    return false;
  };

  const addSectionHeader = async (title: string, minContentHeight: number = 25) => {
    // Verifica se há espaço para o título + conteúdo mínimo (evita títulos órfãos)
    await checkPageBreak(7 + minContentHeight);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, "F");
    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(title, margin + 2, yPosition);
    yPosition += 8;
  };

  const isEmpty = (value: string | undefined): boolean => {
    if (!value) return true;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "--" || trimmed === "0") return true;
    if (/^-\s*(cm|cm\/s|ms|mmHg|mmHg\/s|bpm|%|kg)?$/.test(trimmed)) return true;
    if (/^0\s*(cm|cm\/s|ms|mmHg|mmHg\/s|bpm|%|kg)?$/.test(trimmed)) return true;
    return false;
  };

  const formatTdi = (value: string | undefined): string => {
    if (!value || value === "-") return "-";
    const num = parseFloat(value);
    return isNaN(num) ? "-" : num.toFixed(1).replace(".", ",");
  };

  const addTableRow = (label: string, value: string, col2Label?: string, col2Value?: string) => {
    if (isEmpty(value) && (!col2Value || isEmpty(col2Value))) return;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
    if (!isEmpty(value)) pdf.text(`${label}: ${value}`, margin, yPosition);
    if (col2Label && col2Value && !isEmpty(col2Value)) pdf.text(`${col2Label}: ${col2Value}`, pageWidth / 2, yPosition);
    yPosition += 5;
  };

  const getClassificationText = (key: string): string => {
    const val = (classificationsData as unknown as Record<string, string>)?.[key];
    if (!val || val === "none") return "";
    if (val === "normal") return "Normal";
    if (val === "diminuido") return "Diminuído";
    if (val === "aumentado") return "Aumentado";
    return "";
  };

  const getReferenceText = (key: string): string => {
    const ref = (referencesData as unknown as Record<string, string>)?.[key];
    if (ref) return formatNumber(ref);
    
    // Mapeamento de referências Cornell para espécies caninas/felinas (fallback)
    const cornellReferences: Record<string, string> = {
      septoIVd: "0,35 - 0,94",
      dvedDiastole: "1,0 - 4,6",
      paredeLVd: "0,41 - 0,83",
      dvedSistole: "0,61 - 3,04",
      septoIVs: "0,48 - 1,32",
      paredeLVs: "0,67 - 1,29"
    };
    
    return cornellReferences[key] ? formatNumber(cornellReferences[key]) : "";
  };

  const addVE4ColumnRow = (
    label: string,
    value: string,
    referenceKey?: string,
    classificationKey?: string
  ) => {
    if (isEmpty(value)) return;
    pdf.setFontSize(9);
    pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
    pdf.setFont("helvetica", "normal");
    const col1X = margin;
    const col2X = margin + 68;
    const col3X = margin + 100;
    const col4X = margin + 142;
    pdf.text(label, col1X, yPosition);
    pdf.text(value, col2X, yPosition);
    if (referenceKey) {
      const refText = getReferenceText(referenceKey);
      if (refText) {
        pdf.setFontSize(8);
        pdf.text(refText, col3X, yPosition);
        pdf.setFontSize(9);
      }
    }
    if (classificationKey) {
      const classText = getClassificationText(classificationKey);
      if (classText) pdf.text(classText, col4X, yPosition);
    }
    yPosition += 5;
  };

  const addSignatureBlock = async () => {
    const titlePrefix = profile?.sexo === "feminino" ? "Dra." : "Dr.";
    const name = profile?.nome ? `${titlePrefix} ${profile.nome}` : "Veterinário Responsável";
    const crmvText = profile?.crmv ? `CRMV ${profile?.uf_crmv ? `${profile.uf_crmv} ` : ""}${profile.crmv}` : "";
    const specialtyText = profile?.especialidade || "";
    const signatureUrl = profile?.signature_url;
    const hasSignatureImage = !!signatureUrl;
    const signatureImgHeight = hasSignatureImage ? 15 : 0;
    const lineCount = 1 + (crmvText ? 1 : 0) + (specialtyText ? 1 : 0);
    const blockHeight = 2 + signatureImgHeight + lineCount * 4 + 4;
    const footerReserved = 12;

    if (yPosition + blockHeight > pageHeight - footerReserved) {
      pdf.addPage();
      await addHeader();
      yPosition = 35;
    }
    yPosition += 2; // Reduzido para 2mm

    if (signatureUrl) {
      try {
        const sigImg = new Image();
        sigImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          sigImg.onload = () => resolve();
          sigImg.onerror = () => reject();
          sigImg.src = signatureUrl;
        });
        const targetWidth = 40;
        const ratio = sigImg.height / sigImg.width;
        const targetHeight = targetWidth * ratio;
        const imgX = pageWidth / 2 - targetWidth / 2;
        pdf.addImage(sigImg, 'PNG', imgX, yPosition, targetWidth, Math.min(targetHeight, 15));
        yPosition += Math.min(targetHeight, 15) + 2;
      } catch (e) {
        console.error('Error loading signature image:', e);
      }
    }

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

  // ========== PAGE 1 HEADER ==========
  await addHeader();
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
  const labelOffset = 2;

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

  const formatDateForPdf = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  addCompactRow("Paciente:", patientData.nome || '-', "Espécie:", patientData.especie || '-');
  addCompactRow("Raça:", patientData.raca || '-', "Sexo:", patientData.sexo || '-');
  addCompactRow("Idade:", patientData.idade || '-', "Peso:", patientData.peso ? `${formatNumber(patientData.peso)} kg` : '-');
  addCompactRow("Tutor(a):", patientData.responsavel || '-', "Data:", formatDateForPdf(examInfo.data));
  addCompactRow("Solicitante:", examInfo.solicitante || '-', "Clínica/Hospital:", examInfo.clinica || '-');
  yPosition += 6;

  // Parâmetros Observados
  if (examInfo.ritmo || examInfo.frequenciaCardiaca) {
    await addSectionHeader("PARÂMETROS OBSERVADOS");
    addTableRow("Ritmo", examInfo.ritmo || "", "Frequência Cardíaca", examInfo.frequenciaCardiaca ? `${examInfo.frequenciaCardiaca} bpm` : "");
    yPosition += 5;
  }

  // ========== 1. VENTRÍCULO ESQUERDO (MODO M/B) - TABELA 4 COLUNAS ==========
  const modoLabel = examInfo.modoMedicao === "B" ? "MODO B" : "MODO M";
  await addSectionHeader(`VENTRÍCULO ESQUERDO (${modoLabel})`);

  const pesoNum = parseFloat(patientData.peso || "0");
  const dvedNum = parseFloat(measurementsData.dvedDiastole || "0");
  const dvedNorm = dvedNum && pesoNum ? (dvedNum / Math.pow(pesoNum, 0.294)).toFixed(2) : '';

  // Cabeçalho das 4 colunas (sem linha divisória para visual mais limpo)
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(100, 100, 100);
  pdf.text("Parâmetro", margin, yPosition);
  pdf.text("Valor", margin + 68, yPosition);
  pdf.text("Referência", margin + 100, yPosition);
  pdf.text("Status", margin + 142, yPosition);
  yPosition += 6;

  const fsValue = measurementsData.fracaoEncurtamento?.trim()
    ? measurementsData.fracaoEncurtamento
    : calculatedValues.fracaoEncurtamento;

  const feTeicholzValue = measurementsData.fracaoEjecaoTeicholz?.trim()
    ? measurementsData.fracaoEjecaoTeicholz
    : calculatedValues.fracaoEjecaoTeicholz;

  // Medidas com referência Cornell
  if (measurementsData.septoIVd) addVE4ColumnRow("Septo interventricular em diástole (SIVd)", `${formatNumber(measurementsData.septoIVd)} cm`, 'septoIVd', 'septoIVd');
  if (measurementsData.dvedDiastole) addVE4ColumnRow("Ventrículo esquerdo em diástole (VEd)", `${formatNumber(measurementsData.dvedDiastole)} cm`, 'dvedDiastole', 'dvedDiastole');
  if (measurementsData.paredeLVd) addVE4ColumnRow("Parede livre do VE em diástole (PLVEd)", `${formatNumber(measurementsData.paredeLVd)} cm`, 'paredeLVd', 'paredeLVd');
  if (measurementsData.dvedSistole) addVE4ColumnRow("Ventrículo esquerdo em sístole (VEs)", `${formatNumber(measurementsData.dvedSistole)} cm`, 'dvedSistole', 'dvedSistole');
  if (measurementsData.septoIVs) addVE4ColumnRow("Septo interventricular em sístole (SIVs)", `${formatNumber(measurementsData.septoIVs)} cm`, 'septoIVs', 'septoIVs');
  if (measurementsData.paredeLVs) addVE4ColumnRow("Parede livre do VE em sístole (PLVEs)", `${formatNumber(measurementsData.paredeLVs)} cm`, 'paredeLVs', 'paredeLVs');


  // Medidas funcionais: FS, FE Teicholz, DVEdN
  if (fsValue && fsValue !== '-') addVE4ColumnRow("Fração de Encurtamento (FS)", `${formatNumber(fsValue)}%`, 'fracaoEncurtamento', 'fracaoEncurtamento');
  if (feTeicholzValue && feTeicholzValue !== '-') addVE4ColumnRow("Fração de Ejeção (FE Teicholz)", `${formatNumber(feTeicholzValue)}%`, 'fracaoEjecaoTeicholz', 'fracaoEjecaoTeicholz');
  if (funcaoSistolica?.simpson) addVE4ColumnRow("Fração de Ejeção (FE Simpson)", `${formatNumber(funcaoSistolica.simpson)}%`, 'fracaoEjecaoSimpson', 'fracaoEjecaoSimpson');

  // DVEdN com referência fixa "< 1,70"
  if (dvedNorm && dvedNorm !== '-') {
    pdf.setFontSize(9);
    pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
    pdf.setFont("helvetica", "normal");
    const col1X = margin;
    const col2X = margin + 68;
    const col3X = margin + 100;
    const col4X = margin + 142;
    pdf.text("VE em diástole NORMALIZADO (DVEdN)", col1X, yPosition);
    pdf.text(formatNumber(dvedNorm), col2X, yPosition);
    pdf.setFontSize(8);
    pdf.text("< 1,70", col3X, yPosition);
    pdf.setFontSize(9);
    const classText = getClassificationText('dvedNormalizado');
    if (classText) pdf.text(classText, col4X, yPosition);
    yPosition += 5;
  }
  yPosition += 3;

  // ========== AVALIAÇÃO DA FUNÇÃO SISTÓLICA ==========
  const hasSystolicData = (fsValue && fsValue !== '-') || (feTeicholzValue && feTeicholzValue !== '-') ||
    funcaoSistolica?.mapse || funcaoSistolica?.epss || 
    funcaoSistolica?.simpson || funcaoSistolica?.statusFuncao || 
    funcaoSistolica?.tipoDisfuncao || observacoesSecoes?.funcaoSistolica?.trim();

  if (hasSystolicData) {
    await addSectionHeader("AVALIAÇÃO DA FUNÇÃO SISTÓLICA");

    // Layout horizontal para índices sistólicos - APENAS VALORES (sem referência, sem status)
    const hasFs = fsValue && fsValue !== '-';
    const hasFe = feTeicholzValue && feTeicholzValue !== '-';
    const hasSimpson = funcaoSistolica?.simpson;

    // Linha 1: FS | FE Teicholz | FE Simpson (layout horizontal)
    if (hasFs || hasFe || hasSimpson) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      
      const parts: string[] = [];
      if (hasFs) parts.push(`FS: ${formatNumber(fsValue)}%`);
      if (hasFe) parts.push(`FE (Teicholz): ${formatNumber(feTeicholzValue)}%`);
      if (hasSimpson) parts.push(`FE (Simpson): ${formatNumber(funcaoSistolica.simpson)}%`);
      
      const line1 = parts.join("   |   ");
      pdf.text(line1, margin, yPosition);
      yPosition += 5;
    }

    // Linha 2: MAPSE | EPSS (layout horizontal)
    const hasMapse = funcaoSistolica?.mapse;
    const hasEpss = funcaoSistolica?.epss;
    if (hasMapse || hasEpss) {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      
      const parts2: string[] = [];
      if (hasMapse) parts2.push(`MAPSE: ${formatNumber(funcaoSistolica.mapse)} cm`);
      if (hasEpss) parts2.push(`EPSS: ${formatNumber(funcaoSistolica.epss)} cm`);
      
      const line2 = parts2.join("   |   ");
      pdf.text(line2, margin, yPosition);
      yPosition += 5;
    }

    // Status da Função Sistólica
    if (funcaoSistolica?.statusFuncao) {
      const statusText = funcaoSistolica.statusFuncao === 'normal' 
        ? 'Função sistólica preservada' 
        : funcaoSistolica.statusFuncao === 'disfuncao' 
          ? `Disfunção sistólica${funcaoSistolica.tipoDisfuncao ? ` ${funcaoSistolica.tipoDisfuncao}` : ''}`
          : funcaoSistolica.statusFuncao;
      addTableRow("Avaliação", statusText);
    }

    // Linha 3: Observações da Função Sistólica
    if (observacoesSecoes?.funcaoSistolica?.trim()) {
      yPosition += 2;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      const obsLines = pdf.splitTextToSize(observacoesSecoes.funcaoSistolica, pageWidth - 2 * margin);
      for (const line of obsLines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
    }
    yPosition += 3;
  }

  // Átrio Esquerdo e Aorta
  if (measurementsData.aorta || measurementsData.atrioEsquerdo) {
    await addSectionHeader("ÁTRIO ESQUERDO / AORTA (MODO B)");
    const aeAo = measurementsData.atrioEsquerdo && measurementsData.aorta
      ? (parseFloat(measurementsData.atrioEsquerdo) / parseFloat(measurementsData.aorta)).toFixed(2)
      : '';
    if (measurementsData.aorta) addTableRow("Aorta", `${formatNumber(measurementsData.aorta)} cm`);
    if (measurementsData.atrioEsquerdo) addTableRow("Átrio esquerdo", `${formatNumber(measurementsData.atrioEsquerdo)} cm`);
    if (aeAo) {
      const aeAoClass = (classificationsData as unknown as Record<string, string>)?.relacaoAEAo
        ? ((classificationsData as unknown as Record<string, string>).relacaoAEAo === 'normal' ? 'Normal' : 'Aumentado')
        : '';
      const aeAoDisplay = aeAoClass ? `${formatNumber(aeAo)} (${aeAoClass})` : formatNumber(aeAo);
      addTableRow("Relação Átrio esquerdo/Aorta", aeAoDisplay);
    }
    // Observações da seção Átrio Esquerdo/Aorta
    if (observacoesSecoes?.atrioEsquerdoAorta?.trim()) {
      yPosition += 2;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      const obsLines = pdf.splitTextToSize(observacoesSecoes.atrioEsquerdoAorta, pageWidth - 2 * margin);
      for (const line of obsLines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
    }
    yPosition += 3;
  }

  // ========== 2. FUNÇÃO DIASTÓLICA DO VENTRÍCULO ESQUERDO ==========
  const hasDiastolicData = funcaoDiastolica?.ondaE || funcaoDiastolica?.ondaA || funcaoDiastolica?.tempoDesaceleracao || funcaoDiastolica?.triv;
  const hasTdiData = tdiLivre?.s || tdiLivre?.e || tdiLivre?.a || tdiSeptal?.s || tdiSeptal?.e || tdiSeptal?.a;

  if (hasDiastolicData || hasTdiData || funcaoDiastolica?.conclusaoDiastolica) {
    await addSectionHeader("FUNÇÃO DIASTÓLICA DO VENTRÍCULO ESQUERDO");

    // Dados do Doppler Mitral
    if (funcaoDiastolica?.ondaE) addTableRow("Velocidade da onda E", `${formatNumber(funcaoDiastolica.ondaE)} cm/s`);
    if (funcaoDiastolica?.ondaA) addTableRow("Velocidade da onda A", `${formatNumber(funcaoDiastolica.ondaA)} cm/s`);
    if (calculatedValues.relacaoEA && calculatedValues.relacaoEA !== '-') addTableRow("Relação onda E/A", formatNumber(calculatedValues.relacaoEA));
    if (funcaoDiastolica?.tempoDesaceleracao) addTableRow("Tempo de desaceleração da onda E", `${formatNumber(funcaoDiastolica.tempoDesaceleracao)} ms`);
    if (funcaoDiastolica?.triv) addTableRow("Tempo de Relaxamento Isovolumétrico (TRIV)", `${formatNumber(funcaoDiastolica.triv)} ms`);
    if (calculatedValues.eTRIV && calculatedValues.eTRIV !== '-') addTableRow("E/TRIV", formatNumber(calculatedValues.eTRIV));

    // ========== SUBSEÇÃO TDI (OBRIGATÓRIA) ==========
    if (hasTdiData) {
      yPosition += 3;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
      pdf.text("Doppler Tecidual (TDI)", margin, yPosition);
      yPosition += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);

      // TDI Parede Livre
      if (tdiLivre?.s || tdiLivre?.e || tdiLivre?.a) {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.text("Parede Livre:", margin, yPosition);
        yPosition += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        const tdiLivreValues: string[] = [];
        if (tdiLivre.s) tdiLivreValues.push(`s': ${formatTdi(tdiLivre.s)} cm/s`);
        if (tdiLivre.e) tdiLivreValues.push(`e': ${formatTdi(tdiLivre.e)} cm/s`);
        if (tdiLivre.a) tdiLivreValues.push(`a': ${formatTdi(tdiLivre.a)} cm/s`);
        if (calculatedValues.relacaoEePrimeLivre && calculatedValues.relacaoEePrimeLivre !== '-') {
          tdiLivreValues.push(`E/e': ${formatNumber(calculatedValues.relacaoEePrimeLivre)}`);
        }
        pdf.text(tdiLivreValues.join("   |   "), margin + 2, yPosition);
        yPosition += 5;
      }

      // TDI Parede Septal
      if (tdiSeptal?.s || tdiSeptal?.e || tdiSeptal?.a) {
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.text("Parede Septal:", margin, yPosition);
        yPosition += 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        const tdiSeptalValues: string[] = [];
        if (tdiSeptal.s) tdiSeptalValues.push(`s': ${formatTdi(tdiSeptal.s)} cm/s`);
        if (tdiSeptal.e) tdiSeptalValues.push(`e': ${formatTdi(tdiSeptal.e)} cm/s`);
        if (tdiSeptal.a) tdiSeptalValues.push(`a': ${formatTdi(tdiSeptal.a)} cm/s`);
        if (calculatedValues.relacaoEePrimeSeptal && calculatedValues.relacaoEePrimeSeptal !== '-') {
          tdiSeptalValues.push(`E/e': ${formatNumber(calculatedValues.relacaoEePrimeSeptal)}`);
        }
        pdf.text(tdiSeptalValues.join("   |   "), margin + 2, yPosition);
        yPosition += 5;
      }

      // Média E/e'
      if (calculatedValues.mediaEePrime && calculatedValues.mediaEePrime !== '-') {
        pdf.setFont("helvetica", "bold");
        pdf.text(`Média E/e': ${formatNumber(calculatedValues.mediaEePrime)}`, margin, yPosition);
        pdf.setFont("helvetica", "normal");
        yPosition += 5;
      }
    }

    // ========== CONCLUSÃO DIASTÓLICA (APENAS conclusaoDiastolica) ==========
    if (funcaoDiastolica?.conclusaoDiastolica) {
      yPosition += 3;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      const lines = pdf.splitTextToSize(funcaoDiastolica.conclusaoDiastolica, pageWidth - 2 * margin);
      for (const line of lines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
    }
    yPosition += 3;
  }

  // ========== 3. AVALIAÇÃO HEMODINÂMICA - VALVAS ==========
  // IMPORTANTE: Bloco inteiro tratado junto para evitar título órfão (page-break-inside: avoid)
  const hasValveData = valvasDoppler?.mitralVelocidade || valvasDoppler?.mitralGradiente || valvasDoppler?.mitralDpDt ||
    valvasDoppler?.tricuspideVelocidade || valvasDoppler?.tricuspideGradiente ||
    valvasDoppler?.pulmonarVelocidade || valvasDoppler?.pulmonarGradiente ||
    valvasDoppler?.aorticaVelocidade || valvasDoppler?.aorticaGradiente;

  if (hasValveData) {
    // Calcula altura total estimada do bloco de valvas para decidir se cabe na página atual
    const estimateValveBlockHeight = () => {
      let height = 10; // Header
      const countMitral = [valvasDoppler?.mitralVelocidade, valvasDoppler?.mitralGradiente, valvasDoppler?.mitralDpDt].filter(v => v && !isEmpty(v)).length;
      const countTricuspide = [valvasDoppler?.tricuspideVelocidade, valvasDoppler?.tricuspideGradiente].filter(v => v && !isEmpty(v)).length;
      const countAortica = [valvasDoppler?.aorticaVelocidade, valvasDoppler?.aorticaGradiente].filter(v => v && !isEmpty(v)).length;
      const countPulmonar = [valvasDoppler?.pulmonarVelocidade, valvasDoppler?.pulmonarGradiente].filter(v => v && !isEmpty(v)).length;
      
      if (countMitral > 0) height += 8 + countMitral * 5;
      if (countTricuspide > 0) height += 8 + countTricuspide * 5;
      if (countAortica > 0) height += 8 + countAortica * 5;
      if (countPulmonar > 0) height += 8 + countPulmonar * 5;
      return height;
    };

    const totalBlockHeight = estimateValveBlockHeight();
    
    // Se o bloco inteiro não couber, pula para próxima página (evita título órfão)
    await checkPageBreak(Math.min(totalBlockHeight, 80)); // Cap em 80mm para blocos muito grandes

    await addSectionHeader("AVALIAÇÃO HEMODINÂMICA", 30);
    yPosition += 2;

    const addValveBlock = async (title: string, rows: Array<{ label: string; value: string }>) => {
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

    // VALVA MITRAL
    if (valvasDoppler?.mitralVelocidade || valvasDoppler?.mitralGradiente || valvasDoppler?.mitralDpDt) {
      await addValveBlock("VALVA MITRAL", [
        { label: "Velocidade máxima do fluxo retrógrado da IM", value: valvasDoppler.mitralVelocidade ? `${formatNumber(valvasDoppler.mitralVelocidade)} cm/s` : "" },
        { label: "Gradiente", value: valvasDoppler.mitralGradiente ? `${formatNumber(valvasDoppler.mitralGradiente)} mmHg` : "" },
        { label: "+dP/dT", value: valvasDoppler.mitralDpDt ? `${formatNumber(valvasDoppler.mitralDpDt)} mmHg/s` : "" },
      ]);
      if (observacoesValvas?.mitral?.trim()) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
        const obsLines = pdf.splitTextToSize(observacoesValvas.mitral, pageWidth - 2 * margin);
        for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
        yPosition += 2;
      }
    }

    // VALVA TRICÚSPIDE
    if (valvasDoppler?.tricuspideVelocidade || valvasDoppler?.tricuspideGradiente) {
      await addValveBlock("VALVA TRICÚSPIDE", [
        { label: "Velocidade máxima do fluxo retrógrado da IT", value: valvasDoppler.tricuspideVelocidade ? `${formatNumber(valvasDoppler.tricuspideVelocidade)} cm/s` : "" },
        { label: "Gradiente", value: valvasDoppler.tricuspideGradiente ? `${formatNumber(valvasDoppler.tricuspideGradiente)} mmHg` : "" },
      ]);
      if (observacoesValvas?.tricuspide?.trim()) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
        const obsLines = pdf.splitTextToSize(observacoesValvas.tricuspide, pageWidth - 2 * margin);
        for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
        yPosition += 2;
      }
    }

    // VALVA AÓRTICA
    if (valvasDoppler?.aorticaVelocidade || valvasDoppler?.aorticaGradiente) {
      await addValveBlock("VALVA AÓRTICA", [
        { label: "Velocidade máxima do fluxo transvalvar", value: valvasDoppler.aorticaVelocidade ? `${formatNumber(valvasDoppler.aorticaVelocidade)} cm/s` : "" },
        { label: "Gradiente", value: valvasDoppler.aorticaGradiente ? `${formatNumber(valvasDoppler.aorticaGradiente)} mmHg` : "" },
      ]);
      if (observacoesValvas?.aortica?.trim()) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
        const obsLines = pdf.splitTextToSize(observacoesValvas.aortica, pageWidth - 2 * margin);
        for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
        yPosition += 2;
      }
    }

    // VALVA PULMONAR
    if (valvasDoppler?.pulmonarVelocidade || valvasDoppler?.pulmonarGradiente) {
      await addValveBlock("VALVA PULMONAR", [
        { label: "Velocidade máxima do fluxo transvalvar", value: valvasDoppler.pulmonarVelocidade ? `${formatNumber(valvasDoppler.pulmonarVelocidade)} cm/s` : "" },
        { label: "Gradiente", value: valvasDoppler.pulmonarGradiente ? `${formatNumber(valvasDoppler.pulmonarGradiente)} mmHg` : "" },
      ]);
      if (observacoesValvas?.pulmonar?.trim()) {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
        const obsLines = pdf.splitTextToSize(observacoesValvas.pulmonar, pageWidth - 2 * margin);
        for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
        yPosition += 2;
      }
    }
  }

  // Ventrículo Direito
  const hasRightVentricleData = ventriculoDireito?.atrioDireito || ventriculoDireito?.ventriculoDireito ||
    ventriculoDireito?.tapse || ventriculoDireito?.fac || ventriculoDireito?.tdiS;

  if (hasRightVentricleData) {
    await addSectionHeader("VENTRÍCULO DIREITO");
    if (ventriculoDireito?.atrioDireito && ventriculoDireito.atrioDireito !== "none") {
      addTableRow("Átrio Direito", ventriculoDireito.atrioDireito);
    }
    if (ventriculoDireito?.ventriculoDireito && ventriculoDireito.ventriculoDireito !== "none") {
      addTableRow("Ventrículo Direito", ventriculoDireito.ventriculoDireito);
    }
    if (ventriculoDireito?.tapse) addTableRow("TAPSE", `${formatNumber(ventriculoDireito.tapse)} cm`);
    if (ventriculoDireito?.fac) addTableRow("FAC", `${formatNumber(ventriculoDireito.fac)}%`);
    if (ventriculoDireito?.tdiS) addTableRow("TDI: s'", `${formatNumber(ventriculoDireito.tdiS)} cm/s`);
    if (observacoesSecoes?.ventriculoDireito?.trim()) {
      yPosition += 2;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
      const obsLines = pdf.splitTextToSize(observacoesSecoes.ventriculoDireito, pageWidth - 2 * margin);
      for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
    }
    yPosition += 3;
  }

  // Outros
  await addSectionHeader("OUTROS");
  addTableRow("Septos", outros?.septos || "interventricular e interatrial íntegros");
  addTableRow("Pericárdio", outros?.pericardio || "normal, sem derrame");
  if (outros?.observacoes?.trim()) {
    yPosition += 2;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(normalGray[0], normalGray[1], normalGray[2]);
    const obsLines = pdf.splitTextToSize(outros.observacoes, pageWidth - 2 * margin);
    for (const line of obsLines) { await checkPageBreak(5); pdf.text(line, margin, yPosition); yPosition += 5; }
  }
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

  // Impressão Diagnóstica
  if (conclusoes) {
    await addSectionHeader("IMPRESSÃO DIAGNÓSTICA");
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(conclusoes, pageWidth - 2 * margin);
    for (const line of lines) {
      await checkPageBreak(5);
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    }
    
    // Comentários Adicionais (em negrito, sem rótulo)
    if (comentariosAdicionais) {
      yPosition += 6; // Espaçamento equivalente a ~2 quebras de linha / margin-top: 20px
      pdf.setFont("helvetica", "bold");
      const commentLines = pdf.splitTextToSize(comentariosAdicionais, pageWidth - 2 * margin);
      for (const line of commentLines) {
        await checkPageBreak(5);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      }
      pdf.setFont("helvetica", "normal");
    }
  }

  // Assinatura
  await addSignatureBlock();

  // ========== 4. IMAGENS (GRID 2x3, object-fit: contain) ==========
  const selectedImageData = selectedImages.length > 0
    ? storedImages.filter((_, index) => selectedImages.includes(index))
    : storedImages;

  if (selectedImageData.length > 0) {
    pdf.addPage();
    await addHeader();

    pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("ANEXOS / IMAGENS DO EXAME", pageWidth / 2, 35, { align: "center" });

    const imagesPerPage = 6;
    const cols = 2;
    const imgMarginH = margin;
    const gapBetweenImages = 4;
    const startY = 42;

    const availableWidth = pageWidth - 2 * imgMarginH;
    const cellWidth = (availableWidth - (cols - 1) * gapBetweenImages) / cols;
    const cellHeight = 80; // 300px ≈ 80mm

    const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 4, height: 3 });
        img.src = dataUrl;
      });
    };

    const calculateFitDimensions = (
      originalWidth: number,
      originalHeight: number,
      maxWidth: number,
      maxHeight: number
    ) => {
      const aspectRatio = originalWidth / originalHeight;
      let finalWidth = maxWidth;
      let finalHeight = maxWidth / aspectRatio;
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = maxHeight * aspectRatio;
      }
      return { width: finalWidth, height: finalHeight };
    };

    let imageIndex = 0;

    while (imageIndex < selectedImageData.length) {
      if (imageIndex > 0 && imageIndex % imagesPerPage === 0) {
        pdf.addPage();
        await addHeader();
        pdf.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("ANEXOS / IMAGENS DO EXAME (continuação)", pageWidth / 2, 35, { align: "center" });
      }

      const pageImageIndex = imageIndex % imagesPerPage;
      const row = Math.floor(pageImageIndex / cols);
      const col = pageImageIndex % cols;

      const cellX = imgMarginH + col * (cellWidth + gapBetweenImages);
      const cellY = startY + row * (cellHeight + gapBetweenImages);

      const img = selectedImageData[imageIndex];
      const imgUrl = img.storageUrl || img.dataUrl;

      if (imgUrl && (img.type?.startsWith('image/') || imgUrl.startsWith('data:image') || imgUrl.startsWith('http'))) {
        try {
          let imageData = imgUrl;
          if (imgUrl.startsWith('http')) {
            imageData = await imageUrlToBase64(imgUrl);
          }

          const dimensions = await getImageDimensions(imageData);
          const fitDimensions = calculateFitDimensions(
            dimensions.width,
            dimensions.height,
            cellWidth,
            cellHeight
          );

          // Centralizar imagem (flex center)
          const x = cellX + (cellWidth - fitDimensions.width) / 2;
          const y = cellY + (cellHeight - fitDimensions.height) / 2;

          const format = imageData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(imageData, format as any, x, y, fitDimensions.width, fitDimensions.height);
        } catch (e) {
          console.error('Error adding image to PDF:', e);
        }
      }
      imageIndex++;
    }
  }

  // Footer: page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
  }

  return pdf;
}
