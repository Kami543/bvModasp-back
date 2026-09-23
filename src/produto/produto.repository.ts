// src/produto/produto.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Produto, CategoriaProduto } from '@prisma/client';
import { BaseRepository } from '../common/utils/baseRepository';

@Injectable()
export class ProdutoRepository extends BaseRepository<Produto> {
  private readonly logger = new Logger(ProdutoRepository.name);

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected get model() {
    return this.prisma.produto;
  }

  async findBySlug(slug: string): Promise<Produto | null> {
    return this.model.findFirst({ where: { slug } });
  }

  async findByCategoria(categoria: CategoriaProduto): Promise<Produto[]> {
    return this.model.findMany({
      where: { categoria },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByTag(tag: string): Promise<Produto[]> {
    return this.model.findMany({
      where: { tag },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEmEstoque(): Promise<Produto[]> {
    return this.model.findMany({
      where: { estoque: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findComEstoqueBaixo(limite: number = 5): Promise<Produto[]> {
    return this.model.findMany({
      where: { estoque: { lte: limite } },
      orderBy: { estoque: 'asc' },
    });
  }

  async findNovos(dias: number = 30): Promise<Produto[]> {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    return this.model.findMany({
      where: { createdAt: { gte: dataLimite } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPopulares(limit: number = 10): Promise<Produto[]> {
    return this.model.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSimilares(
    produtoId: string,
    categoria: CategoriaProduto,
    limit: number = 5,
  ): Promise<Produto[]> {
    return this.model.findMany({
      where: {
        AND: [{ id: { not: produtoId } }, { categoria }],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEmPromocao(): Promise<Produto[]> {
    return this.model.findMany({
      where: { promocao_ativa: true, desconto: { gt: 0 } },
      orderBy: { desconto: 'desc' },
    });
  }

  async findMaioresDescontos(limit: number = 10): Promise<Produto[]> {
    return this.model.findMany({
      where: { promocao_ativa: true, desconto: { gt: 0 } },
      orderBy: { desconto: 'desc' },
      take: limit,
    });
  }

  async updateEstoque(produtoId: string, quantidade: number): Promise<Produto> {
    return this.model.update({
      where: { id: produtoId },
      data: { estoque: quantidade },
    });
  }

  async incrementEstoque(produtoId: string, quantidade: number): Promise<Produto> {
    return this.model.update({
      where: { id: produtoId },
      data: { estoque: { increment: quantidade } },
    });
  }

  async decrementEstoque(produtoId: string, quantidade: number): Promise<Produto> {
    return this.model.update({
      where: { id: produtoId },
      data: { estoque: { decrement: quantidade } },
    });
  }

  async getCoresDisponiveis(): Promise<string[]> {
    const produtos = await this.model.findMany({ select: { cores: true } });
    const set = new Set<string>();

    for (const produto of produtos) {
      const cores = this.parseJsonArray(produto.cores);
      for (const cor of cores) {
        if (cor && typeof cor === 'string') set.add(cor.trim());
      }
    }
    return Array.from(set).sort();
  }

  async getTamanhosDisponiveis(): Promise<string[]> {
    const produtos = await this.model.findMany({ select: { tamanhos: true } });
    const set = new Set<string>();

    for (const produto of produtos) {
      const tamanhos = this.parseJsonArray(produto.tamanhos);
      for (const t of tamanhos) {
        if (t && typeof t === 'string') set.add(t.trim());
      }
    }
    return Array.from(set).sort();
  }

  async updateImagem(produtoId: string, imagemUrl: string): Promise<Produto> {
    return this.model.update({
      where: { id: produtoId },
      data: { imagem: imagemUrl },
    });
  }

  async updatePromocao(
    produtoId: string,
    dados: {
      preco_promocional?: number | null;
      desconto?: number;
      promocao_ativa?: boolean;
    },
  ): Promise<Produto> {
    return this.model.update({
      where: { id: produtoId },
      data: dados,
    });
  }

  async findWithFilters(filters: {
    categoria?: CategoriaProduto;
    precoMin?: number;
    precoMax?: number;
    emPromocao?: boolean;
    tag?: string;
    busca?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Produto[]; total: number }> {
    const { categoria, precoMin, precoMax, emPromocao, tag, busca, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (categoria) where.categoria = categoria;

    if (precoMin !== undefined || precoMax !== undefined) {
      where.preco = {};
      if (precoMin !== undefined) where.preco.gte = precoMin;
      if (precoMax !== undefined) where.preco.lte = precoMax;
    }

    if (emPromocao) {
      where.promocao_ativa = true;
      where.desconto = { gt: 0 };
    }

    if (tag) {
      where.tag = { equals: tag, mode: 'insensitive' };
    }

    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: 'insensitive' } },
        { descricao: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.model.count({ where }),
    ]);

    return { data, total };
  }

  // ─── HELPER ───
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