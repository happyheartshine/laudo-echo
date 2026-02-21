import { useState, useEffect, useRef, useCallback } from "react";
import type { Json } from "@/integrations/supabase/types";
import { Layout } from "@/components/Layout";
import { MeasurementsSection, ClassificationsData, ReferencesData } from "@/components/exam/MeasurementsSection";
import { RightVentricleSection, RightVentricleData } from "@/components/exam/RightVentricleSection";
import { ValvesSection } from "@/components/exam/ValvesSection";
import { Button } from "@/components/ui/button";
import { FileDown, Save, ArrowLeft, Calendar, Eye, Scan } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { generateExamPdf, PdfExamData } from "@/lib/pdfGenerator";
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
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";
import { BillingConfirmationModal } from "@/components/financial/BillingConfirmationModal";
import { ImageGalleryDrawer } from "@/components/exam/ImageGalleryDrawer";
import { DiagnosticTemplateSelector } from "@/components/exam/DiagnosticTemplateSelector";
import { extractExamFromImage, mergeExtractedExamContent, type ExtractedExamContent } from "@/lib/ocrUtils";

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
  
  // Billing confirmation modal state
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [pendingBillingData, setPendingBillingData] = useState<{
    examId: string;
    clinicName: string;
    clinicId: string;
    suggestedAmount: number;
  } | null>(null);

const [patientData, setPatientData] = useState<PatientData>({
    nome: "",
    responsavel: "",
    responsavelTelefone: "",
    responsavelEmail: "",
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
    partnerClinicId: "" as string, // ID da clínica parceira selecionada
    partnerVetId: "" as string, // ID do veterinário parceiro selecionado
    performingVetId: "" as string, // ID do ecocardiografista responsável
    performingVetName: "" as string, // Nome do ecocardiografista (para exibir no PDF)
  });

  // Estados para clínicas e veterinários parceiros
  interface PartnerClinic {
    id: string;
    nome: string;
    valor_exame: number;
    responsavel: string | null;
    telefone: string | null;
  }
  
  interface PartnerVet {
    id: string;
    partner_clinic_id: string;
    nome: string;
  }
  
  const [partnerClinics, setPartnerClinics] = useState<PartnerClinic[]>([]);
  const [partnerVets, setPartnerVets] = useState<PartnerVet[]>([]);
  
  // Estado para membros da equipe (ecocardiografistas)
  interface TeamMember {
    id: string;
    nome: string;
    crmv: string | null;
    uf_crmv: string | null;
    user_id: string;
  }
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Buscar clínicas, veterinários parceiros e membros da equipe
  useEffect(() => {
    const fetchPartnerData = async () => {
      if (!user) return;

      const { data: clinics, error: clinicsError } = await supabase
        .from("partner_clinics")
        .select("id, nome, valor_exame, responsavel, telefone")
        .eq("active", true)
        .order("nome");

      if (clinicsError) {
        console.error("DadosExame: Erro ao carregar clínicas parceiras", clinicsError);
      }
      if (clinics) setPartnerClinics(clinics);

      const { data: vets, error: vetsError } = await supabase
        .from("partner_veterinarians")
        .select("id, partner_clinic_id, nome")
        .order("nome");

      if (vetsError) {
        console.error("DadosExame: Erro ao carregar veterinários parceiros", vetsError);
      }
      if (vets) setPartnerVets(vets);

      const { data: members, error: membersError } = await supabase
        .from("profiles")
        .select("id, nome, crmv, uf_crmv, user_id")
        .order("nome");

      if (membersError) {
        console.error("DadosExame: Erro ao carregar membros da equipe", membersError);
      }
      if (members) {
        setTeamMembers(members);
        if (!examInfo.performingVetId && profile) {
          const currentUserMember = members.find((m) => m.user_id === user.id);
          if (currentUserMember) {
            setExamInfo((prev) => ({
              ...prev,
              performingVetId: currentUserMember.id,
              performingVetName: currentUserMember.nome,
            }));
          }
        }
      }
    };

    fetchPartnerData();
  }, [user, profile]);
  
  // Veterinários filtrados pela clínica selecionada
  const filteredVets = examInfo.partnerClinicId 
    ? partnerVets.filter(v => v.partner_clinic_id === examInfo.partnerClinicId)
    : [];
  
  // Handler para seleção de clínica - atualiza nome e limpa veterinário se mudar
  const handleClinicSelect = (clinicId: string) => {
    const selectedClinic = partnerClinics.find(c => c.id === clinicId);
    setExamInfo(prev => ({
      ...prev,
      partnerClinicId: clinicId,
      clinica: selectedClinic?.nome || "",
      // Limpa veterinário se mudar de clínica
      partnerVetId: "",
      solicitante: "",
    }));
  };
  
  // Handler para seleção de veterinário
  const handleVetSelect = (vetId: string) => {
    const selectedVet = partnerVets.find(v => v.id === vetId);
    setExamInfo(prev => ({
      ...prev,
      partnerVetId: vetId,
      solicitante: selectedVet?.nome || "",
    }));
  };
  
  // Handler para seleção do ecocardiografista responsável
  const handlePerformingVetSelect = (memberId: string) => {
    const selectedMember = teamMembers.find(m => m.id === memberId);
    setExamInfo(prev => ({
      ...prev,
      performingVetId: memberId,
      performingVetName: selectedMember?.nome || "",
    }));
  };

  const [measurementsData, setMeasurementsData] = useState({
    dvedDiastole: "",
    dvedSistole: "",
    septoIVd: "",
    septoIVs: "",
    paredeLVd: "",
    paredeLVs: "",
    aorta: "",
    atrioEsquerdo: "",
    fracaoEncurtamento: "",
    fracaoEjecaoTeicholz: "",
  });

  // Classificações do Ventrículo Esquerdo
  const [classificationsData, setClassificationsData] = useState<ClassificationsData>({
    septoIVd: "",
    dvedDiastole: "",
    paredeLVd: "",
    dvedSistole: "",
    dvedNormalizado: "",
    fracaoEncurtamento: "",
    fracaoEjecaoTeicholz: "",
    fracaoEjecaoSimpson: "",
    septoIVs: "",
    paredeLVs: "",
    relacaoAEAo: "",
  });

  // Referências Cornell
  const [referencesData, setReferencesData] = useState({
    septoIVd: "",
    dvedDiastole: "",
    paredeLVd: "",
    dvedSistole: "",
    septoIVs: "",
    paredeLVs: "",
    fracaoEncurtamento: "",
    fracaoEjecaoTeicholz: "",
    fracaoEjecaoSimpson: "",
  });

  // Toggle para usar referências automáticas (Cornell para caninos, ACVIM para felinos)
  const [useAutoReferences, setUseAutoReferences] = useState(true);

  // Fórmulas Cornell 2004 para cálculo de referências
  const CORNELL_FORMULAS: Record<string, { minCoef: number; minExp: number; maxCoef: number; maxExp: number }> = {
    septoIVd: { minCoef: 0.29, minExp: 0.241, maxCoef: 0.59, maxExp: 0.241 },
    dvedDiastole: { minCoef: 1.27, minExp: 0.294, maxCoef: 1.85, maxExp: 0.294 },
    paredeLVd: { minCoef: 0.29, minExp: 0.232, maxCoef: 0.60, maxExp: 0.232 },
    dvedSistole: { minCoef: 0.71, minExp: 0.315, maxCoef: 1.26, maxExp: 0.315 },
    septoIVs: { minCoef: 0.43, minExp: 0.240, maxCoef: 0.79, maxExp: 0.240 },
    paredeLVs: { minCoef: 0.48, minExp: 0.222, maxCoef: 0.87, maxExp: 0.222 },
  };

  // Referências ACVIM 2020 para felinos
  const ACVIM_FELINE_REFERENCES: Record<string, string> = {
    septoIVd: "< 0,60",
    paredeLVd: "< 0,60",
  };

  // Calcula referência Cornell baseada no peso
  const calculateCornellReference = (peso: number, field: string): string => {
    if (!peso || peso <= 0 || isNaN(peso)) return "";
    
    const formula = CORNELL_FORMULAS[field];
    if (!formula) return "";
    
    const min = formula.minCoef * Math.pow(peso, formula.minExp);
    const max = formula.maxCoef * Math.pow(peso, formula.maxExp);
    
    return `${min.toFixed(2).replace('.', ',')} - ${max.toFixed(2).replace('.', ',')}`;
  };

  // Handler para toggle de referências - preserva referências manuais de FS/FE
  const handleAutoReferencesToggle = (enabled: boolean) => {
    setUseAutoReferences(enabled);
    
    // Preservar referências manuais de FS, FE Teicholz e FE Simpson
    const manualFsRef = referencesData.fracaoEncurtamento;
    const manualFeTeicholzRef = referencesData.fracaoEjecaoTeicholz;
    const manualFeSimpsonRef = referencesData.fracaoEjecaoSimpson;
    
    if (!enabled) {
      // Se desligar, limpa campos calculados mas preserva os manuais (FS, FE)
      setReferencesData({
        septoIVd: "",
        dvedDiastole: "",
        paredeLVd: "",
        dvedSistole: "",
        septoIVs: "",
        paredeLVs: "",
        fracaoEncurtamento: manualFsRef, // Preserva valor manual
        fracaoEjecaoTeicholz: manualFeTeicholzRef, // Preserva valor manual
        fracaoEjecaoSimpson: manualFeSimpsonRef, // Preserva valor manual
      });
    } else {
      // Se ligar, recalcula referências Cornell/ACVIM mas preserva FS/FE manuais
      const peso = parseFloat(patientData.peso?.replace(',', '.') || '0');
      const isFeline = patientData.especie === 'felino';
      
      if (isFeline) {
        // Referências ACVIM para felinos
        setReferencesData({
          septoIVd: ACVIM_FELINE_REFERENCES.septoIVd || "",
          dvedDiastole: "",
          paredeLVd: ACVIM_FELINE_REFERENCES.paredeLVd || "",
          dvedSistole: "",
          septoIVs: "",
          paredeLVs: "",
          fracaoEncurtamento: manualFsRef, // Preserva valor manual
          fracaoEjecaoTeicholz: manualFeTeicholzRef, // Preserva valor manual
          fracaoEjecaoSimpson: manualFeSimpsonRef, // Preserva valor manual
        });
      } else {
        // Referências Cornell para caninos (baseadas no peso)
        setReferencesData({
          septoIVd: calculateCornellReference(peso, 'septoIVd'),
          dvedDiastole: calculateCornellReference(peso, 'dvedDiastole'),
          paredeLVd: calculateCornellReference(peso, 'paredeLVd'),
          dvedSistole: calculateCornellReference(peso, 'dvedSistole'),
          septoIVs: calculateCornellReference(peso, 'septoIVs'),
          paredeLVs: calculateCornellReference(peso, 'paredeLVs'),
          fracaoEncurtamento: manualFsRef, // Preserva valor manual
          fracaoEjecaoTeicholz: manualFeTeicholzRef, // Preserva valor manual
          fracaoEjecaoSimpson: manualFeSimpsonRef, // Preserva valor manual
        });
      }
    }
  };

  // Novos campos de função diastólica
  const [funcaoDiastolica, setFuncaoDiastolica] = useState({
    ondaE: "",
    ondaA: "",
    tempoDesaceleracao: "",
    triv: "",
    padraoDiastolico: "",
    conclusaoDiastolica: "",
  });

  // Handler para mudança de padrão diastólico com auto-preenchimento
  const handlePadraoDiastolicoChange = (value: string) => {
    // O value do select já contém o texto completo da descrição
    setFuncaoDiastolica(prev => ({
      ...prev,
      padraoDiastolico: value,
      conclusaoDiastolica: value // Preenche automaticamente com o texto do padrão selecionado
    }));
  };

  // Função Sistólica - Novos campos
  const [funcaoSistolica, setFuncaoSistolica] = useState({
    simpson: "",
    mapse: "",
    epss: "",
    statusFuncao: "",
    tipoDisfuncao: "",
  });

  // Ventrículo Direito - Nova seção
  const [ventriculoDireito, setVentriculoDireito] = useState<RightVentricleData>({
    atrioDireito: "",
    ventriculoDireito: "",
    tapse: "",
    fac: "",
    tdiS: "",
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
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const a = parseDecimal(funcaoDiastolica.ondaA);
      return e && a && !isNaN(e) && !isNaN(a) ? (e / a).toFixed(2) : "-";
    })(),
    // E/TRIV
    eTRIV: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const triv = parseDecimal(funcaoDiastolica.triv);
      return e && triv && !isNaN(e) && !isNaN(triv) ? (e / triv).toFixed(2) : "-";
    })(),
    // E/e' Parede Livre
    relacaoEePrimeLivre: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrime = parseDecimal(tdiLivre.e);
      return e && ePrime && !isNaN(e) && !isNaN(ePrime) ? (e / ePrime).toFixed(2) : "-";
    })(),
    // E/e' Parede Septal
    relacaoEePrimeSeptal: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrime = parseDecimal(tdiSeptal.e);
      return e && ePrime && !isNaN(e) && !isNaN(ePrime) ? (e / ePrime).toFixed(2) : "-";
    })(),
    // Média E/e'
    mediaEePrime: (() => {
      const e = parseDecimal(funcaoDiastolica.ondaE);
      const ePrimeLivre = parseDecimal(tdiLivre.e);
      const ePrimeSeptal = parseDecimal(tdiSeptal.e);
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
    // Fração de Encurtamento (FE%)
    fracaoEncurtamento: (() => {
      const dved = parseDecimal(measurementsData.dvedDiastole);
      const dves = parseDecimal(measurementsData.dvedSistole);
      return dved && dves && !isNaN(dved) && !isNaN(dves) ? (((dved - dves) / dved) * 100).toFixed(1) : "-";
    })(),
    // Fração de Ejeção (Teicholz): FE = (VDF - VSF) / VDF * 100
    // VDF = 7 * DVED³ / (2.4 + DVED) e VSF = 7 * DVES³ / (2.4 + DVES)
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

  // Bernoulli auto-calculation: Gradient = 4 * (V_m/s)² where V_m/s = V_cm/s / 100
  const calculateBernoulliGradient = (velocityCmS: string): string => {
    const v = parseDecimal(velocityCmS);
    if (!v || isNaN(v) || v === 0) return "";
    const vMs = Math.abs(v) / 100;
    const gradient = 4 * Math.pow(vMs, 2);
    return gradient.toFixed(1).replace(".", ",");
  };

  const handleVelocidadeChange = (valve: string, value: string) => {
    const sanitized = sanitizeDecimalInput(value);
    const gradient = calculateBernoulliGradient(sanitized);
    setValvasDoppler(prev => ({
      ...prev,
      [`${valve}Velocidade`]: sanitized,
      [`${valve}Gradiente`]: gradient,
    }));
  };

  const [outros, setOutros] = useState({
    septos: "interventricular e interatrial íntegros",
    pericardio: "normal, sem derrame",
    observacoes: "", // Novo campo de observações
  });

  // Novos estados para observações de cada seção
  const [observacoesSecoes, setObservacoesSecoes] = useState({
    atrioEsquerdoAorta: "",
    funcaoSistolica: "",
    ventriculoDireito: "",
  });

  // Observações específicas de cada valva
  const [observacoesValvas, setObservacoesValvas] = useState({
    mitral: "",
    tricuspide: "",
    pulmonar: "",
    aortica: "",
  });

  const [valvesData, setValvesData] = useState({
    mitral: "",
    tricuspide: "",
    aortica: "",
    pulmonar: "",
  });

  const [achados, setAchados] = useState("");
  const [conclusoes, setConclusoes] = useState("");
  const [comentariosAdicionais, setComentariosAdicionais] = useState("");
  const [storedImages, setStoredImages] = useState<StoredImageData[]>([]);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [isExtractingExam, setIsExtractingExam] = useState(false);
  // Preview state no longer needed - opening in new tab

  /** Get base64 from StoredImageData (data URL or fetch remote URL). */
  const getBase64FromStoredImage = useCallback(async (img: StoredImageData): Promise<string | null> => {
    if (img.dataUrl.startsWith("data:")) {
      const base64 = img.dataUrl.split(",")[1];
      return base64 || null;
    }
    try {
      const res = await fetch(img.dataUrl);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1] ?? null);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }, []);

  /** Fill form from all stored images using OCR (each image can contribute different sections). */
  const handleFillFromImage = useCallback(async () => {
    if (storedImages.length === 0) {
      toast({
        title: "Nenhuma imagem",
        description: "Adicione ao menos uma imagem do exame para extrair os dados.",
        variant: "destructive",
      });
      return;
    }
    const maxImages = 10;
    const imagesToProcess = storedImages.slice(0, maxImages);
    setIsExtractingExam(true);
    try {
      let merged: ExtractedExamContent = {};
      let successCount = 0;
      for (const img of imagesToProcess) {
        const base64 = await getBase64FromStoredImage(img);
        if (!base64) continue;
        const result = await extractExamFromImage(base64);
        if (result.ok && result.data) {
          merged = mergeExtractedExamContent(merged, result.data);
          successCount += 1;
        }
      }
      if (successCount === 0) {
        toast({
          title: "Extração indisponível",
          description: "Não foi possível extrair dados de nenhuma imagem. Verifique a conexão ou tente outras imagens.",
          variant: "destructive",
        });
        return;
      }
      const d = merged;
      const merge = (prev: Record<string, string>, next?: Record<string, string> | null): Record<string, string> => {
        if (!next) return prev;
        const filtered = Object.fromEntries(
          Object.entries(next).filter(([, v]) => v != null && String(v).trim() !== "")
        );
        return { ...prev, ...filtered };
      };
      if (d.measurementsData) setMeasurementsData((prev) => merge(prev, d.measurementsData) as typeof measurementsData);
      if (d.funcaoDiastolica) setFuncaoDiastolica((prev) => merge(prev, d.funcaoDiastolica) as typeof funcaoDiastolica);
      if (d.funcaoSistolica) setFuncaoSistolica((prev) => merge(prev, d.funcaoSistolica) as typeof funcaoSistolica);
      if (d.ventriculoDireito) {
        const filtered = Object.fromEntries(
          Object.entries(d.ventriculoDireito).filter(([, v]) => v != null && String(v).trim() !== "")
        );
        setVentriculoDireito((prev) => ({ ...prev, ...filtered } as RightVentricleData));
      }
      if (d.tdiLivre) setTdiLivre((prev) => merge(prev, d.tdiLivre) as typeof tdiLivre);
      if (d.tdiSeptal) setTdiSeptal((prev) => merge(prev, d.tdiSeptal) as typeof tdiSeptal);
      if (d.valvasDoppler) {
        setValvasDoppler((prev) => {
          const next = merge(prev, d.valvasDoppler) as typeof valvasDoppler;
          const valveNames = ["mitral", "tricuspide", "pulmonar", "aortica"];
          valveNames.forEach((valve) => {
            const vel = next[`${valve}Velocidade`];
            const gradKey = `${valve}Gradiente`;
            if (vel && vel.trim() && (!next[gradKey] || !next[gradKey].trim()))
              next[gradKey] = calculateBernoulliGradient(vel);
          });
          return next;
        });
      }
      if (d.valvesData) setValvesData((prev) => merge(prev, d.valvesData) as typeof valvesData);
      if (d.achados?.trim()) setAchados((prev) => prev.trim() ? prev : d.achados!.trim());
      if (d.conclusoes?.trim()) setConclusoes((prev) => prev.trim() ? prev : d.conclusoes!.trim());
      if (d.examInfo?.data?.trim()) setExamInfo((prev) => ({ ...prev, data: d.examInfo!.data!.trim() }));
      if (d.examInfo?.frequenciaCardiaca?.trim()) setExamInfo((prev) => ({ ...prev, frequenciaCardiaca: d.examInfo!.frequenciaCardiaca!.trim() }));
      if (d.patientData) {
        const p = d.patientData;
        const next = {
          nome: p.nome ?? "",
          responsavel: p.responsavel ?? "",
          responsavelTelefone: p.responsavelTelefone ?? "",
          responsavelEmail: p.responsavelEmail ?? "",
          especie: p.especie ?? "",
          raca: p.raca ?? "",
          sexo: p.sexo ?? "",
          idade: p.idade ?? "",
          peso: p.peso ?? "",
        };
        if (Object.values(next).some((v) => v.trim() !== "")) setPatientData((prev) => ({ ...prev, ...next }));
      }
      const parts = [];
      if (d.measurementsData && Object.keys(d.measurementsData).length) parts.push("medidas");
      if (d.examInfo?.data || d.examInfo?.frequenciaCardiaca) parts.push("data/FC");
      if (d.patientData && Object.values(d.patientData).some((v) => v?.trim())) parts.push("paciente");
      if (d.valvasDoppler && Object.keys(d.valvasDoppler).length) parts.push("Doppler");
      if (d.funcaoDiastolica && Object.keys(d.funcaoDiastolica).length) parts.push("função diastólica");
      if (d.ventriculoDireito && Object.keys(d.ventriculoDireito).length) parts.push("VD");
      const summary = parts.length ? parts.join(", ") : "dados";
      toast({
        title: "Dados extraídos",
        description: successCount > 1
          ? `${summary} preenchidos a partir de ${successCount} imagens. Revise e complete o que faltar.`
          : `Medidas e textos detectados foram preenchidos. Revise e complete o que faltar.`,
      });
    } finally {
      setIsExtractingExam(false);
    }
  }, [storedImages, getBase64FromStoredImage, toast]);

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
        classificationsData?: ClassificationsData;
        referencesData?: typeof referencesData;
        funcaoDiastolica?: typeof funcaoDiastolica;
        funcaoSistolica?: typeof funcaoSistolica;
        ventriculoDireito?: RightVentricleData;
        tdiLivre?: typeof tdiLivre;
        tdiSeptal?: typeof tdiSeptal;
        valvasDoppler?: typeof valvasDoppler;
        outros?: typeof outros;
        valvesData?: typeof valvesData;
        achados?: string;
        conclusoes?: string;
        comentariosAdicionais?: string;
        observacoesSecoes?: typeof observacoesSecoes;
        observacoesValvas?: typeof observacoesValvas;
        storedImages?: StoredImageData[];
        selectedImages?: number[];
      };

if (content.patientData) {
        // Merge with database columns for new fields that might not exist in old content
        // Cast to access new columns (owner_phone, owner_email) that may not be in types yet
        const examRecord = data as typeof data & { owner_phone?: string | null; owner_email?: string | null };
        setPatientData({
          ...content.patientData,
          responsavelTelefone: content.patientData.responsavelTelefone || examRecord.owner_phone || "",
          responsavelEmail: content.patientData.responsavelEmail || examRecord.owner_email || "",
        });
      }
      if (content.examInfo) {
        // Merge with defaults to handle new fields (partnerClinicId, partnerVetId, performingVetId)
        setExamInfo(prev => ({
          ...prev,
          ...content.examInfo,
          // Also populate from database columns if not in content
          partnerClinicId: content.examInfo?.partnerClinicId || data.partner_clinic_id || "",
          partnerVetId: content.examInfo?.partnerVetId || data.partner_vet_id || "",
          performingVetId: content.examInfo?.performingVetId || data.performing_vet_id || "",
          performingVetName: content.examInfo?.performingVetName || "",
        }));
      } else if (data.partner_clinic_id || data.partner_vet_id || data.performing_vet_id) {
        // Fallback: populate from database columns even if examInfo doesn't exist
        setExamInfo(prev => ({
          ...prev,
          partnerClinicId: data.partner_clinic_id || "",
          partnerVetId: data.partner_vet_id || "",
          performingVetId: data.performing_vet_id || "",
        }));
      }
      if (content.measurementsData) setMeasurementsData((prev) => ({ ...prev, ...content.measurementsData }));
      if (content.classificationsData) setClassificationsData(content.classificationsData);
      if (content.referencesData) setReferencesData(content.referencesData);
      if (content.funcaoDiastolica) setFuncaoDiastolica(content.funcaoDiastolica);
      if (content.funcaoSistolica) setFuncaoSistolica(content.funcaoSistolica);
      if (content.ventriculoDireito) setVentriculoDireito(content.ventriculoDireito);
      if (content.tdiLivre) setTdiLivre(content.tdiLivre);
      if (content.tdiSeptal) setTdiSeptal(content.tdiSeptal);
      if (content.valvasDoppler) setValvasDoppler(content.valvasDoppler);
      if (content.outros) setOutros(content.outros);
      if (content.valvesData) setValvesData(content.valvesData);
      if (content.achados) setAchados(content.achados);
      if (content.conclusoes) setConclusoes(content.conclusoes);
      if (content.comentariosAdicionais) setComentariosAdicionais(content.comentariosAdicionais);
      if (content.observacoesSecoes) setObservacoesSecoes(content.observacoesSecoes);
      if (content.observacoesValvas) setObservacoesValvas(content.observacoesValvas);
      
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

  // Salvar - força blur para sincronizar inputs com estado antes de salvar
  const handleSave = async () => {
    const activeEl = document.activeElement as HTMLElement | null;
    activeEl?.blur();
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    const success = await saveExam();
    
    // Se salvou com sucesso e tem parceiro vinculado, mostra modal de confirmação de lançamento
    if (success && examInfo.partnerClinicId && currentExamId) {
      const selectedClinic = partnerClinics.find(c => c.id === examInfo.partnerClinicId);
      
      // Buscar preço sugerido do serviço padrão
      const { data: defaultService } = await supabase
        .from("clinic_services")
        .select("price")
        .eq("partner_clinic_id", examInfo.partnerClinicId)
        .eq("is_default", true)
        .maybeSingle();
      
      const suggestedAmount = defaultService?.price || 0;
      
      setPendingBillingData({
        examId: currentExamId,
        clinicName: selectedClinic?.nome || "Clínica Parceira",
        clinicId: examInfo.partnerClinicId,
        suggestedAmount: Number(suggestedAmount),
      });
      setShowBillingModal(true);
    }
  };

  // Callback para confirmar lançamento financeiro
  const handleBillingConfirm = async (amount: number) => {
    if (!pendingBillingData || !user) return;
    
    try {
      // Atualiza o exam_price no exame
      await supabase
        .from("exams")
        .update({ exam_price: amount })
        .eq("id", pendingBillingData.examId);
      
      // Cria transação financeira vinculada ao exame
      await supabase.from("financial_transactions").insert({
        user_id: user.id,
        clinic_id: profile?.clinic_id || null,
        partner_clinic_id: pendingBillingData.clinicId,
        exam_id: pendingBillingData.examId,
        description: `Exame Ecocardiográfico - ${patientData.nome}`,
        transaction_date: examInfo.data || new Date().toISOString().split("T")[0],
        amount: amount,
        status: "a_receber",
      });
      
      toast({
        title: "Lançamento registrado!",
        description: `Cobrança de R$ ${amount.toFixed(2).replace(".", ",")} registrada para ${pendingBillingData.clinicName}`,
      });
    } catch (error) {
      console.error("Erro ao registrar lançamento:", error);
      toast({
        title: "Erro ao registrar",
        description: "Não foi possível registrar o lançamento financeiro.",
        variant: "destructive",
      });
    } finally {
      setShowBillingModal(false);
      setPendingBillingData(null);
    }
  };

  // Callback para pular lançamento
  const handleBillingSkip = () => {
    setShowBillingModal(false);
    setPendingBillingData(null);
  };

  // Função unificada de geração de PDF - usa o mesmo gerador do Histórico
  const generatePdfDocument = useCallback(async (): Promise<jsPDF> => {
    // Monta os dados do exame no formato esperado pelo gerador unificado
    const pdfExamData: PdfExamData = {
      patientData,
      examInfo: {
        data: examInfo.data,
        solicitante: examInfo.solicitante,
        clinica: examInfo.clinica,
        ritmo: examInfo.ritmo,
        frequenciaCardiaca: examInfo.frequenciaCardiaca,
        modoMedicao: examInfo.modoMedicao,
      },
      measurementsData,
      classificationsData,
      referencesData,
      funcaoDiastolica,
      funcaoSistolica,
      ventriculoDireito,
      tdiLivre,
      tdiSeptal,
      valvasDoppler,
      outros,
      valvesData,
      achados,
      conclusoes,
      storedImages,
      selectedImages,
      observacoesSecoes,
      observacoesValvas,
      comentariosAdicionais,
    } as PdfExamData & { comentariosAdicionais?: string };

    // Usa a função unificada de geração de PDF
    return generateExamPdf(pdfExamData, { profile, clinic });
  }, [patientData, examInfo, measurementsData, classificationsData, referencesData, funcaoDiastolica, funcaoSistolica, ventriculoDireito, tdiLivre, tdiSeptal, valvasDoppler, outros, valvesData, achados, conclusoes, storedImages, selectedImages, clinic, profile, observacoesSecoes, observacoesValvas, comentariosAdicionais]);

  // Preview PDF - gera instantaneamente a partir do estado ATUAL da tela
  // IMPORTANTE: Força blur para sincronizar inputs com estado antes de gerar
  const handlePreviewPDF = useCallback(async () => {
    try {
      // Força blur no elemento ativo para garantir que o valor seja sincronizado com o estado
      const activeEl = document.activeElement as HTMLElement | null;
      activeEl?.blur();
      // Aguarda um tick para o React processar o onBlur e atualizar o estado
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Agora gera o PDF com os valores atualizados
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
  }, [generatePdfDocument, toast]);

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
        classificationsData,
        referencesData,
        funcaoDiastolica,
        funcaoSistolica,
        ventriculoDireito,
        tdiLivre,
        tdiSeptal,
        valvasDoppler,
        outros,
        valvesData,
        achados,
        conclusoes,
        comentariosAdicionais,
        observacoesSecoes,
        observacoesValvas,
        calculatedValues,
        storedImages: uploadedImages,
        selectedImages: uploadedImages.map((_, i) => i),
      };

      // Buscar preço do serviço padrão da clínica automaticamente
      let autoExamPrice: number | null = null;
      if (examInfo.partnerClinicId) {
        const { data: defaultService } = await supabase
          .from("clinic_services")
          .select("id, price")
          .eq("partner_clinic_id", examInfo.partnerClinicId)
          .eq("is_default", true)
          .maybeSingle();
        
        if (defaultService) {
          autoExamPrice = defaultService.price;
        } else {
          autoExamPrice = 0; // Fallback: sem serviço padrão, registra como 0
        }
      }

// Obter nome da clínica parceira selecionada para salvar no clinic_name
      const selectedClinicName = examInfo.partnerClinicId 
        ? partnerClinics.find(c => c.id === examInfo.partnerClinicId)?.nome || null
        : null;

      const examData = {
        patient_name: patientData.nome || "Paciente sem nome",
        owner_name: patientData.responsavel || null,
        owner_phone: patientData.responsavelTelefone || null,
        owner_email: patientData.responsavelEmail || null,
        species: patientData.especie || null,
        breed: patientData.raca || null,
        clinic_name: selectedClinicName, // Nome da clínica parceira selecionada
        exam_date: examDate,
        partner_clinic_id: examInfo.partnerClinicId || null,
        partner_vet_id: examInfo.partnerVetId || null,
        performing_vet_id: examInfo.performingVetId || null,
        service_id: null, // Removido da seleção manual
        exam_price: autoExamPrice, // Preço automático do serviço padrão
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

  // Download PDF - gera instantaneamente a partir do estado ATUAL da tela
  // IMPORTANTE: Força blur para sincronizar inputs com estado antes de gerar
  const handleDownloadPDF = useCallback(async () => {
    try {
      // Força blur no elemento ativo para garantir que o valor seja sincronizado com o estado
      const activeEl = document.activeElement as HTMLElement | null;
      activeEl?.blur();
      // Aguarda um tick para o React processar o onBlur e atualizar o estado
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      // Agora gera o PDF com os valores atualizados
      const pdf = await generatePdfDocument();
      
      // Gera nome do arquivo com timestamp para evitar cache do navegador
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const fileName = `Laudo_${(patientData.nome || 'Paciente').replace(/\s+/g, '_')}_${dateStr}_${timeStr}.pdf`;
      
      pdf.save(fileName);

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
  }, [generatePdfDocument, patientData.nome, toast]);

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
          
          <div className="flex gap-3 flex-wrap">
            {storedImages.length > 0 && (
              <Button
                variant="outline"
                onClick={handleFillFromImage}
                disabled={isExtractingExam}
                title="Preencher medidas e textos a partir da primeira imagem (OCR)"
              >
                <Scan className="w-4 h-4 mr-2" />
                {isExtractingExam ? "Analisando..." : "Preencher da imagem"}
              </Button>
            )}
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
              {/* 1. Data do Exame */}
              <div>
                <Label className="label-vitaecor">Data do Exame</Label>
                <Input
                  className="input-vitaecor"
                  type="date"
                  value={examInfo.data}
                  onChange={(e) => setExamInfo({ ...examInfo, data: e.target.value })}
                />
              </div>
              
              {/* 2. Clínica/Hospital - Dropdown com clínicas parceiras */}
              <div>
                <Label className="label-vitaecor">Clínica/Hospital</Label>
                <Select 
                  value={examInfo.partnerClinicId} 
                  onValueChange={handleClinicSelect}
                >
                  <SelectTrigger className="input-vitaecor">
                    <SelectValue placeholder="Selecione a clínica..." />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerClinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {partnerClinics.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhuma clínica cadastrada. <a href="/parceiros" className="text-primary underline">Cadastrar clínicas</a>
                  </p>
                )}
              </div>
              
              {/* 3. Solicitante - Dropdown com veterinários da clínica selecionada */}
              <div>
                <Label className="label-vitaecor">Solicitante</Label>
                <Select 
                  value={examInfo.partnerVetId} 
                  onValueChange={handleVetSelect}
                  disabled={!examInfo.partnerClinicId}
                >
                  <SelectTrigger className="input-vitaecor">
                    <SelectValue placeholder={examInfo.partnerClinicId ? "Selecione o veterinário..." : "Selecione uma clínica primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredVets.map((vet) => (
                      <SelectItem key={vet.id} value={vet.id}>
                        {vet.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {examInfo.partnerClinicId && filteredVets.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum veterinário nesta clínica. <a href="/parceiros" className="text-primary underline">Cadastrar veterinários</a>
                  </p>
                )}
              </div>
              
              {/* 4. Ecocardiografista Responsável - Dropdown com membros da equipe */}
              <div>
                <Label className="label-vitaecor">Ecocardiografista Responsável</Label>
                <Select 
                  value={examInfo.performingVetId} 
                  onValueChange={handlePerformingVetSelect}
                >
                  <SelectTrigger className="input-vitaecor">
                    <SelectValue placeholder="Selecione o ecocardiografista..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.nome}
                        {member.crmv && member.uf_crmv && ` - CRMV ${member.uf_crmv} ${member.crmv}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {teamMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum membro cadastrado. <a href="/configuracoes" className="text-primary underline">Configurar equipe</a>
                  </p>
                )}
              </div>
              
              {/* 5. Ritmo */}
              <div>
                <Label className="label-vitaecor">Ritmo</Label>
                <Input
                  className="input-vitaecor"
                  placeholder="Ex: Sinusal"
                  value={examInfo.ritmo}
                  onChange={(e) => setExamInfo({ ...examInfo, ritmo: e.target.value })}
                />
              </div>
              
              {/* 5. Frequência Cardíaca */}
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
            especie={patientData.especie}
            modoMedicao={examInfo.modoMedicao}
            onModoChange={(modo) => setExamInfo({ ...examInfo, modoMedicao: modo })}
            onChange={setMeasurementsData}
            classifications={classificationsData}
            onClassificationsChange={setClassificationsData}
            references={referencesData}
            onReferencesChange={setReferencesData}
            useAutoReferences={useAutoReferences}
            onAutoReferencesToggle={handleAutoReferencesToggle}
            simpsonValue={funcaoSistolica.simpson}
            onSimpsonChange={(value) => setFuncaoSistolica({...funcaoSistolica, simpson: value})}
            observacoesAEAo={observacoesSecoes.atrioEsquerdoAorta}
            onObservacoesAEAoChange={(value) => setObservacoesSecoes({...observacoesSecoes, atrioEsquerdoAorta: value})}
          />

          {/* Ventrículo Direito - Nova Seção (logo após VE) */}
          <RightVentricleSection 
            data={ventriculoDireito}
            onChange={setVentriculoDireito}
            observacoes={observacoesSecoes.ventriculoDireito}
            onObservacoesChange={(value) => setObservacoesSecoes({...observacoesSecoes, ventriculoDireito: value})}
          />

          {/* Função Sistólica */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Avaliação da Função Sistólica</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <Label className="label-vitaecor">FE Teicholz (%)</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.fracaoEjecaoTeicholz)} />
              </div>
              <div>
                <Label className="label-vitaecor">FE Simpson (%)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoSistolica.simpson)} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, simpson: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">MAPSE (cm)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoSistolica.mapse)} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, mapse: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">EPSS (cm)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoSistolica.epss)} onChange={(e) => setFuncaoSistolica({...funcaoSistolica, epss: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">Fração Encurt. (%)</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.fracaoEncurtamento)} />
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
            
            {/* Observações / Outros Índices */}
            <div className="mt-4">
              <Label className="label-vitaecor">Observações / Outros Índices</Label>
              <Textarea 
                className="input-vitaecor min-h-[60px]"
                placeholder="Observações adicionais sobre a função sistólica..."
                value={observacoesSecoes.funcaoSistolica}
                onChange={(e) => setObservacoesSecoes({...observacoesSecoes, funcaoSistolica: e.target.value})}
              />
            </div>
          </div>

          {/* Função Diastólica */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Função Diastólica do Ventrículo Esquerdo</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label className="label-vitaecor">Onda E (cm/s)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoDiastolica.ondaE)} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, ondaE: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">Onda A (cm/s)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoDiastolica.ondaA)} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, ondaA: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">Relação E/A</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.relacaoEA)} />
              </div>
              <div>
                <Label className="label-vitaecor">Tempo Desac. E (ms)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoDiastolica.tempoDesaceleracao)} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, tempoDesaceleracao: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">TRIV (ms)</Label>
                <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(funcaoDiastolica.triv)} onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, triv: sanitizeDecimalInput(e.target.value)})} />
              </div>
              <div>
                <Label className="label-vitaecor">E/TRIV</Label>
                <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.eTRIV)} />
              </div>
            </div>

            {/* Subtítulo: Doppler Tecidual */}
            <div className="mt-6 mb-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Doppler Tecidual (TDI)</h3>
            </div>

            {/* TDI Campos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TDI Parede Livre */}
              <div className="p-4 bg-secondary rounded-lg">
                <h4 className="font-semibold mb-3">Parede Livre</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="label-vitaecor">s' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiLivre.s)} onChange={(e) => setTdiLivre({...tdiLivre, s: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">e' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiLivre.e)} onChange={(e) => setTdiLivre({...tdiLivre, e: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">a' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiLivre.a)} onChange={(e) => setTdiLivre({...tdiLivre, a: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="label-vitaecor">E/e' Parede Livre</Label>
                  <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.relacaoEePrimeLivre)} />
                </div>
              </div>

              {/* TDI Parede Septal */}
              <div className="p-4 bg-secondary rounded-lg">
                <h4 className="font-semibold mb-3">Parede Septal</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="label-vitaecor">s' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiSeptal.s)} onChange={(e) => setTdiSeptal({...tdiSeptal, s: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">e' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiSeptal.e)} onChange={(e) => setTdiSeptal({...tdiSeptal, e: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">a' (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(tdiSeptal.a)} onChange={(e) => setTdiSeptal({...tdiSeptal, a: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="label-vitaecor">E/e' Parede Septal</Label>
                  <Input className="input-vitaecor bg-muted" readOnly value={formatNumber(calculatedValues.relacaoEePrimeSeptal)} />
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
            
            {/* Padrão Diastólico */}
            <div className="mt-6 pt-4 border-t border-border">
              <Label className="label-vitaecor">Padrão Diastólico</Label>
              <Select 
                value={funcaoDiastolica.padraoDiastolico} 
                onValueChange={handlePadraoDiastolicoChange}
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
                  <SelectItem value="O estudo Doppler mostrou padrão diastólico indeterminado.">
                    Indeterminado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição Diastólica */}
            <div className="mt-4">
              <Label className="label-vitaecor">Descrição (editável)</Label>
              <Textarea 
                className="input-vitaecor min-h-[100px]"
                placeholder="Digite a conclusão sobre a função diastólica..."
                value={funcaoDiastolica.conclusaoDiastolica}
                onChange={(e) => setFuncaoDiastolica({...funcaoDiastolica, conclusaoDiastolica: e.target.value})}
              />
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
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.mitralVelocidade)} onChange={(e) => handleVelocidadeChange('mitral', e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.mitralGradiente)} onChange={(e) => setValvasDoppler({...valvasDoppler, mitralGradiente: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">+dP/dT (mmHg/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.mitralDpDt)} onChange={(e) => setValvasDoppler({...valvasDoppler, mitralDpDt: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor text-xs">Observações da Valva</Label>
                    <Textarea className="input-vitaecor min-h-[50px] text-sm" placeholder="Observações..." value={observacoesValvas.mitral} onChange={(e) => setObservacoesValvas({...observacoesValvas, mitral: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Tricúspide */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Tricúspide</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Retrógrado IT (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.tricuspideVelocidade)} onChange={(e) => handleVelocidadeChange('tricuspide', e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.tricuspideGradiente)} onChange={(e) => setValvasDoppler({...valvasDoppler, tricuspideGradiente: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor text-xs">Observações da Valva</Label>
                    <Textarea className="input-vitaecor min-h-[50px] text-sm" placeholder="Observações..." value={observacoesValvas.tricuspide} onChange={(e) => setObservacoesValvas({...observacoesValvas, tricuspide: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Pulmonar */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Pulmonar</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Transvalvar (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.pulmonarVelocidade)} onChange={(e) => handleVelocidadeChange('pulmonar', e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.pulmonarGradiente)} onChange={(e) => setValvasDoppler({...valvasDoppler, pulmonarGradiente: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor text-xs">Observações da Valva</Label>
                    <Textarea className="input-vitaecor min-h-[50px] text-sm" placeholder="Observações..." value={observacoesValvas.pulmonar} onChange={(e) => setObservacoesValvas({...observacoesValvas, pulmonar: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Valva Aórtica */}
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="font-semibold mb-3">Valva Aórtica</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="label-vitaecor">Vel. Máx. Fluxo Transvalvar (cm/s)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.aorticaVelocidade)} onChange={(e) => handleVelocidadeChange('aortica', e.target.value)} />
                  </div>
                  <div>
                    <Label className="label-vitaecor">Gradiente (mmHg)</Label>
                    <Input className="input-vitaecor" type="text" inputMode="decimal" value={formatDecimalForDisplay(valvasDoppler.aorticaGradiente)} onChange={(e) => setValvasDoppler({...valvasDoppler, aorticaGradiente: sanitizeDecimalInput(e.target.value)})} />
                  </div>
                  <div>
                    <Label className="label-vitaecor text-xs">Observações da Valva</Label>
                    <Textarea className="input-vitaecor min-h-[50px] text-sm" placeholder="Observações..." value={observacoesValvas.aortica} onChange={(e) => setObservacoesValvas({...observacoesValvas, aortica: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Outros */}
          <div className="card-vitaecor animate-fade-in">
            <h2 className="section-title">Outros Achados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="label-vitaecor">Septos</Label>
                <Input className="input-vitaecor" value={outros.septos} onChange={(e) => setOutros({...outros, septos: e.target.value})} />
              </div>
              <div>
                <Label className="label-vitaecor">Pericárdio</Label>
                <Input className="input-vitaecor" value={outros.pericardio} onChange={(e) => setOutros({...outros, pericardio: e.target.value})} />
              </div>
            </div>
            <div className="mt-4">
              <Label className="label-vitaecor">Observações / Outros Índices</Label>
              <Textarea 
                className="input-vitaecor min-h-[60px]"
                placeholder="Observações adicionais sobre pericárdio, septos..."
                value={outros.observacoes}
                onChange={(e) => setOutros({...outros, observacoes: e.target.value})}
              />
            </div>
          </div>
          
          <ValvesSection 
            data={valvesData} 
            onChange={setValvesData}
            achados={achados}
            onTextChange={setAchados}
          />

          {/* Impressão Diagnóstica */}
          <div className="card-vitaecor animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Impressão Diagnóstica</h2>
            </div>
            <div className="flex justify-end mb-2">
              <DiagnosticTemplateSelector
                onSelect={(text) => setConclusoes(prev => prev ? `${prev}\n${text}` : text)}
              />
            </div>
            <Textarea
              className="input-vitaecor min-h-[120px]"
              placeholder="Digite a impressão diagnóstica ou use 'Inserir Modelo'..."
              value={conclusoes}
              onChange={(e) => setConclusoes(e.target.value)}
            />
            <div className="mt-4">
              <Label className="label-vitaecor">Comentários (Adicionais)</Label>
              <Textarea
                className="input-vitaecor min-h-[80px]"
                placeholder="Digite comentários adicionais (aparecerão em negrito no PDF)..."
                value={comentariosAdicionais}
                onChange={(e) => setComentariosAdicionais(e.target.value)}
              />
            </div>
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
      
      {/* Image Gallery Drawer - Floating Button */}
      <ImageGalleryDrawer 
        images={storedImages} 
        selectedIndices={selectedImages}
      />
      
      {/* Billing Confirmation Modal */}
      {pendingBillingData && (
        <BillingConfirmationModal
          open={showBillingModal}
          onOpenChange={setShowBillingModal}
          partnerClinicName={pendingBillingData.clinicName}
          suggestedAmount={pendingBillingData.suggestedAmount}
          onConfirm={handleBillingConfirm}
          onSkip={handleBillingSkip}
        />
      )}
    </Layout>
  );
}
