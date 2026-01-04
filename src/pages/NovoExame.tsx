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

const defaultPatientData: PatientData = {
  nome: "",
  responsavel: "",
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

  const handleContinueToExam = async () => {
    setIsSaving(true);
    
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

      // Convert selected images to data URLs
      const imageDataPromises = selectedImageFiles.map((file) => {
        return new Promise<{ name: string; type: string; dataUrl: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              name: file.name,
              type: file.type || "application/octet-stream",
              dataUrl: e.target?.result as string,
            });
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      });

      const imageData = await Promise.all(imageDataPromises);
      
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
            <Button className="btn-cta" onClick={handleContinueToExam} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Continuar"}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
