import { useState, useRef, useEffect } from "react";
import { motion, useDragControls, PanInfo } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Images, X, ZoomIn, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<number | null>(null);
  const [position, setPosition] = useState({ x: 20, y: 200 });
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  
  // Get only selected images
  const selectedImages = images.filter((_, index) => selectedIndices.includes(index));
  
  // Save position to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("imageGalleryPosition");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newPos = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y,
    };
    
    // Clamp to viewport
    const clampedX = Math.max(0, Math.min(window.innerWidth - 300, newPos.x));
    const clampedY = Math.max(80, Math.min(window.innerHeight - 100, newPos.y));
    
    setPosition({ x: clampedX, y: clampedY });
    localStorage.setItem("imageGalleryPosition", JSON.stringify({ x: clampedX, y: clampedY }));
  };
  
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

  const handleButtonClick = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Invisible constraints container */}
      <div 
        ref={constraintsRef} 
        className="fixed inset-0 pointer-events-none z-40"
        style={{ top: 64 }} // Below header
      />
      
      {/* Draggable floating widget */}
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        initial={{ x: position.x, y: position.y }}
        animate={{ x: position.x, y: position.y }}
        className="fixed z-50 select-none"
        style={{ touchAction: "none" }}
      >
        {/* Collapsed state - just the button */}
        {!isExpanded && (
          <motion.button
            onClick={handleButtonClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-background border border-border hover:bg-accent transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <Images className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Imagens</span>
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
              {selectedImages.length}
            </span>
          </motion.button>
        )}

        {/* Expanded state - gallery panel */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-background border border-border rounded-lg shadow-xl overflow-hidden"
            style={{ width: 280 }}
          >
            {/* Header - draggable area */}
            <div 
              className="flex items-center justify-between p-3 border-b bg-muted/50 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <Images className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Galeria</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedImages.length})
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Thumbnails grid */}
            <ScrollArea className="h-[300px]">
              <div className="p-2 grid grid-cols-2 gap-2">
                {selectedImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setZoomedImage(index)}
                    className="group relative aspect-square rounded-md overflow-hidden border border-border bg-muted hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <img
                      src={image.dataUrl}
                      alt={image.name || `Imagem ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/60 text-white px-1 rounded">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </motion.div>

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
