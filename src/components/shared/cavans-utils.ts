/**
 * Creates an HTMLImageElement from a given URL.
 * @param url - The image source URL
 * @returns Promise<HTMLImageElement>
 */
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // needed to avoid cross-origin issues on CodeSandbox
    image.src = url;
  });

/**
 * Converts degrees to radians.
 * @param degreeValue - Angle in degrees
 * @returns Angle in radians
 */
export function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the new bounding area of a rotated rectangle.
 * @param width - Width of the rectangle
 * @param height - Height of the rectangle
 * @param rotation - Rotation in degrees
 * @returns Rotated bounding box dimensions
 */
export function rotateSize(width: number, height: number, rotation: number): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation);

  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Crop and rotate an image, returning a blob URL.
 * @param imageSrc - Source image URL
 * @param pixelCrop - Crop area { x, y, width, height }
 * @param rotation - Rotation in degrees
 * @param flip - Flip options { horizontal, vertical }
 * @returns Promise<string | null> - Cropped image as blob URL
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation: number = 0,
  flip: { horizontal: boolean; vertical: boolean } = { horizontal: false, vertical: false },
): Promise<string | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const rotRad = getRadianAngle(rotation);

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // draw rotated image
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    return null;
  }

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Draw the cropped image onto the new canvas
  croppedCtx.drawImage(canvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  // As a blob
  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob((file: Blob | null) => {
      if (file) {
        resolve(URL.createObjectURL(file));
      } else {
        reject(new Error("Failed to create blob from cropped canvas"));
      }
    }, "image/png");
  });
}

/**
 * Rotates an image and returns a blob URL.
 * @param imageSrc - Source image URL
 * @param rotation - Rotation in degrees
 * @returns Promise<string | null> - Rotated image as blob URL
 */
export async function getRotatedImage(imageSrc: string, rotation: number = 0): Promise<string | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const orientationChanged = rotation === 90 || rotation === -90 || rotation === 270 || rotation === -270;
  if (orientationChanged) {
    canvas.width = image.height;
    canvas.height = image.width;
  } else {
    canvas.width = image.width;
    canvas.height = image.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((file: Blob | null) => {
      if (file) {
        resolve(URL.createObjectURL(file));
      } else {
        reject(new Error("Failed to create blob from rotated canvas"));
      }
    }, "image/png");
  });
}
