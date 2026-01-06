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
 * Verifica se uma URL é temporária (blob: ou data:)
 */
function isTemporaryUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

/**
 * Verifica se uma URL é do Supabase Storage
 */
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase') && url.includes('storage');
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
    // Se já tem URL do storage permanente, retorna ela
    if (image.storageUrl && isSupabaseStorageUrl(image.storageUrl)) {
      console.log(`Imagem ${index} já possui URL do Storage:`, image.storageUrl);
      return image.storageUrl;
    }

    // Se dataUrl já é uma URL do Storage, retorna ela
    if (image.dataUrl && isSupabaseStorageUrl(image.dataUrl)) {
      console.log(`Imagem ${index} dataUrl já é URL do Storage:`, image.dataUrl);
      return image.dataUrl;
    }

    // Precisa de dataUrl válido para fazer upload
    if (!image.dataUrl || !image.dataUrl.startsWith('data:')) {
      console.error(`Imagem ${index} não possui dataUrl válido para upload`);
      return null;
    }

    console.log(`Fazendo upload da imagem ${index} para o Storage...`);
    
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

    console.log(`Upload concluído. URL pública:`, publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Erro ao processar imagem para upload:', error);
    return null;
  }
}

/**
 * Faz upload de todas as imagens do exame e retorna array com URLs atualizadas
 * IMPORTANTE: Aguarda todos os uploads e substitui URLs temporárias por URLs permanentes
 */
export async function uploadAllExamImages(
  images: StoredImageData[],
  examId: string
): Promise<StoredImageData[]> {
  console.log(`Iniciando upload de ${images.length} imagens para o exame ${examId}`);
  
  const uploadedImages: StoredImageData[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    
    // Faz upload e aguarda resultado
    const storageUrl = await uploadExamImage(image, examId, i);
    
    if (storageUrl) {
      // Substitui URLs temporárias pela URL permanente do Storage
      uploadedImages.push({
        name: image.name,
        type: image.type,
        dataUrl: storageUrl, // Agora dataUrl contém a URL permanente
        storageUrl: storageUrl,
      });
      console.log(`Imagem ${i} processada com sucesso: ${storageUrl}`);
    } else {
      // Se falhar, mantém a imagem original (pode causar problemas de persistência)
      console.warn(`Falha no upload da imagem ${i}, mantendo dados originais`);
      uploadedImages.push(image);
    }
  }

  console.log(`Upload concluído. ${uploadedImages.length} imagens processadas.`);
  return uploadedImages;
}

/**
 * Converte URL remota para base64 (para uso no PDF)
 * IMPORTANTE: Necessário para contornar problemas de CORS no jspdf
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    // Se já é base64, retorna direto
    if (url.startsWith('data:')) {
      return url;
    }

    // Se é URL blob temporária, não consegue converter
    if (url.startsWith('blob:')) {
      console.warn('URL blob detectada, não é possível converter para base64');
      return url;
    }

    console.log('Convertendo URL para base64:', url);
    
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('Conversão para base64 concluída');
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('Erro ao ler blob:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Erro ao converter imagem para base64:', error);
    // Em caso de erro de CORS, tenta via proxy ou retorna URL original
    return url;
  }
}

/**
 * Converte múltiplas URLs para base64 em paralelo
 */
export async function convertImagesToBase64(images: StoredImageData[]): Promise<StoredImageData[]> {
  console.log(`Convertendo ${images.length} imagens para base64...`);
  
  const convertedImages = await Promise.all(
    images.map(async (image) => {
      const urlToConvert = image.storageUrl || image.dataUrl;
      const base64 = await imageUrlToBase64(urlToConvert);
      return {
        ...image,
        dataUrl: base64,
      };
    })
  );
  
  console.log('Conversão para base64 concluída');
  return convertedImages;
}

/**
 * Deleta todas as imagens de um exame do Storage
 */
export async function deleteExamImages(examId: string): Promise<void> {
  try {
    console.log(`Deletando imagens do exame ${examId}...`);
    
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
      } else {
        console.log(`${files.length} imagens deletadas com sucesso`);
      }
    } else {
      console.log('Nenhuma imagem encontrada para deletar');
    }
  } catch (error) {
    console.error('Erro ao deletar imagens do exame:', error);
  }
}
