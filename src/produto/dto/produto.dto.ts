// src/produto/dto/produto.dto.ts
import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
  IsUrl,
  IsBoolean,
  IsEnum,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CategoriaProduto } from '@prisma/client';

export class CreateProdutoDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @MinLength(3, { message: 'Nome deve ter no mínimo 3 caracteres' })
  nome: string;

  @IsString({ message: 'Descrição deve ser uma string' })
  @IsOptional()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço deve ter até 2 casas decimais' })
  @IsPositive({ message: 'Preço deve ser positivo' })
  @Type(() => Number)
  preco: number;

  @IsEnum(CategoriaProduto, { message: 'Categoria inválida' })
  categoria: CategoriaProduto;

  @IsString({ message: 'Tag deve ser uma string' })
  @IsOptional()
  tag?: string;

  @IsNumber({}, { message: 'Estoque deve ser um número' })
  @Min(0, { message: 'Estoque não pode ser negativo' })
  @Type(() => Number)
  estoque: number;

  @IsArray({ message: 'Cores deve ser um array' })
  @ArrayMinSize(1, { message: 'Deve ter no mínimo 1 cor' })
  @IsString({ each: true })
  cores: string[];

  @IsArray({ message: 'Tamanhos deve ser um array' })
  @ArrayMinSize(1, { message: 'Deve ter no mínimo 1 tamanho' })
  @IsString({ each: true })
  tamanhos: string[];

  @IsUrl({}, { message: 'URL da imagem deve ser válida' })
  imagem: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Preço promocional deve ter até 2 casas decimais' })
  @IsPositive({ message: 'Preço promocional deve ser positivo' })
  @IsOptional()
  @Type(() => Number)
  preco_promocional?: number;

  @IsNumber({}, { message: 'Desconto deve ser um número' })
  @Min(0, { message: 'Desconto não pode ser negativo' })
  @Max(100, { message: 'Desconto não pode ultrapassar 100%' })
  @IsOptional()
  @Type(() => Number)
  desconto?: number;

  @IsBoolean({ message: 'promocao_ativa deve ser booleano' })
  @IsOptional()
  promocao_ativa?: boolean;
}

export class UpdateProdutoDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  preco?: number;

  @IsEnum(CategoriaProduto)
  @IsOptional()
  categoria?: CategoriaProduto;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  estoque?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsOptional()
  cores?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsOptional()
  tamanhos?: string[];

  @IsUrl({}, { message: 'URL da imagem deve ser válida' })
  @IsOptional()
  imagem?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  preco_promocional?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  desconto?: number;

  @IsBoolean()
  @IsOptional()
  promocao_ativa?: boolean;
}

export class UpdatePromocaoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  preco_promocional?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  desconto?: number;

  @IsBoolean()
  @IsOptional()
  promocao_ativa?: boolean;
}

export class ProdutoResponseDto {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  preco: number;
  categoria: string;
  tag: string;
  estoque: number;
  cores: string[];
  tamanhos: string[];
  imagem: string;
  createdAt: Date;
  updatedAt: Date;
  preco_promocional?: number;
  desconto: number;
  promocao_ativa: boolean;

  constructor(produto: any) {
    this.id = produto.id;
    this.nome = produto.nome;
    this.slug = produto.slug;
    this.descricao = produto.descricao || '';
    this.preco = Number(produto.preco);
    this.categoria = produto.categoria;
    this.tag = produto.tag || '';
    this.estoque = produto.estoque;
    this.cores = this.parseJsonArray(produto.cores);
    this.tamanhos = this.parseJsonArray(produto.tamanhos);
    this.imagem = produto.imagem || '';
    this.preco_promocional = produto.preco_promocional
      ? Number(produto.preco_promocional)
      : undefined;
    this.desconto = produto.desconto || 0;
    this.promocao_ativa = produto.promocao_ativa || false;
    this.createdAt = produto.createdAt;
    this.updatedAt = produto.updatedAt;
  }

  private parseJsonArray(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

export class PromocaoProdutoDto {
  id: string;
  nome: string;
  slug: string;
  preco: number;
  preco_promocional?: number;
  desconto: number;
  promocao_ativa: boolean;
  imagem: string;
  categoria: string;

  constructor(produto: any) {
    this.id = produto.id;
    this.nome = produto.nome;
    this.slug = produto.slug;
    this.preco = Number(produto.preco);
    this.preco_promocional = produto.preco_promocional
      ? Number(produto.preco_promocional)
      : undefined;
    this.desconto = produto.desconto || 0;
    this.promocao_ativa = produto.promocao_ativa || false;
    this.imagem = produto.imagem || '';
    this.categoria = produto.categoria;
  }
}

export class ProdutoDetailResponseDto extends ProdutoResponseDto {
  emEstoque: boolean;

  constructor(produto: any) {
    super(produto);
    this.emEstoque = this.estoque > 0;
  }
}

export class FilterProdutoDto {
  @IsOptional()
  @IsEnum(CategoriaProduto)
  categoria?: CategoriaProduto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMax?: number;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cores?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tamanhos?: string[];

  @IsOptional()
  @IsBoolean()
  promocao_ativa?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sort?: 'nome' | 'preco' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}

export class UpdateEstoqueDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantidade: number;

  @IsString()
  operacao: 'adicionar' | 'remover' | 'definir';
}

export class BulkUpdateResponseDto {
  total: number;
  sucesso: number;
  erro: number;
  detalhes: Array<{
    id: string;
    status: 'sucesso' | 'erro';
    mensagem?: string;
  }>;

  constructor() {
    this.total = 0;
    this.sucesso = 0;
    this.erro = 0;
    this.detalhes = [];
  }
}