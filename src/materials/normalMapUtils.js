// src/materials/normalMapUtils.js
// DX normals require green channel inversion when using GL convention.

export function shouldFlipNormalGreen(url) {
  if (typeof url !== "string") return false;
  return url.includes("normal_dx") || url.includes("normal-dx");
}

export function invertNormalMapGreen(texture) {
  if (!texture || typeof document === "undefined") return texture;
  const image = texture.image;
  if (!image || !image.width || !image.height) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 1] = 255 - data[i + 1];
  }
  ctx.putImageData(imageData, 0, 0);

  texture.image = canvas;
  texture.needsUpdate = true;
  return texture;
}

export function applyNormalMapConvention(texture, url) {
  if (shouldFlipNormalGreen(url)) {
    return invertNormalMapGreen(texture);
  }
  return texture;
}
