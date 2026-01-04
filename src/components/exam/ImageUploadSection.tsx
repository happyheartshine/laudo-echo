import { ImagePlus, X, Upload } from "lucide-react";
import { useState, useCallback } from "react";

interface ImageUploadSectionProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
}

export function ImageUploadSection({ images, onImagesChange }: ImageUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'image/jpeg' || file.type === 'image/png'
    );
    
    onImagesChange([...images, ...files]);
  }, [images, onImagesChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(
        file => file.type === 'image/jpeg' || file.type === 'image/png'
      );
      onImagesChange([...images, ...files]);
    }
  }, [images, onImagesChange]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, onImagesChange]);

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.3s' }}>
      <h2 className="section-title">
        <ImagePlus className="w-5 h-5 text-accent" />
        Imagens do Ecocardiograma
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
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileInput}
        />
        
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-foreground font-medium mb-2">
          Arraste as imagens aqui ou clique para selecionar
        </p>
        <p className="text-sm text-muted-foreground">
          Formatos aceitos: JPG, PNG
        </p>
      </div>

      {/* Preview das Imagens */}
      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Imagens Anexadas ({images.length})
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Imagem ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="mt-2 text-xs text-muted-foreground truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
