// src/config/supabase.config.ts
import { registerAs } from '@nestjs/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente ${key} é obrigatória`);
  }
  return value;
}

function validateUrl(key: string, value: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(`Variável ${key} não é uma URL válida: ${value}`);
  }
  return value;
}

export default registerAs('supabase', () => {
  const url = validateUrl('SUPABASE_URL', required('SUPABASE_URL'));

  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10);
  if (isNaN(maxSize) || maxSize <= 0) {
    throw new Error('MAX_FILE_SIZE inválido (deve ser inteiro positivo em bytes)');
  }

  const allowedTypes = (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,image/jpg')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (allowedTypes.length === 0) {
    throw new Error('ALLOWED_MIME_TYPES não pode estar vazio');
  }

  return {
    url,
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    buckets: {
      produtos: process.env.SUPABASE_BUCKET_PRODUTOS || 'produtos-imagens',
    },
    upload: {
      maxSize,
      allowedTypes,
    },
  };
});