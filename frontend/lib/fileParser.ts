/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up PDF.js worker
// Using unpkg as it mirrors npm exactly and is more reliable for specific versions
const PDFJS_VERSION = '5.7.284';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export async function parseFile(file: File): Promise<string> {
  const fileName = file.name;
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

  try {
    if (extension === 'pdf') {
      return await parsePDF(file);
    } else if (extension === 'docx') {
      return await parseDocx(file);
    } else if (extension === 'txt') {
      return await parseText(file);
    } else if (extension === 'doc') {
      throw new Error('El formato .doc (Word antiguo) no es compatible. Por favor conviértalo a .pdf o .docx.');
    } else if (!extension) {
      throw new Error('El archivo no tiene una extensión válida (.pdf, .docx, .txt).');
    } else {
      // Intentar leer como texto si no es una de las anteriores pero tiene alguna extensión
      return await parseText(file);
    }
  } catch (error: any) {
    console.error(`Error fundamental parseando ${fileName}:`, error);
    if (error.message.includes('Worker')) {
      throw new Error(`Error en el motor de lectura de PDF. Intente de nuevo o use formato .txt / .docx.`);
    }
    throw new Error(error.message || `No se pudo extraer texto de ${fileName}`);
  }
}

async function parsePDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useSystemFonts: true
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }

    if (!fullText.trim()) {
      throw new Error('El PDF parece estar vacío o es una imagen (escaneado). Solo se admite PDF con texto seleccionable.');
    }

    return fullText;
  } catch (error: any) {
    console.error('Error específico en PDF:', error);
    if (error.name === 'PasswordException') {
      throw new Error('El archivo PDF está protegido con contraseña.');
    }
    if (error.message?.includes('worker') || error.message?.includes('Worker')) {
      throw new Error('Error al configurar el motor de lectura de PDF (Worker).');
    }
    throw new Error('No se pudo extraer el texto del PDF. Asegúrese de que el archivo no sea una imagen escaneada o esté dañado.');
  }
}

async function parseDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (!result.value.trim()) {
      throw new Error('El archivo Word está vacío.');
    }
    
    return result.value;
  } catch (error: any) {
    throw new Error('Error al leer el archivo Word (.docx).');
  }
}

async function parseText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (!text.trim()) {
        reject(new Error('El archivo de texto está vacío.'));
      } else {
        resolve(text);
      }
    };
    reader.onerror = () => reject(new Error('Error de lectura de archivo.'));
    reader.readAsText(file);
  });
}
