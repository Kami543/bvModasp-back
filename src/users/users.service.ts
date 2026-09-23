// src/users/users.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UserRepository } from './users.repository';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserDetailResponseDto,
  UserRole,
} from './dto/user.dto';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600, maxKeys: 200 });

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {}

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────
  private invalidateUserCache(id: string, email?: string, cpf?: string) {
    cache.del(`user:${id}`);
    if (email) cache.del(`user:email:${email}`);
    if (cpf) cache.del(`user:cpf:${cpf}`);
    cache.del('users:admins');
    cache.del('users:clients');
  }

  private isValidId(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  private handlePrismaError(error: any): never {
    switch (error?.code) {
      case 'P2002':
        throw new ConflictException('Registro já existe');
      case 'P2003':
        throw new BadRequestException('Referência inválida');
      case 'P2024':
        this.logger.error(`Timeout na conexão com o banco: ${error.message}`);
        throw new ServiceUnavailableException(
          'Serviço temporariamente ocupado. Tente novamente em alguns instantes.',
        );
      case 'P2025':
        throw new NotFoundException('Registro não encontrado');
      default:
        if (
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof BadRequestException ||
          error instanceof ForbiddenException
        ) {
          throw error;
        }
        throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CREATE — role sempre USER
  // ─────────────────────────────────────────────────────────────
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log('Criando novo usuário...');

    try {
      const emailExists = await this.userRepository.exists({ email: createUserDto.email });
      if (emailExists) throw new ConflictException('Email já está cadastrado');

      const cpfExists = await this.userRepository.exists({ cpf: createUserDto.cpf });
      if (cpfExists) throw new ConflictException('CPF já está cadastrado');

      const hashedPassword = await bcrypt.hash(createUserDto.senha, 10);

      const user = await this.userRepository.create({
        nome: createUserDto.nome,
        email: createUserDto.email,
        cpf: createUserDto.cpf,
        senha: hashedPassword,
        endereco: createUserDto.endereco || '',
        role: Role.USER,
      });

      this.invalidateUserCache(user.id, user.email, user.cpf);
      this.logger.log(`Usuário criado com ID: ${user.id}`);

      return new UserResponseDto(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────
  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: UserResponseDto[]; total: number; page: number; totalPages: number }> {
    this.logger.log(`Buscando todos os usuários - Página ${page}`);

    try {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const safePage = Math.max(1, page);

      const result = await this.userRepository.findAll({
        page: safePage,
        limit: safeLimit,
      });

      return {
        data: result.data.map((user) => new UserResponseDto(user)),
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findById(id: string): Promise<UserResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    let user = cache.get<any>(`user:${id}`);
    if (!user) {
      try {
        user = await this.userRepository.findById(id);
        if (user) cache.set(`user:${id}`, user);
      } catch (error) {
        this.handlePrismaError(error);
      }
    }

    if (!user) throw new NotFoundException('Usuário não encontrado');
    return new UserResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    if (!email || email.trim().length === 0) {
      throw new BadRequestException('Email inválido');
    }

    let user = cache.get<any>(`user:email:${email}`);
    if (!user) {
      try {
        user = await this.userRepository.findByEmail(email);
        if (user) cache.set(`user:email:${email}`, user);
      } catch (error) {
        this.handlePrismaError(error);
      }
    }

    return user ? new UserResponseDto(user) : null;
  }

  async findByCpf(cpf: string): Promise<UserResponseDto | null> {
    if (!cpf || cpf.trim().length === 0) {
      throw new BadRequestException('CPF inválido');
    }

    let user = cache.get<any>(`user:cpf:${cpf}`);
    if (!user) {
      try {
        user = await this.userRepository.findByCpf(cpf);
        if (user) cache.set(`user:cpf:${cpf}`, user);
      } catch (error) {
        this.handlePrismaError(error);
      }
    }

    return user ? new UserResponseDto(user) : null;
  }

  async findAllAdmins(limit: number = 100): Promise<UserResponseDto[]> {
    const safeLimit = Math.min(limit, 100);
    const cacheKey = `users:admins:${safeLimit}`;

    let admins = cache.get<any[]>(cacheKey);
    if (!admins) {
      try {
        admins = await this.userRepository.findByRole(Role.ADMIN, safeLimit);
        if (admins) cache.set(cacheKey, admins);
      } catch (error) {
        this.handlePrismaError(error);
      }
    }

    return admins ? admins.map((admin) => new UserResponseDto(admin)) : [];
  }

  async findAllClients(limit?: number): Promise<UserResponseDto[]> {
    const safeLimit = limit ? Math.min(limit, 200) : 200;
    const cacheKey = `users:clients:${safeLimit}`;

    let clients = cache.get<any[]>(cacheKey);
    if (!clients) {
      try {
        clients = await this.userRepository.findByRole(Role.USER, safeLimit);
        if (clients) cache.set(cacheKey, clients);
      } catch (error) {
        this.handlePrismaError(error);
      }
    }

    return clients ? clients.map((client) => new UserResponseDto(client)) : [];
  }

  async findByRole(role: string, limit: number = 100): Promise<UserResponseDto[]> {
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException('Role inválida');
    }

    this.logger.log(`Buscando usuários com role: ${role}`);

    try {
      const safeLimit = Math.min(limit, 200);
      const users = await this.userRepository.findByRole(role as Role, safeLimit);
      return users.map((user) => new UserResponseDto(user));
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findDetail(id: string): Promise<UserDetailResponseDto> {
    this.logger.log(`Buscando detalhes do usuário com ID: ${id}`);
    const userDto = await this.findById(id);

    try {
      const [pedidosTotal, carrinhoTotal, notificacoesNaoLidas] = await Promise.all([
        this.userRepository.countPedidos(id).catch(() => 0),
        this.userRepository.countCarrinho(id).catch(() => 0),
        this.userRepository.countNotificacoesNaoLidas(id).catch(() => 0),
      ]);

      return new UserDetailResponseDto(
        userDto,
        pedidosTotal,
        carrinhoTotal,
        notificacoesNaoLidas,
      );
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE — busca direto do banco (sem cache), valida role
  // ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requestingUserRole?: UserRole,
  ): Promise<UserResponseDto> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    this.logger.log(`Atualizando usuário com ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const updateData: any = {};

    if (updateUserDto.nome !== undefined) updateData.nome = updateUserDto.nome;
    if (updateUserDto.endereco !== undefined) updateData.endereco = updateUserDto.endereco;

    // role só se quem pediu é admin
    if (updateUserDto.role !== undefined) {
      if (requestingUserRole !== 'ADMIN') {
        throw new ForbiddenException('Apenas administradores podem alterar role');
      }
      updateData.role = updateUserDto.role;
    }

    if (updateUserDto.senha) {
      updateData.senha = await bcrypt.hash(updateUserDto.senha, 10);
    }

    if (updateUserDto.email !== undefined && updateUserDto.email !== user.email) {
      const emailExists = await this.userRepository.exists({ email: updateUserDto.email });
      if (emailExists) throw new ConflictException('Email já está em uso');
      updateData.email = updateUserDto.email;
    }

    if (updateUserDto.cpf !== undefined && updateUserDto.cpf !== user.cpf) {
      const cpfExists = await this.userRepository.exists({ cpf: updateUserDto.cpf });
      if (cpfExists) throw new ConflictException('CPF já está em uso');
      updateData.cpf = updateUserDto.cpf;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Nenhum dado válido para atualização');
    }

    try {
      const updatedUser = await this.userRepository.update(id, updateData);

      // invalida antigos e novos índices
      this.invalidateUserCache(id, user.email, user.cpf);
      if (updateData.email) cache.del(`user:email:${updateData.email}`);
      if (updateData.cpf) cache.del(`user:cpf:${updateData.cpf}`);

      this.logger.log(`Usuário com ID ${id} atualizado com sucesso`);
      return new UserResponseDto(updatedUser);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE — protege último admin
  // ─────────────────────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    if (!this.isValidId(id)) throw new BadRequestException('ID inválido');

    this.logger.log(`Deletando usuário com ID: ${id}`);
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (user.role === Role.ADMIN) {
      const adminsCount = await this.userRepository.countByRole(Role.ADMIN);
      if (adminsCount <= 1) {
        throw new BadRequestException('Não é possível remover o último administrador');
      }
    }

    this.invalidateUserCache(id, user.email, user.cpf);

    try {
      await this.userRepository.delete(id);
      this.logger.log(`Usuário com ID ${id} deletado com sucesso`);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getPedidos(userId: string, page: number = 1, limit: number = 10) {
    await this.findById(userId);
    try {
      return this.userRepository.findPedidosByUserId(userId, page, limit);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getCarrinho(userId: string) {
    await this.findById(userId);
    try {
      return this.userRepository.findCarrinhoByUserId(userId);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async getNotificacoes(
    userId: string,
    lidas: boolean = false,
    page: number = 1,
    limit: number = 20,
  ) {
    await this.findById(userId);
    try {
      return this.userRepository.findNotificacoesByUserId(userId, lidas, page, limit);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async countAdmins(): Promise<number> {
    try {
      return await this.userRepository.countByRole(Role.ADMIN);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async countClients(): Promise<number> {
    try {
      return await this.userRepository.countByRole(Role.USER);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MÉTODOS INTERNOS (login/lock) — invalidam cache
  // ─────────────────────────────────────────────────────────────
  async updateLastLogin(id: string, ip: string) {
    const user = await this.userRepository.updateLastLogin(id, ip);
    this.invalidateUserCache(id, user.email, user.cpf);
    return user;
  }

  async incrementFailedAttempts(id: string) {
    const user = await this.userRepository.incrementFailedAttempts(id);
    this.invalidateUserCache(id, user.email, user.cpf);
    return user;
  }

  async lockUser(id: string, durationMinutes: number = 30) {
    const user = await this.userRepository.lockUser(id, durationMinutes);
    this.invalidateUserCache(id, user.email, user.cpf);
    return user;
  }

  async enableTwoFactor(id: string, secret: string) {
    const user = await this.userRepository.enableTwoFactor(id, secret);
    this.invalidateUserCache(id, user.email, user.cpf);
    return user;
  }

  async disableTwoFactor(id: string) {
    const user = await this.userRepository.disableTwoFactor(id);
    this.invalidateUserCache(id, user.email, user.cpf);
    return user;
  }
}