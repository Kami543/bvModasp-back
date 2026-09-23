// src/upload/utils/file-validator.util.ts
import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface FileValidationOptions {
  maxSize: number;
  allowedMimeTypes: string[];
  minSize?: number;
}

const SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (checa 'WEBP' abaixo)
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function detectMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;

  for (const [mime, signatures] of Object.entries(SIGNATURES)) {
    for (const sig of signatures) {
      if (buffer.length < sig.length) continue;
      const match = sig.every((byte, i) => buffer[i] === byte);
      if (!match) continue;

      // WebP: precisa ter "WEBP" nos bytes 8-11
      if (mime === 'image/webp') {
        const webpTag = buffer.subarray(8, 12).toString('ascii');
        if (webpTag !== 'WEBP') continue;
      }

      return mime;
    }
  }
  return null;
}

export class FileValidator {
  /**
   * Valida o arquivo recebido:
   * - Tamanho (min/max)
   * - Mimetype real via magic bytes
   * - Mimetype declarado bate com o real
   */
  static validateFile(
    file: Express.Multer.File | undefined,
    options: FileValidationOptions,
  ): void {
    if (!options) {
      throw new BadRequestException('Opções de validação ausentes');
    }
    if (typeof options.maxSize !== 'number' || options.maxSize <= 0) {
      throw new Error('maxSize inválido (use número positivo em bytes)');
    }
    if (!Array.isArray(options.allowedMimeTypes) || options.allowedMimeTypes.length === 0) {
      throw new Error('allowedMimeTypes não pode estar vazio');
    }
    if (options.minSize && options.minSize > options.maxSize) {
      throw new Error('minSize não pode ser maior que maxSize');
    }

    if (!file) {
      throw new BadRequestException('Nenhum arquivo fornecido');
    }

    if (options.minSize && file.size < options.minSize) {
      throw new BadRequestException(
        `Arquivo muito pequeno. Mínimo: ${(options.minSize / 1024).toFixed(1)}KB`,
      );
    }

    if (file.size > options.maxSize) {
      throw new BadRequestException(
        `Arquivo muito grande. Máximo: ${(options.maxSize / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Arquivo vazio');
    }

    const realMime = detectMimeType(file.buffer);
    if (!realMime) {
      throw new BadRequestException('Arquivo não é uma imagem válida');
    }

    if (!options.allowedMimeTypes.includes(realMime)) {
      throw new BadRequestException(
        `Tipo real do arquivo não permitido (detectado: ${realMime})`,
      );
    }

    if (file.mimetype && file.mimetype !== realMime) {
      throw new BadRequestException(
        `Content-Type declarado (${file.mimetype}) não bate com o conteúdo real (${realMime})`,
      );
    }
  }

  /**
   * Gera nome de arquivo seguro a partir do mimetype REAL.
   * Ignora o nome original — evita extensões arbitrárias tipo ".exe".
   */
  static generateSafeFileName(mimeType: string): string {
    const ext = MIME_TO_EXT[mimeType];
    if (!ext) {
      throw new BadRequestException(
        `Mimetype sem extensão mapeada: ${mimeType}`,
      );
    }
    const timestamp = Date.now();
    const random = randomBytes(8).toString('hex');
    return `${timestamp}-${random}.${ext}`;
  }
}