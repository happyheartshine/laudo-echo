import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { FileUp, Edit, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PatientSection, PatientData } from "@/components/exam/PatientSection";
import { ImageUploadSection } from "@/components/exam/ImageUploadSection";
import { DicomPatientInfo } from "@/lib/dicomUtils";
import { useToast } from "@/hooks/use-toast";

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
  const [mode, setMode] = useState<"select" | "import" | "manual" | null>(null);
  const [patientData, setPatientData] = useState<PatientData>(defaultPatientData);
  const [images, setImages] = useState<File[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());

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
      title: "Dados extraídos do DICOM",
      description: "As informações do paciente foram preenchidas automaticamente.",
    });
  };

  const handleContinueToExam = () => {
    // Store patient data and images in sessionStorage to pass to next page
    sessionStorage.setItem("examPatientData", JSON.stringify(patientData));
    // For images, we need to handle them differently since File objects can't be serialized
    // We'll use a different approach - store image data URLs
    const saveImagesPromises = images.map((file) => {
      return new Promise<{ name: string; type: string; dataUrl: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            type: file.type,
            dataUrl: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(saveImagesPromises).then((imageData) => {
      sessionStorage.setItem("examImages", JSON.stringify(imageData));
      sessionStorage.setItem("examSelectedImages", JSON.stringify([...selectedImages]));
      navigate("/novo-exame/dados-exame");
    });
  };

  // Selection screen
  if (!mode) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Novo Exame Ecocardiográfico</h1>
              <p className="text-muted-foreground">Escolha como deseja iniciar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Import DICOM option */}
            <button
              onClick={() => setMode("import")}
              className="card-vitaecor hover:ring-2 hover:ring-accent transition-all text-left group"
            >
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <FileUp className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Importar DICOM</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Importe arquivos DICOM do ecocardiógrafo. Os dados do paciente serão extraídos automaticamente.
                </p>
              </div>
            </button>

            {/* Manual entry option */}
            <button
              onClick={() => setMode("manual")}
              className="card-vitaecor hover:ring-2 hover:ring-accent transition-all text-left group"
            >
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Edit className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Digitar Manualmente</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Preencha os dados do paciente e do exame manualmente.
                </p>
              </div>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Import DICOM mode
  if (mode === "import") {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMode(null)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Importar Arquivos DICOM</h1>
                <p className="text-muted-foreground">Arraste os arquivos do ecocardiógrafo</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <ImageUploadSection 
              images={images} 
              onImagesChange={setImages}
              selectedImages={selectedImages}
              onSelectedImagesChange={setSelectedImages}
              onDicomMetadataExtracted={handleDicomMetadataExtracted}
            />

            <PatientSection data={patientData} onChange={setPatientData} />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setMode(null)}>
                Voltar
              </Button>
              <Button className="btn-cta" onClick={handleContinueToExam}>
                Continuar
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Manual mode
  if (mode === "manual") {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMode(null)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dados do Paciente</h1>
                <p className="text-muted-foreground">Preencha as informações manualmente</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <PatientSection data={patientData} onChange={setPatientData} />

            <ImageUploadSection 
              images={images} 
              onImagesChange={setImages}
              selectedImages={selectedImages}
              onSelectedImagesChange={setSelectedImages}
              onDicomMetadataExtracted={handleDicomMetadataExtracted}
            />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setMode(null)}>
                Voltar
              </Button>
              <Button className="btn-cta" onClick={handleContinueToExam}>
                Continuar
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}
