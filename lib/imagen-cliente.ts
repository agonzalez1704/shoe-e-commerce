// Fotos de celular pesan 3-6 MB y las server actions aceptan 1 MB: se reducen
// en el navegador a 1600px de lado mayor y JPEG antes de subirlas.
export async function reducirImagen(file: File, lado = 1600): Promise<File> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
