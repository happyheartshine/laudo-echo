import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PatientSection, PatientData } from "@/components/exam/PatientSection";
import { ImageUploadSection } from "@/components/exam/ImageUploadSection";
import { DicomPatientInfo } from "@/lib/dicomUtils";
import { useToast } from "@/hooks/use-toast";
import { saveExamImages } from "@/lib/imageStorage";
import { dicomFileToJpegDataUrl } from "@/lib/dicomRender";

const defaultPatientData: PatientData = {
  nome: "",
  responsavel: "",
  responsavelTelefone: "",
  responsavelEmail: "",
  especie: "",
  raca: "",
  sexo: "",
  idade: "",
  peso: "",
};

export default function NovoExame() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [patientData, setPatientData] = useState<PatientData>(defaultPatientData);
  const [images, setImages] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const handleDicomMetadataExtracted = (info: DicomPatientInfo) => {
    setPatientData((prev) => ({
      nome: prev.nome || info.nome,
      responsavel: prev.responsavel || info.responsavel,
      responsavelTelefone: prev.responsavelTelefone || "",
      responsavelEmail: prev.responsavelEmail || "",
      especie: prev.especie || info.especie,
      raca: prev.raca || info.raca,
      sexo: prev.sexo || info.sexo,
      idade: prev.idade || info.idade,
      peso: prev.peso || info.peso,
    }));
    toast({
      title: "Dados extraídos do arquivo",
      description: "As informações do paciente foram preenchidas automaticamente.",
    });
  };

  // Validação de campos obrigatórios
  const validateRequiredFields = (): boolean => {
    const missingFields: string[] = [];
    
    if (!patientData.nome.trim()) missingFields.push("Nome do Paciente");
    if (!patientData.especie) missingFields.push("Espécie");
    if (!patientData.peso.trim()) missingFields.push("Peso");
    if (!patientData.responsavel.trim()) missingFields.push("Responsável");
    
    if (missingFields.length > 0) {
      toast({
        title: "Dados obrigatórios",
        description: "Preencha os dados obrigatórios (Nome, Espécie, Peso, Proprietário) para iniciar o exame.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Verifica se pode avançar (todos os campos obrigatórios preenchidos)
  const canProceed = 
    patientData.nome.trim() !== "" &&
    patientData.especie !== "" &&
    patientData.peso.trim() !== "" &&
    patientData.responsavel.trim() !== "";

  const handleContinueToExam = async () => {
    // Validar campos obrigatórios antes de continuar
    if (!validateRequiredFields()) {
      return;
    }

    setIsSaving(true);

    const isLikelyDicom = (file: File) => {
      const lower = file.name.toLowerCase();
      const hasExtension = lower.includes(".");
      return (
        lower.endsWith(".dcm") ||
        file.type === "application/dicom" ||
        file.type === "application/octet-stream" ||
        (!hasExtension && !file.type)
      );
    };

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

    try {
      // Store patient data in sessionStorage (small data)
      sessionStorage.setItem("examPatientData", JSON.stringify(patientData));

      // Filter only selected images
      const selectedImageFiles = images.filter((_, index) => selectedImages.has(index));

      if (selectedImageFiles.length === 0) {
        // No images selected, save empty and navigate
        await saveExamImages([]);
        navigate("/novo-exame/dados-exame");
        return;
      }

      // Convert selected files to *real image* data URLs.
      // - Standard JPG/PNG: FileReader
      // - DICOM: render to canvas and export as JPEG base64
      const imageData = await Promise.all(
        selectedImageFiles.map(async (file) => {
          if (isLikelyDicom(file)) {
            const jpgDataUrl = await dicomFileToJpegDataUrl(file, 0.8);
            const baseName = file.name.replace(/\.[^/.]+$/, "") || "dicom";
            return {
              name: `${baseName}.jpg`,
              type: "image/jpeg",
              dataUrl: jpgDataUrl,
            };
          }

          const dataUrl = await readFileAsDataUrl(file);
          return {
            name: file.name,
            type: file.type || (dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg"),
            dataUrl,
          };
        })
      );

      // Use IndexedDB for large image data (no quota limits like sessionStorage)
      await saveExamImages(imageData);

      navigate("/novo-exame/dados-exame");
    } catch (error) {
      console.error("Error saving images:", error);
      toast({
        title: "Erro ao salvar imagens",
        description: "Ocorreu um erro ao processar as imagens. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
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
              <p className="text-muted-foreground">Importe arquivos ou digite os dados manualmente</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Image/File Import Section */}
          <ImageUploadSection 
            images={images} 
            onImagesChange={setImages}
            selectedImages={selectedImages}
            onSelectedImagesChange={setSelectedImages}
            onDicomMetadataExtracted={handleDicomMetadataExtracted}
          />

          {/* Patient Data Section */}
          <PatientSection data={patientData} onChange={setPatientData} />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              Cancelar
            </Button>
            <Button 
              className="btn-cta" 
              onClick={handleContinueToExam} 
              disabled={isSaving || !canProceed}
              title={!canProceed ? "Preencha todos os campos obrigatórios" : ""}
            >
              {isSaving ? "Salvando..." : "Continuar"}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
