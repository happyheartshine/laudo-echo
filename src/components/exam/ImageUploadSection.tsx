import { ImagePlus, X, Upload, Check, Eye } from "lucide-react";
import { useState, useCallback } from "react";
import { DicomViewer } from "./DicomViewer";
import { extractDicomMetadata, DicomPatientInfo } from "@/lib/dicomUtils";

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
  const hasExtension = lower.includes('.');
  return (
    lower.endsWith('.dcm') ||
    file.type === 'application/dicom' ||
    file.type === 'application/octet-stream' ||
    (!hasExtension && !file.type)
  );
}

export function ImageUploadSection({ 
  images, 
  onImagesChange, 
  selectedImages, 
  onSelectedImagesChange,
  onDicomMetadataExtracted
}: ImageUploadSectionProps) {
  const [viewingDicomFile, setViewingDicomFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isValidFile = (file: File) => {
    const lower = file.name.toLowerCase();
    const hasExtension = lower.includes('.');

    // Alguns ecocardiógrafos exportam DICOM sem extensão e sem MIME type.
    const isLikelyDicom =
      lower.endsWith('.dcm') ||
      file.type === 'application/dicom' ||
      file.type === 'application/octet-stream' ||
      (!hasExtension && !file.type);

    return file.type === 'image/jpeg' || file.type === 'image/png' || isLikelyDicom;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(isValidFile);
    
    if (files.length > 0) {
      const newImages = [...images, ...files];
      onImagesChange(newImages);
      
      // Auto-select newly added images
      const newSelected = new Set(selectedImages);
      files.forEach((_, i) => newSelected.add(images.length + i));
      onSelectedImagesChange(newSelected);

      // Extract metadata from first DICOM file
      for (const file of files) {
        if (checkIsDicomFile(file)) {
          const metadata = await extractDicomMetadata(file);
          if (metadata && onDicomMetadataExtracted) {
            onDicomMetadataExtracted(metadata);
            break; // Only extract from first DICOM
          }
        }
      }
    }
  }, [images, onImagesChange, selectedImages, onSelectedImagesChange, onDicomMetadataExtracted]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(isValidFile);
      
      if (files.length > 0) {
        const newImages = [...images, ...files];
        onImagesChange(newImages);
        
        // Auto-select newly added images
        const newSelected = new Set(selectedImages);
        files.forEach((_, i) => newSelected.add(images.length + i));
        onSelectedImagesChange(newSelected);

        // Extract metadata from first DICOM file
        for (const file of files) {
          if (checkIsDicomFile(file)) {
            const metadata = await extractDicomMetadata(file);
            if (metadata && onDicomMetadataExtracted) {
              onDicomMetadataExtracted(metadata);
              break; // Only extract from first DICOM
            }
          }
        }
      }
    }
  }, [images, onImagesChange, selectedImages, onSelectedImagesChange, onDicomMetadataExtracted]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
    
    // Update selected images
    const newSelected = new Set<number>();
    selectedImages.forEach((i) => {
      if (i < index) newSelected.add(i);
      else if (i > index) newSelected.add(i - 1);
    });
    onSelectedImagesChange(newSelected);
  }, [images, onImagesChange, selectedImages, onSelectedImagesChange]);

  const toggleImageSelection = useCallback((index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    onSelectedImagesChange(newSelected);
  }, [selectedImages, onSelectedImagesChange]);

  const getImagePreview = (file: File): string | null => {
    if (file.type === 'image/jpeg' || file.type === 'image/png') {
      return URL.createObjectURL(file);
    }
    // For DICOM files, return null (no preview available)
    return null;
  };

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
        Imagens do Exame (DICOM/JPG)
      </h2>

      {/* Dropzone */}
      <div
        className={`dropzone ${isDragging ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="*/*"
          className="hidden"
          onChange={handleFileInput}
        />
        
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-foreground font-medium mb-2">
          Arraste as imagens aqui ou clique para selecionar
        </p>
        <p className="text-sm text-muted-foreground">
          Formatos aceitos: JPG, PNG, DICOM (.dcm ou sem extensão)
        </p>
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
              const preview = getImagePreview(file);
              const isDicom = checkIsDicomFile(file);
              
              return (
                <div 
                  key={index} 
                  className={`relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                    isSelected 
                      ? 'ring-4 ring-cta shadow-lg scale-[1.02]' 
                      : 'ring-1 ring-border hover:ring-2 hover:ring-muted-foreground'
                  }`}
                  onClick={() => toggleImageSelection(index)}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-cta rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  
                  {/* Image or placeholder */}
                  {preview ? (
                    <img
                      src={preview}
                      alt={`Imagem ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-secondary flex flex-col items-center justify-center">
                      <ImagePlus className="w-8 h-8 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground font-medium">
                        {isDicom ? 'DICOM' : 'Arquivo'}
                      </span>
                    </div>
                  )}

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
                    <p className="text-xs text-white truncate">
                      {file.name}
                    </p>
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
