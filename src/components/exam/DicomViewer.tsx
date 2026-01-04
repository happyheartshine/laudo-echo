import { useEffect, useState } from "react";
import { App, AppOptions } from "dwv";
import { X, RotateCw, Maximize2, Hand, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DicomViewerProps {
  file: File;
  onClose: () => void;
}

export function DicomViewer({ file, onClose }: DicomViewerProps) {
  const [dwvApp, setDwvApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("ZoomAndPan");

  useEffect(() => {
    console.log('DicomViewer: Starting to load file', file.name, file.type, file.size);
    
    // Create app
    const app = new App();
    
    // Initialize app with config - using unknown assertion since the library types are overly strict
    // The official dwv-react example uses this exact structure
    const options = {
      dataViewConfigs: { '*': [{ divId: 'dwv-layer-group' }] },
      tools: {
        ZoomAndPan: {},
        WindowLevel: {},
        Scroll: {}
      }
    } as unknown as AppOptions;
    
    console.log('DicomViewer: Initializing app with options', options);
    app.init(options);

    // Load progress event
    app.addEventListener('loadprogress', (event: any) => {
      console.log('DicomViewer: Load progress', event);
      const percent = Math.round((event.loaded / event.total) * 100);
      setLoadProgress(percent);
    });

    app.addEventListener('loadstart', (event: any) => {
      console.log('DicomViewer: Load start', event);
      setIsLoading(true);
      setError(null);
      setLoadProgress(0);
    });

    app.addEventListener('loadend', (event: any) => {
      console.log('DicomViewer: Load end', event);
      setIsLoading(false);
      setLoadProgress(100);
      // Set default tool after load
      app.setTool('ZoomAndPan');
    });

    app.addEventListener('error', (event: any) => {
      console.error('DicomViewer: Error event', event);
      setIsLoading(false);
      const errorMsg = event.error?.message || event.message || 'Erro ao carregar arquivo DICOM';
      console.error('DicomViewer: Error message', errorMsg);
      setError(errorMsg);
    });

    app.addEventListener('loaditem', (event: any) => {
      console.log('DicomViewer: Load item', event);
    });

    setDwvApp(app);

    // Load the DICOM file
    console.log('DicomViewer: Calling loadFiles with', [file]);
    try {
      app.loadFiles([file]);
    } catch (e) {
      console.error('DicomViewer: Exception during loadFiles', e);
      setError(`Erro ao iniciar carregamento: ${e}`);
    }

    return () => {
      console.log('DicomViewer: Cleanup');
      app.reset();
    };
  }, [file]);

  const handleToolChange = (tool: string) => {
    if (dwvApp) {
      dwvApp.setTool(tool);
      setSelectedTool(tool);
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
          <h3 className="font-semibold text-foreground truncate max-w-md">
            Visualizador DICOM - {file.name}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant={selectedTool === "ZoomAndPan" ? "default" : "ghost"}
              size="icon"
              onClick={() => handleToolChange("ZoomAndPan")}
              title="Zoom e Pan"
            >
              <Hand className="w-4 h-4" />
            </Button>
            <Button
              variant={selectedTool === "WindowLevel" ? "default" : "ghost"}
              size="icon"
              onClick={() => handleToolChange("WindowLevel")}
              title="Brilho/Contraste"
            >
              <Sun className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Resetar visualização"
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

        {/* Progress bar */}
        {isLoading && loadProgress > 0 && (
          <div className="h-1 bg-muted">
            <div 
              className="h-full bg-cta transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        )}

        {/* Viewer Container */}
        <div className="flex-1 min-h-[500px] bg-black relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cta mx-auto mb-4"></div>
                <p>Carregando arquivo DICOM...</p>
                {loadProgress > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">{loadProgress}%</p>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center p-6 bg-card rounded-lg max-w-md">
                <p className="font-medium mb-2 text-destructive">Erro ao carregar DICOM</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}

          <div id="dwv-layer-group" className="layerGroup w-full h-full" />
        </div>

        {/* Footer with instructions */}
        <div className="p-3 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground text-center">
            <Maximize2 className="w-3 h-3 inline mr-1" />
            {selectedTool === "ZoomAndPan" 
              ? "Arraste para mover • Scroll para zoom"
              : "Arraste para ajustar brilho/contraste"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
