// src/common/utils/baseRepository.ts
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BaseEntity {
  id: string | number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: any;
  maxLimit?: number;
  where?: any;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export abstract class BaseRepository<T extends BaseEntity> {
  protected readonly DEFAULT_MAX_LIMIT = 50;
  protected readonly DEFAULT_LIMIT = 10;

  constructor(protected readonly prisma: PrismaService) {}

  protected abstract get model(): any;

  async create(data: any): Promise<T> {
    try {
      return (await this.model.create({ data })) as T;
    } catch (error) {
      this.handlePrismaError(error, 'criar registro');
    }
  }

  async findById(id: string | number): Promise<T | null> {
    try {
      return (await this.model.findUnique({ where: { id } })) as T | null;
    } catch (error) {
      this.handlePrismaError(error, 'buscar registro por ID');
    }
  }

  async findAll(options?: PaginationOptions): Promise<PaginationResult<T>> {
    try {
      const maxLimit = options?.maxLimit || this.DEFAULT_MAX_LIMIT;
      const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, maxLimit);
      const page = Math.max(options?.page || 1, 1);
      const skip = (page - 1) * limit;
      const where = options?.where || {};

      const [data, total] = await Promise.all([
        this.model.findMany({
          where,
          skip,
          take: limit,
          orderBy: options?.orderBy || { createdAt: 'desc' },
        }),
        this.model.count({ where }),
      ]);

      return {
        data: data as T[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handlePrismaError(error, 'buscar registros');
    }
  }

  async findMany(where?: any, options?: PaginationOptions): Promise<PaginationResult<T>> {
    try {
      const maxLimit = options?.maxLimit || this.DEFAULT_MAX_LIMIT;
      const limit = Math.min(options?.limit || this.DEFAULT_LIMIT, maxLimit);
      const page = Math.max(options?.page || 1, 1);
      const skip = (page - 1) * limit;
      const filter = where || {};

      const [data, total] = await Promise.all([
        this.model.findMany({
          where: filter,
          skip,
          take: limit,
          orderBy: options?.orderBy || { createdAt: 'desc' },
        }),
        this.model.count({ where: filter }),
      ]);

      return {
        data: data as T[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handlePrismaError(error, 'buscar registros filtrados');
    }
  }

  async findFirst(where: any): Promise<T | null> {
    try {
      return (await this.model.findFirst({ where })) as T | null;
    } catch (error) {
      this.handlePrismaError(error, 'buscar o primeiro registro');
    }
  }

  async update(id: string | number, data: any): Promise<T> {
    try {
      return (await this.model.update({ where: { id }, data })) as T;
    } catch (error) {
      this.handlePrismaError(error, 'atualizar registro');
    }
  }

  async delete(id: string | number): Promise<T> {
    try {
      return (await this.model.delete({ where: { id } })) as T;
    } catch (error) {
      this.handlePrismaError(error, 'deletar registro');
    }
  }

  async deleteMany(where: any, maxDeletions = 1000): Promise<{ count: number }> {
    try {
      if (!where || Object.keys(where).length === 0) {
        throw new BadRequestException('Delete em massa requer filtros específicos');
      }

      const count = await this.model.count({ where });
      if (count > maxDeletions) {
        throw new BadRequestException(
          `Delete em massa limitado a ${maxDeletions} registros. Encontrados: ${count}`,
        );
      }

      const result = await this.model.deleteMany({ where });
      return { count: result.count };
    } catch (error) {
      this.handlePrismaError(error, 'deletar registros');
    }
  }

  async softDelete(id: string | number): Promise<T> {
    try {
      return (await this.model.update({
        where: { id },
        data: { deletedAt: new Date() },
      })) as T;
    } catch (error) {
      this.handlePrismaError(error, 'deletar registro (soft delete)');
    }
  }

  async softDeleteMany(where: any, maxDeletions = 1000): Promise<{ count: number }> {
    try {
      if (!where || Object.keys(where).length === 0) {
        throw new BadRequestException('Soft delete em massa requer filtros específicos');
      }

      const count = await this.model.count({ where });
      if (count > maxDeletions) {
        throw new BadRequestException(
          `Soft delete limitado a ${maxDeletions} registros. Encontrados: ${count}`,
        );
      }

      const result = await this.model.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return { count: result.count };
    } catch (error) {
      this.handlePrismaError(error, 'deletar registros (soft delete)');
    }
  }

  async upsert(where: any, create: any, update: any): Promise<T> {
    try {
      return (await this.model.upsert({ where, create, update })) as T;
    } catch (error) {
      this.handlePrismaError(error, 'criar ou atualizar registro');
    }
  }

  async exists(where: any): Promise<boolean> {
    try {
      const count = await this.model.count({ where });
      return count > 0;
    } catch (error) {
      this.handlePrismaError(error, 'verificar existência do registro');
    }
  }

  async count(where?: any): Promise<number> {
    try {
      return await this.model.count({ where: where || {} });
    } catch (error) {
      this.handlePrismaError(error, 'contar registros');
    }
  }

  protected handlePrismaError(error: any, operation: string): never {
    // Re-lança exceções Nest (evita embrulhar duas vezes)
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof ForbiddenException ||
      error instanceof ServiceUnavailableException
    ) {
      throw error;
    }

    const code = error?.code;
    if (typeof code === 'string' && code.startsWith('P')) {
      switch (code) {
        case 'P2000':
          throw new BadRequestException('Valor muito longo.');
        case 'P2001':
        case 'P2025':
          throw new NotFoundException('Registro não encontrado.');
        case 'P2002':
          throw new ConflictException('Registro duplicado.');
        case 'P2003':
          throw new BadRequestException('Violação de chave estrangeira.');
        case 'P2011':
          throw new BadRequestException('Campo obrigatório não pode ser nulo.');
        case 'P2024':
          throw new ServiceUnavailableException('Timeout de conexão com o banco.');
        case 'P2028':
          throw new ServiceUnavailableException('Timeout de transação.');
        default:
          throw new InternalServerErrorException(
            `Erro ao ${operation} (código ${code}).`,
          );
      }
    }

    throw new InternalServerErrorException(`Erro inesperado ao ${operation}.`);
  }
}