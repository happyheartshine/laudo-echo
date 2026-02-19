import { ImagePlus, X, Upload, Check, Eye, FolderOpen } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { DicomViewer } from "./DicomViewer";
import { DicomThumbnail } from "./DicomThumbnail";
import { extractDicomMetadata, DicomPatientInfo } from "@/lib/dicomUtils";
import { extractOcrFromImage } from "@/lib/ocrUtils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadSectionProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  selectedImages: Set<number>;
  onSelectedImagesChange: (selected: Set<number>) => void;
  onDicomMetadataExtracted?: (info: DicomPatientInfo) => void;
}

// Helper function to check if a file is DICOM
function checkIsDicomFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  const hasExtension = lower.includes(".");
  return (
    lower.endsWith(".dcm") ||
    file.type === "application/dicom" ||
    file.type === "application/octet-stream" ||
    (!hasExtension && !file.type)
  );
}

// Helper to filter valid image/DICOM files (ignore hidden/system files)
function isValidMediaFile(file: File): boolean {
  const name = file.name;
  // Ignore hidden files (start with .) and system files
  if (name.startsWith(".") || name === "Thumbs.db" || name === "desktop.ini" || name.endsWith(".DS_Store")) {
    return false;
  }
  const lower = name.toLowerCase();
  const hasExtension = lower.includes(".");

  // Standard image types
  if (file.type === "image/jpeg" || file.type === "image/png") {
    return true;
  }

  // DICOM files (with or without extension)
  const isLikelyDicom =
    lower.endsWith(".dcm") ||
    file.type === "application/dicom" ||
    file.type === "application/octet-stream" ||
    (!hasExtension && !file.type);

  return isLikelyDicom;
}

function isStandardImage(file: File): boolean {
  return file.type === "image/jpeg" || file.type === "image/png";
}

export function ImageUploadSection({
  images,
  onImagesChange,
  selectedImages,
  onSelectedImagesChange,
  onDicomMetadataExtracted,
}: ImageUploadSectionProps) {
  const { toast } = useToast();
  const [viewingDicomFile, setViewingDicomFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setIsProcessing(true);

      const validFiles = files.filter(isValidMediaFile);

      if (validFiles.length > 0) {
        const newImages = [...images, ...validFiles];
        onImagesChange(newImages);

        let didExtractDicom = false;

        // Extract metadata from first DICOM file
        for (const file of validFiles) {
          if (checkIsDicomFile(file)) {
            const metadata = await extractDicomMetadata(file);
            if (metadata && onDicomMetadataExtracted) {
              onDicomMetadataExtracted(metadata);
              didExtractDicom = true;
              break;
            }
          }
        }

        // If no DICOM metadata, try OCR on first JPG/PNG
        if (!didExtractDicom && onDicomMetadataExtracted) {
          const firstImage = validFiles.find(
            (f) => isStandardImage(f) && !checkIsDicomFile(f)
          );
          if (firstImage) {
            const ocrResult = await extractOcrFromImage(firstImage);
            if (ocrResult.ok) {
              const ocrData = ocrResult.data;
              const hasData =
                (ocrData.nome && ocrData.nome.trim()) ||
                (ocrData.responsavel && ocrData.responsavel.trim()) ||
                (ocrData.especie && ocrData.especie.trim());
              if (hasData) {
                onDicomMetadataExtracted(ocrData);
                toast({
                  title: "Dados extraídos via OCR",
                  description: "As informações do paciente foram detectadas na imagem.",
                });
              } else {
                toast({
                  title: "OCR sem texto detectado",
                  description: "Nenhum dado de paciente encontrado na imagem. Preencha manualmente.",
                  variant: "destructive",
                });
              }
            } else {
              const errorMessage = "error" in ocrResult ? ocrResult.error : "Não foi possível usar o OCR.";
              toast({
                title: "OCR indisponível",
                description: errorMessage,
                variant: "destructive",
              });
            }
          }
        }
      }

      setIsProcessing(false);
    },
    [images, onImagesChange, onDicomMetadataExtracted, toast]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      const files: File[] = [];

      // Handle folder drops using webkitGetAsEntry
      const traverseFileTree = (item: any, path: string): Promise<void> => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              files.push(file);
              resolve();
            });
          } else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(async (entries: any[]) => {
              for (const entry of entries) {
                await traverseFileTree(entry, path + item.name + "/");
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      };

      if (items) {
        const promises: Promise<void>[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i].webkitGetAsEntry?.();
          if (item) {
            promises.push(traverseFileTree(item, ""));
          }
        }
        await Promise.all(promises);
      }

      // Fallback for regular file drops
      if (files.length === 0) {
        files.push(...Array.from(e.dataTransfer.files));
      }

      await processFiles(files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        await processFiles(Array.from(e.target.files));
        e.target.value = ""; // Reset input
      }
    },
    [processFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      onImagesChange(images.filter((_, i) => i !== index));

      // Update selected images
      const newSelected = new Set<number>();
      selectedImages.forEach((i) => {
        if (i < index) newSelected.add(i);
        else if (i > index) newSelected.add(i - 1);
      });
      onSelectedImagesChange(newSelected);
    },
    [images, onImagesChange, selectedImages, onSelectedImagesChange]
  );

  const toggleImageSelection = useCallback(
    (index: number) => {
      const newSelected = new Set(selectedImages);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      onSelectedImagesChange(newSelected);
    },
    [selectedImages, onSelectedImagesChange]
  );

  const handleViewDicom = (file: File) => {
    setViewingDicomFile(file);
  };

  const closeDicomViewer = () => {
    setViewingDicomFile(null);
  };

  return (
    <div className="card-vitaecor animate-fade-in">
      <h2 className="section-title">
        <ImagePlus className="w-5 h-5 text-accent" />
        Importar Arquivos
      </h2>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={handleFileInput}
        {...({ webkitdirectory: "", directory: "" } as any)}
      />

      {/* Dropzone */}
      <div
        className={`dropzone ${isDragging ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="h-10 w-10 rounded-full border-2 border-border border-t-cta animate-spin mb-3" />
            <p className="text-foreground font-medium">Processando arquivos...</p>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground font-medium mb-2">
              Arraste os arquivos ou pasta aqui
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Formatos aceitos: JPG, PNG, DICOM (.dcm ou sem extensão)
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivos
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => folderInputRef.current?.click()}
                className="gap-2 btn-cta"
              >
                <FolderOpen className="w-4 h-4" />
                Importar Pasta
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Image Gallery */}
      {images.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Imagens Anexadas ({images.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique para selecionar as imagens que irão para o PDF ({selectedImages.size} selecionadas)
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((file, index) => {
              const isSelected = selectedImages.has(index);
              const isDicom = checkIsDicomFile(file);
              const isStandardImage = file.type === "image/jpeg" || file.type === "image/png";

              return (
                <div
                  key={index}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? "ring-4 ring-cta shadow-lg scale-[1.02]"
                      : "ring-1 ring-border hover:ring-2 hover:ring-muted-foreground opacity-60"
                  }`}
                  onClick={() => toggleImageSelection(index)}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-cta rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* Image or DICOM thumbnail */}
                  <div className="w-full h-32">
                    {isStandardImage ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Imagem ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : isDicom ? (
                      <DicomThumbnail file={file} className="w-full h-full" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex flex-col items-center justify-center">
                        <ImagePlus className="w-8 h-8 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground font-medium">Arquivo</span>
                      </div>
                    )}
                  </div>

                  {/* View DICOM button */}
                  {isDicom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDicom(file);
                      }}
                      className="absolute top-2 left-10 p-1.5 bg-primary text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Visualizar DICOM"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* File name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs text-white truncate">{file.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DICOM Viewer Modal */}
      {viewingDicomFile && (
        <DicomViewer
          file={viewingDicomFile}
          onClose={closeDicomViewer}
          onCapture={(jpg) => {
            const newImages = [...images, jpg];
            onImagesChange(newImages);

            const newSelected = new Set(selectedImages);
            newSelected.add(images.length);
            onSelectedImagesChange(newSelected);

            closeDicomViewer();
          }}
        />
      )}
    </div>
  );
}
