import { useEffect, useRef, useState } from "react";
import { App, AppOptions, ViewConfig } from "dwv";
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DicomViewerProps {
  file: File;
  onClose: () => void;
}

export function DicomViewer({ file, onClose }: DicomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dwvApp, setDwvApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new App();
    
    // Create view config using the class constructor
    const viewConfig = new ViewConfig('dwv-layer-group');
    const viewConfigs: { [key: string]: ViewConfig[] } = { '*': [viewConfig] };
    const options = new AppOptions(viewConfigs);
    
    app.init(options);

    app.addEventListener('loadstart', () => {
      setIsLoading(true);
      setError(null);
    });

    app.addEventListener('loadend', () => {
      setIsLoading(false);
    });

    app.addEventListener('error', (event: { error: Error }) => {
      setIsLoading(false);
      setError(event.error?.message || 'Erro ao carregar arquivo DICOM');
    });

    setDwvApp(app);

    // Load the DICOM file
    app.loadFiles([file]);

    return () => {
      app.reset();
    };
  }, [file]);

  const handleZoomIn = () => {
    if (dwvApp) {
      dwvApp.setTool('ZoomAndPan');
    }
  };

  const handleZoomOut = () => {
    if (dwvApp) {
      dwvApp.setTool('ZoomAndPan');
    }
  };

  const handleReset = () => {
    if (dwvApp) {
      dwvApp.resetDisplay();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            Visualizador DICOM - {file.name}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Resetar"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Viewer Container */}
        <div 
          ref={containerRef}
          className="flex-1 min-h-[500px] bg-black relative overflow-hidden"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cta mx-auto mb-4"></div>
                <p>Carregando arquivo DICOM...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-destructive">
                <p className="font-medium mb-2">Erro ao carregar DICOM</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          <div id="dwv-layer-group" className="w-full h-full" />
        </div>

        {/* Footer with instructions */}
        <div className="p-3 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            <Maximize2 className="w-3 h-3 inline mr-1" />
            Use o scroll do mouse para zoom • Arraste para mover a imagem • 
            Shift + Arraste para ajustar brilho/contraste
          </p>
        </div>
      </div>
    </div>
  );
}
