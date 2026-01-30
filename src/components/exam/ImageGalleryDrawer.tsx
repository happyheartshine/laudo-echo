import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Images, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StoredImageData {
  name: string;
  type: string;
  dataUrl: string;
}

interface ImageGalleryDrawerProps {
  images: StoredImageData[];
  selectedIndices: number[];
}

export function ImageGalleryDrawer({ images, selectedIndices }: ImageGalleryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<number | null>(null);
  
  // Get only selected images
  const selectedImages = images.filter((_, index) => selectedIndices.includes(index));
  
  if (selectedImages.length === 0) {
    return null;
  }

  const handlePrevImage = () => {
    if (zoomedImage === null) return;
    setZoomedImage(zoomedImage > 0 ? zoomedImage - 1 : selectedImages.length - 1);
  };

  const handleNextImage = () => {
    if (zoomedImage === null) return;
    setZoomedImage(zoomedImage < selectedImages.length - 1 ? zoomedImage + 1 : 0);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="fixed right-6 bottom-24 z-40 shadow-lg bg-background hover:bg-accent gap-2"
          >
            <Images className="w-4 h-4" />
            <span className="hidden sm:inline">Ver Imagens</span>
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
              {selectedImages.length}
            </span>
          </Button>
        </SheetTrigger>
        
        <SheetContent 
          side="right" 
          className="w-[350px] sm:w-[400px] p-0"
        >
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Images className="w-5 h-5 text-primary" />
              Galeria de Imagens
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedImages.length} selecionada{selectedImages.length > 1 ? "s" : ""})
              </span>
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-4 grid grid-cols-2 gap-3">
              {selectedImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setZoomedImage(index)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name || `Imagem ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Zoom Dialog */}
      <Dialog open={zoomedImage !== null} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          {selectedImages.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          
          {zoomedImage !== null && selectedImages[zoomedImage] && (
            <div className="flex items-center justify-center w-full h-full min-h-[60vh]">
              <img
                src={selectedImages[zoomedImage].dataUrl}
                alt={selectedImages[zoomedImage].name || `Imagem ${zoomedImage + 1}`}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </div>
          )}
          
          {zoomedImage !== null && selectedImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
              {zoomedImage + 1} / {selectedImages.length}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
