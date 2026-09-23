// src/produto/produto.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ProdutoRepository } from './produto.repository';
import {
  CreateProdutoDto,
  UpdateProdutoDto,
  ProdutoResponseDto,
  ProdutoDetailResponseDto,
  FilterProdutoDto,
  UpdatePromocaoDto,
  PromocaoProdutoDto,
  BulkUpdateResponseDto,
} from './dto/produto.dto';
import { slugify } from '../common/utils/slugify';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { UserRepository } from '../users/users.repository';
import { CategoriaProduto } from '@prisma/client';

@Injectable()
export class ProdutoService {
  private readonly logger = new Logger(ProdutoService.name);

  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL = 60000;

  constructor(
    private readonly produtoRepository: ProdutoRepository,
    @Inject(forwardRef(() => NotificacoesService))
    private readonly notificacoesService: NotificacoesService,
    private readonly userRepository: UserRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────
  async create(dto: CreateProdutoDto): Promise<ProdutoResponseDto> {
    if (!dto.nome || dto.nome.trim().length === 0) {
      throw new BadRequestException('Nome do produto é obrigatório');
    }

    const slug = slugify(dto.nome);
    const slugExists = await this.produtoRepository.exists({ slug });
    if (slugExists) {
      throw new BadRequestException('Já existe um produto com este nome');
    }

    const data = {
      nome: dto.nome.trim(),
      slug,
      descricao: dto.descricao?.trim() || '',
      preco: dto.preco,
      imagem: dto.imagem,
      categoria: dto.categoria,
      tag: dto.tag || 'novo',
      estoque: Math.max(0, dto.estoque || 0),
      cores: JSON.stringify(dto.cores || []),
      tamanhos: JSON.stringify(dto.tamanhos || []),
      preco_promocional: dto.preco_promocional ?? null,
      desconto: dto.desconto ?? 0,
      promocao_ativa: dto.promocao_ativa ?? false,
    };

    const produto = await this.produtoRepository.create(data);
    this.logger.log(`Produto criado com ID: ${produto.id}`);

    if (produto.promocao_ativa && produto.desconto > 0) {
      this.notifyPromotion(produto.id, produto.desconto).catch((err) =>
        this.logger.error(`Erro ao notificar promoção: ${err?.message ?? err}`),
      );
    }

    this.notifyClientsAboutNewProduct(produto).catch((err) =>
      this.logger.error(`Erro ao notificar novo produto: ${err?.message ?? err}`),
    );

    return new ProdutoResponseDto(produto);
  }

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────
  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: ProdutoResponseDto[]; total: number; page: number; totalPages: number }> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    const safePage = Math.max(1, page);

    const result = await this.produtoRepository.findAll({
      page: safePage,
      limit: safeLimit,
    });

    return {
      data: result.data.map((p) => new ProdutoResponseDto(p)),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  async findWithFilters(filterDto: FilterProdutoDto) {
    const result = await this.produtoRepository.findWithFilters({
      categoria: filterDto.categoria,
      precoMin: filterDto.precoMin,
      precoMax: filterDto.precoMax,
      emPromocao: filterDto.promocao_ativa,
      tag: filterDto.tag,
      busca: filterDto.busca,
      page: filterDto.page || 1,
      limit: filterDto.limit || 10,
    });

    return {
      data: result.data.map((p) => new ProdutoResponseDto(p)),
      total: result.total,
      page: filterDto.page || 1,
      limit: filterDto.limit || 10,
    };
  }

  async findEmPromocao(): Promise<PromocaoProdutoDto[]> {
    const cacheKey = 'produtos:promocao';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const produtos = await this.produtoRepository.findEmPromocao();
    const response = produtos.map((p) => new PromocaoProdutoDto(p));
    this.setInCache(cacheKey, response, 300000);
    return response;
  }

  async findMaioresDescontos(limit: number = 10): Promise<PromocaoProdutoDto[]> {
    const safeLimit = Math.min(limit, 30);
    const cacheKey = `produtos:maiores-descontos:${safeLimit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const produtos = await this.produtoRepository.findMaioresDescontos(safeLimit);
    const response = produtos.map((p) => new PromocaoProdutoDto(p));
    this.setInCache(cacheKey, response, 300000);
    return response;
  }

  async findById(id: string): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    const cached = this.getFromCache(`produto:${id}`);
    if (cached) return new ProdutoResponseDto(cached);

    const produto = await this.produtoRepository.findById(id);
    if (!produto) throw new NotFoundException('Produto não encontrado');

    this.setInCache(`produto:${id}`, produto);
    return new ProdutoResponseDto(produto);
  }

  async findDetail(id: string): Promise<ProdutoDetailResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    const produto = await this.produtoRepository.findById(id);
    if (!produto) throw new NotFoundException('Produto não encontrado');

    return new ProdutoDetailResponseDto(produto);
  }

  async findBySlug(slug: string): Promise<ProdutoDetailResponseDto> {
    if (!slug || slug.trim().length === 0) {
      throw new BadRequestException('Slug inválido');
    }

    const produto = await this.produtoRepository.findBySlug(slug);
    if (!produto) throw new NotFoundException('Produto não encontrado');

    return new ProdutoDetailResponseDto(produto);
  }

  async findByCategoria(
    categoria: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const categoriaEnum = this.getCategoriaEnum(categoria);
    const safeLimit = Math.min(limit, 50);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const all = await this.produtoRepository.findByCategoria(categoriaEnum);
    const paginated = all.slice(skip, skip + safeLimit);

    return {
      data: paginated.map((p) => new ProdutoResponseDto(p)),
      total: all.length,
      page: safePage,
      totalPages: Math.ceil(all.length / safeLimit),
    };
  }

  async findByTag(tag: string, page: number = 1, limit: number = 20) {
    if (!tag || tag.trim().length === 0) {
      throw new BadRequestException('Tag inválida');
    }

    const safeLimit = Math.min(limit, 50);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const all = await this.produtoRepository.findByTag(tag);
    const paginated = all.slice(skip, skip + safeLimit);

    return {
      data: paginated.map((p) => new ProdutoResponseDto(p)),
      total: all.length,
      page: safePage,
      totalPages: Math.ceil(all.length / safeLimit),
    };
  }

  async findEmEstoque(page: number = 1, limit: number = 50) {
    const safeLimit = Math.min(limit, 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const all = await this.produtoRepository.findEmEstoque();
    const paginated = all.slice(skip, skip + safeLimit);

    return {
      data: paginated.map((p) => new ProdutoResponseDto(p)),
      total: all.length,
      page: safePage,
      totalPages: Math.ceil(all.length / safeLimit),
    };
  }

  async findNovos(dias: number = 30, page: number = 1, limit: number = 20) {
    const safeDias = Math.min(Math.max(1, dias), 90);
    const safeLimit = Math.min(limit, 50);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const all = await this.produtoRepository.findNovos(safeDias);
    const paginated = all.slice(skip, skip + safeLimit);

    return {
      data: paginated.map((p) => new ProdutoResponseDto(p)),
      total: all.length,
      page: safePage,
      totalPages: Math.ceil(all.length / safeLimit),
    };
  }

  async findPopulares(limit: number = 10): Promise<ProdutoResponseDto[]> {
    const safeLimit = Math.min(limit, 30);
    const cacheKey = `produtos:populares:${safeLimit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached.map((p: any) => new ProdutoResponseDto(p));

    const produtos = await this.produtoRepository.findPopulares(safeLimit);
    this.setInCache(cacheKey, produtos, 300000);
    return produtos.map((p) => new ProdutoResponseDto(p));
  }

  async findSimilares(id: string, limit: number = 5): Promise<ProdutoResponseDto[]> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');
    const safeLimit = Math.min(limit, 10);

    const produto = await this.produtoRepository.findById(id);
    if (!produto) throw new NotFoundException('Produto não encontrado');

    const similares = await this.produtoRepository.findSimilares(
      id,
      produto.categoria,
      safeLimit,
    );
    return similares.map((p) => new ProdutoResponseDto(p));
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateProdutoDto): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    const produtoAtual = await this.produtoRepository.findById(id);
    const updateData: any = {};

    if (dto.nome !== undefined && dto.nome.trim()) {
      updateData.nome = dto.nome.trim();
      updateData.slug = slugify(dto.nome);
    }
    if (dto.descricao !== undefined) updateData.descricao = dto.descricao?.trim() || '';
    if (dto.preco !== undefined && dto.preco > 0) updateData.preco = dto.preco;
    if (dto.categoria !== undefined) updateData.categoria = dto.categoria;
    if (dto.tag !== undefined) updateData.tag = dto.tag;
    if (dto.estoque !== undefined) updateData.estoque = Math.max(0, dto.estoque);
    if (dto.cores !== undefined) updateData.cores = JSON.stringify(dto.cores);
    if (dto.tamanhos !== undefined) updateData.tamanhos = JSON.stringify(dto.tamanhos);
    if (dto.imagem !== undefined) updateData.imagem = dto.imagem;
    if (dto.promocao_ativa !== undefined) updateData.promocao_ativa = dto.promocao_ativa;
    if (dto.preco_promocional !== undefined) updateData.preco_promocional = dto.preco_promocional;
    if (dto.desconto !== undefined) updateData.desconto = dto.desconto;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado válido para atualização');
    }

    const updated = await this.produtoRepository.update(id, updateData);

    this.clearCache(`produto:${id}`);
    this.clearCache(`produto:slug:${updated.slug}`);
    this.clearCache('produtos:populares');
    this.clearCache('produtos:promocao');
    this.clearCache('produtos:maiores-descontos');

    const promoFoiAtivada =
      updateData.promocao_ativa === true &&
      !produtoAtual?.promocao_ativa &&
      (updateData.desconto ?? produtoAtual?.desconto ?? 0) > 0;

    if (promoFoiAtivada) {
      const descontoFinal = updateData.desconto ?? produtoAtual?.desconto ?? 0;
      this.notifyPromotion(id, descontoFinal).catch((err) =>
        this.logger.error(`Erro ao notificar promoção: ${err?.message ?? err}`),
      );
    }

    return new ProdutoResponseDto(updated);
  }

  async updatePromocao(
    id: string,
    dto: UpdatePromocaoDto,
  ): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    const produtoAtual = await this.produtoRepository.findById(id);
    const dados: any = {};
    let promocaoFoiAtivada = false;

    if (dto.promocao_ativa !== undefined) {
      dados.promocao_ativa = dto.promocao_ativa;
      if (dto.promocao_ativa === true && !produtoAtual?.promocao_ativa) {
        promocaoFoiAtivada = true;
      }
    }
    if (dto.preco_promocional !== undefined) {
      dados.preco_promocional = dto.preco_promocional;
    }
    if (dto.desconto !== undefined) {
      dados.desconto = dto.desconto;
      if (dto.desconto > 0 && !produtoAtual?.promocao_ativa) {
        promocaoFoiAtivada = true;
      }
    }

    if (Object.keys(dados).length === 0) {
      throw new BadRequestException('Nenhum dado de promoção para atualizar');
    }

    const updated = await this.produtoRepository.updatePromocao(id, dados);

    this.clearCache(`produto:${id}`);
    this.clearCache('produtos:promocao');
    this.clearCache('produtos:maiores-descontos');
    this.clearCache(`produto:slug:${updated.slug}`);

    if (promocaoFoiAtivada) {
      const desconto = dto.desconto ?? produtoAtual?.desconto ?? 0;
      if (desconto > 0) {
        this.notifyPromotion(id, desconto).catch((err) =>
          this.logger.error(`Erro ao notificar promoção: ${err?.message ?? err}`),
        );
      }
    }

    return new ProdutoResponseDto(updated);
  }

  async updateImagem(id: string, imagemUrl: string): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');
    if (!imagemUrl || imagemUrl.trim().length === 0) {
      throw new BadRequestException('URL da imagem é obrigatória');
    }

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    const updated = await this.produtoRepository.update(id, { imagem: imagemUrl });
    this.clearCache(`produto:${id}`);
    this.clearCache(`produto:slug:${updated.slug}`);
    return new ProdutoResponseDto(updated);
  }

  async bulkUpdate(ids: string[], dto: UpdateProdutoDto): Promise<BulkUpdateResponseDto> {
    const response = new BulkUpdateResponseDto();
    response.total = ids.length;

    for (const id of ids) {
      try {
        await this.update(id, dto);
        response.sucesso++;
        response.detalhes.push({ id, status: 'sucesso' });
      } catch (error) {
        response.erro++;
        response.detalhes.push({
          id,
          status: 'erro',
          mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // ESTOQUE
  // ─────────────────────────────────────────────────────────────
  async updateEstoque(id: string, quantidade: number): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');
    if (quantidade < 0) throw new BadRequestException('Quantidade não pode ser negativa');

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    const updated = await this.produtoRepository.updateEstoque(id, quantidade);
    this.clearCache(`produto:${id}`);
    return new ProdutoResponseDto(updated);
  }

  async incrementEstoque(id: string, quantidade: number): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');
    if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser positiva');

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    const updated = await this.produtoRepository.incrementEstoque(id, quantidade);
    this.clearCache(`produto:${id}`);
    return new ProdutoResponseDto(updated);
  }

  async decrementEstoque(id: string, quantidade: number): Promise<ProdutoResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');
    if (quantidade <= 0) throw new BadRequestException('Quantidade deve ser positiva');

    const produto = await this.produtoRepository.findById(id);
    if (!produto) throw new NotFoundException('Produto não encontrado');

    if (produto.estoque < quantidade) {
      throw new BadRequestException(`Estoque insuficiente. Disponível: ${produto.estoque}`);
    }

    const updated = await this.produtoRepository.decrementEstoque(id, quantidade);
    this.clearCache(`produto:${id}`);
    return new ProdutoResponseDto(updated);
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    const exists = await this.produtoRepository.exists({ id });
    if (!exists) throw new NotFoundException('Produto não encontrado');

    await this.produtoRepository.delete(id);

    this.clearCache(`produto:${id}`);
    this.clearCache('produtos:populares');
    this.clearCache('produtos:promocao');
    this.clearCache('produtos:maiores-descontos');
  }

  // ─────────────────────────────────────────────────────────────
  // AUXILIARES
  // ─────────────────────────────────────────────────────────────
  async getCoresDisponiveis(): Promise<string[]> {
    const cached = this.getFromCache('cores:disponiveis');
    if (cached) return cached;

    const cores = await this.produtoRepository.getCoresDisponiveis();
    this.setInCache('cores:disponiveis', cores, 3600000);
    return cores;
  }

  async getTamanhosDisponiveis(): Promise<string[]> {
    const cached = this.getFromCache('tamanhos:disponiveis');
    if (cached) return cached;

    const tamanhos = await this.produtoRepository.getTamanhosDisponiveis();
    this.setInCache('tamanhos:disponiveis', tamanhos, 3600000);
    return tamanhos;
  }

  async notifyPromotion(
    produtoId: string,
    desconto: number,
    mensagemPersonalizada?: string,
  ): Promise<void> {
    if (!this.isValidId(produtoId)) {
      throw new BadRequestException('ID do produto inválido');
    }
    if (desconto <= 0 || desconto > 100) {
      throw new BadRequestException('Desconto deve estar entre 1 e 100');
    }

    const produto = await this.produtoRepository.findById(produtoId);
    if (!produto) throw new NotFoundException('Produto não encontrado');
    if (!produto.promocao_ativa) {
      this.logger.warn(`Produto ${produtoId} não está com promoção ativa`);
      return;
    }

    const clients = await this.userRepository.findAllClients();
    if (clients.length === 0) return;

    const limitedClients = clients.slice(0, 50);
    const valorOriginal = Number(produto.preco);
    const valorComDesconto = valorOriginal * (1 - desconto / 100);
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valorComDesconto);

    const mensagem =
      mensagemPersonalizada ||
      `🔥 ${produto.nome} com ${desconto}% OFF! Por apenas ${valorFormatado}. Aproveite!`;

    await Promise.allSettled(
      limitedClients.map((client) =>
        this.notificacoesService
          .create(client.id, {
            tipo: 'promo',
            titulo: `🔥 ${desconto}% DE DESCONTO!`,
            mensagem,
          })
          .catch((err) =>
            this.logger.error(`Erro notificar ${client.id}: ${err?.message ?? err}`),
          ),
      ),
    );

    this.logger.log(`Notificados ${limitedClients.length} clientes sobre promoção`);
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────────────────────────
  private getCategoriaEnum(categoria: string): CategoriaProduto {
    const normalized = categoria.toLowerCase().trim();
    const validValues = Object.values(CategoriaProduto);

    // Bate direto (case-insensitive) com valor do enum
    const match = validValues.find((v) => v.toLowerCase() === normalized);
    if (match) return match;

    throw new BadRequestException(
      `Categoria inválida: "${categoria}". Valores aceitos: ${validValues.join(', ')}`,
    );
  }

  private isValidId(id: string): boolean {
    return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    this.cache.delete(key);
    return null;
  }

  private setInCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  private clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.cache.delete(key);
      }
    }
  }

  private async notifyClientsAboutNewProduct(produto: any): Promise<void> {
    try {
      const clients = await this.userRepository.findAllClients();
      const limitedClients = clients.slice(0, 30);
      if (limitedClients.length === 0) return;

      const valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(produto.preco));

      await Promise.allSettled(
        limitedClients.map((client) =>
          this.notificacoesService
            .create(client.id, {
              tipo: 'limitado',
              titulo: '✨ NOVIDADE NA COLEÇÃO!',
              mensagem: `Novo produto: ${produto.nome} - ${valorFormatado}`,
            })
            .catch((err) =>
              this.logger.error(`Erro notificar: ${err?.message ?? err}`),
            ),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Erro ao notificar clientes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}