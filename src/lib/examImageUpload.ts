import { supabase } from "@/integrations/supabase/client";

export interface StoredImageData {
  name: string;
  type: string;
  dataUrl: string;
  storageUrl?: string; // URL pública do Storage
}

/**
 * Converte um dataURL para um Blob
 */
function dataURLToBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Faz upload de uma imagem para o Supabase Storage
 */
export async function uploadExamImage(
  image: StoredImageData,
  examId: string,
  index: number
): Promise<string | null> {
  try {
    // Se já tem URL do storage, retorna ela
    if (image.storageUrl && !image.storageUrl.startsWith('blob:') && !image.storageUrl.startsWith('data:')) {
      return image.storageUrl;
    }

    const blob = dataURLToBlob(image.dataUrl);
    const extension = image.type.split('/')[1] || 'jpg';
    const fileName = `${examId}/${index}-${Date.now()}.${extension}`;

    const { data, error } = await supabase.storage
      .from('exam-images')
      .upload(fileName, blob, {
        contentType: image.type,
        upsert: true,
      });

    if (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      return null;
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from('exam-images')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Erro ao processar imagem para upload:', error);
    return null;
  }
}

/**
 * Faz upload de todas as imagens do exame
 */
export async function uploadAllExamImages(
  images: StoredImageData[],
  examId: string
): Promise<StoredImageData[]> {
  const uploadedImages: StoredImageData[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const storageUrl = await uploadExamImage(image, examId, i);
    
    uploadedImages.push({
      ...image,
      storageUrl: storageUrl || image.dataUrl, // Fallback para dataUrl se upload falhar
      dataUrl: storageUrl || image.dataUrl, // Atualizar dataUrl com a URL do storage
    });
  }

  return uploadedImages;
}

/**
 * Converte URL remota para base64 (para uso no PDF)
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    // Se já é base64, retorna direto
    if (url.startsWith('data:')) {
      return url;
    }

    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao converter imagem para base64:', error);
    return url; // Retorna URL original se falhar
  }
}

/**
 * Deleta todas as imagens de um exame do Storage
 */
export async function deleteExamImages(examId: string): Promise<void> {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from('exam-images')
      .list(examId);

    if (listError) {
      console.error('Erro ao listar imagens para deletar:', listError);
      return;
    }

    if (files && files.length > 0) {
      const filePaths = files.map(file => `${examId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('exam-images')
        .remove(filePaths);

      if (deleteError) {
        console.error('Erro ao deletar imagens:', deleteError);
      }
    }
  } catch (error) {
    console.error('Erro ao deletar imagens do exame:', error);
  }
}
