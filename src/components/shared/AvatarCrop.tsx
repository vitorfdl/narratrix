import React, { useCallback, useEffect, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { LuCheck, LuPencil, LuRefreshCw, LuRotateCcw, LuUpload, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface AvatarCropProps {
  onCropComplete: (croppedImage: string) => void;
  existingImage?: string | null;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  uploadPlaceholderClassName?: string;
  placeholder?: React.ReactNode;
  hideUploadText?: boolean;
}

export const AvatarCrop: React.FC<AvatarCropProps> = ({
  onCropComplete,
  existingImage = null,
  aspectRatio = 1,
  cropShape = "round",
  minZoom = 1,
  maxZoom = 3,
  className = "",
  uploadPlaceholderClassName = "",
  placeholder,
  hideUploadText = false,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(existingImage);
  const [displayImage, setDisplayImage] = useState<string | null>(existingImage);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setDisplayImage(existingImage);
  }, [existingImage]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl);
      setIsModalOpen(true);
      resetCrop();
    }
  };

  // const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
  //   e.preventDefault();
  //   setIsDragging(true);
  // };

  // const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
  //   e.preventDefault();
  //   setIsDragging(false);
  // };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    // setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        const imageDataUrl = await readFile(file);
        setImageSrc(imageDataUrl);
        setIsModalOpen(true);
        resetCrop();
      }
    }
  };

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onRotationChange = (rotation: number) => {
    setRotation(rotation);
  };

  const onCropCompleteHandler = useCallback((_: any, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!imageSrc || !croppedAreaPixels) {
        return;
      }

      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      setDisplayImage(croppedImage);
      onCropComplete(croppedImage);
      setIsModalOpen(false);
      setIsLoading(false);
    } catch (e) {
      console.error("Error generating cropped image:", e);
      setIsLoading(false);
    }
  }, [imageSrc, croppedAreaPixels, rotation, onCropComplete]);

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const startEditMode = () => {
    // Create a file input element and trigger it
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        const file = target.files[0];
        const imageDataUrl = await readFile(file);
        setImageSrc(imageDataUrl);
        setIsModalOpen(true);
        resetCrop();
      }
    };
    fileInput.click();
  };

  const cancelEdit = () => {
    setIsModalOpen(false);
    resetCrop();
  };

  const renderUploadArea = () => (
    <label
      className={`flex flex-col items-center justify-center p-4 border-2 border-dashed transition-all h-full w-full
        border-muted-foreground/20 hover:border-primary hover:bg-primary/5 ${uploadPlaceholderClassName}
        cursor-pointer`}
      style={cropShape === "round" ? { borderRadius: "var(--avatar-border-radius, 50%)" } : { borderRadius: "0.375rem" }}
      // onDragOver={handleDragOver}
      // onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {placeholder || (
        <div className="text-xs text-muted-foreground text-center hover:text-primary transition-colors flex flex-col items-center justify-center">
          <LuUpload className="h-8 w-8 text-muted-foreground mb-2" />
          {!hideUploadText && "Upload"}
        </div>
      )}
      <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
    </label>
  );

  const renderImageWithEditButton = () => (
    <div
      className="relative group h-full w-full flex items-center justify-center"
      // onDragOver={handleDragOver}
      // onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="h-full w-full overflow-hidden flex items-center justify-center"
        style={cropShape === "round" ? { borderRadius: "var(--avatar-border-radius, 50%)" } : { borderRadius: "0.375rem" }}
      >
        <img src={displayImage || ""} alt="Avatar" className={`object-cover ${cropShape === "round" ? "h-full w-full" : "max-h-full max-w-full"}`} />
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
        <Button variant="secondary" size="icon" onClick={startEditMode} className="h-9 w-9 rounded-full" type="button">
          <LuPencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderCropperModal = () => (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative h-64 w-full rounded-lg overflow-hidden border border-border">
            <Cropper
              image={imageSrc || ""}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              cropShape={cropShape}
              onCropChange={onCropChange}
              onCropComplete={onCropCompleteHandler}
              onZoomChange={onZoomChange}
              onRotationChange={onRotationChange}
              minZoom={minZoom}
              maxZoom={maxZoom}
              showGrid={true}
              restrictPosition={false}
              objectFit="contain"
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Zoom</label>
                <span className="text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
              </div>
              <Slider value={[zoom]} min={minZoom} max={maxZoom} step={0.1} onValueChange={(value) => setZoom(value[0])} />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Rotation</label>
                <span className="text-xs text-muted-foreground">{rotation}°</span>
              </div>
              <Slider value={[rotation]} min={0} max={360} step={90} onValueChange={(value) => setRotation(value[0])} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit} className="flex-1" type="button">
                <LuX className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={resetCrop} className="flex-1" type="button">
                <LuRefreshCw className="h-4 w-4 mr-1.5" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRotation((prev) => (prev + 90) % 360)} className="flex-1" type="button">
                <LuRotateCcw className="h-4 w-4 mr-1.5" /> Rotate
              </Button>
              <Button onClick={showCroppedImage} disabled={isLoading || !croppedAreaPixels} className="flex-1" type="button">
                <LuCheck className="h-4 w-4 mr-1.5" /> Apply
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <div className={`${className}`}>{displayImage ? renderImageWithEditButton() : renderUploadArea()}</div>
      {renderCropperModal()}
    </>
  );
};

const readFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(new Error(`Failed to read file: ${file.name}`)));
    reader.readAsDataURL(file);
  });
};

// Helper function to create cropped image
const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
};

const getCroppedImg = async (imageSrc: string, pixelCrop: Area, rotation = 0): Promise<string> => {
  try {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return imageSrc;
    }

    // Calculate bounding box of the rotated image
    const rotRad = getRadianAngle(rotation);

    // Calculate dimensions of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

    // Set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // Move the canvas context to center so we can rotate around it
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // Draw the rotated image
    ctx.drawImage(image, 0, 0);

    // Create a new canvas for the final cropped image
    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");

    if (!croppedCtx) {
      return imageSrc;
    }

    // Set the size to the desired output
    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    // Draw the cropped image onto the new canvas
    croppedCtx.drawImage(
      canvas,
      // Source position and dimensions
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      // Destination position and dimensions
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    // Return as data URL
    return croppedCanvas.toDataURL("image/jpeg");
  } catch (error) {
    console.error("Error cropping image:", error);
    return imageSrc;
  }
};

// Utility functions for rotation calculations
const getRadianAngle = (degreeAngle: number): number => {
  return (degreeAngle * Math.PI) / 180;
};

const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = getRadianAngle(rotation);

  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};
