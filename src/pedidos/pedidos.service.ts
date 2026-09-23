// src/pedidos/pedidos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PedidoRepository } from './pedido.repository';
import { CartRepository } from '../cart/cart.repository';
import { ProdutoRepository } from '../produto/produto.repository';
import { UserRepository } from '../users/users.repository';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoStatusDto } from './dto/update-pedido-status.dto';
import { StatusPedido } from '@prisma/client';

interface PedidoItemInput {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  tamanho: string | null;
  cor: string | null;
}

const TX_OPTIONS = { timeout: 20000, maxWait: 10000 };

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private pedidoRepository: PedidoRepository,
    private cartRepository: CartRepository,
    private produtoRepository: ProdutoRepository,
    private notificacoesService: NotificacoesService,
    private userRepository: UserRepository,
    private prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────
  async create(userId: string, createPedidoDto: CreatePedidoDto) {
    if (!userId) throw new BadRequestException('ID do usuário é obrigatório');

    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const { itens, enderecoEntrega, frete = 0, imposto = 0, observacoes } = createPedidoDto;

    const itensParaProcessar: PedidoItemInput[] = [];
    let cartItems: any[] = [];

    if (itens && itens.length > 0) {
      if (itens.length > 50) {
        throw new BadRequestException('Máximo de 50 itens por pedido');
      }
      this.logger.log(`📦 Criando pedido com ${itens.length} itens diretos`);

      for (const item of itens) {
        const produto = await this.produtoRepository.findById(item.produtoId);
        if (!produto) {
          throw new BadRequestException(`Produto ${item.produtoId} não encontrado`);
        }
        if (produto.estoque < item.quantidade) {
          throw new BadRequestException(`Estoque insuficiente para ${produto.nome}`);
        }
        itensParaProcessar.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: Number(produto.preco),
          tamanho: item.tamanho || null,
          cor: item.cor || null,
        });
      }
    } else {
      this.logger.log('🛒 Criando pedido a partir do carrinho');
      cartItems = await this.cartRepository.findCartByUser(userId);

      if (!cartItems || cartItems.length === 0) {
        throw new BadRequestException('Carrinho vazio.');
      }
      if (cartItems.length > 50) {
        throw new BadRequestException('Carrinho com muitos itens. Limite de 50.');
      }

      for (const item of cartItems) {
        if (item.produto.estoque < item.quantidade) {
          throw new BadRequestException(`Estoque insuficiente para ${item.produto.nome}`);
        }
        itensParaProcessar.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: Number(item.produto.preco),
          tamanho: item.tamanho || null,
          cor: item.cor || null,
        });
      }
    }

    const subtotal = itensParaProcessar.reduce(
      (acc, i) => acc + i.precoUnitario * i.quantidade,
      0,
    );
    const total = subtotal + Number(frete) + Number(imposto);

    let enderecoFinal: Record<string, any> = {};
    if (
      enderecoEntrega &&
      typeof enderecoEntrega === 'object' &&
      Object.keys(enderecoEntrega).length > 0
    ) {
      enderecoFinal = enderecoEntrega as Record<string, any>;
    } else if (user?.endereco && typeof user.endereco === 'object') {
      enderecoFinal = user.endereco as Record<string, any>;
    } else {
      enderecoFinal = {
        rua: 'Endereço não informado',
        numero: 'S/N',
        bairro: 'Não informado',
        cidade: 'Não informada',
        estado: 'Não informado',
        cep: '00000-000',
      };
    }

    // ─────────────────────────────────────────────────────────
    // TRANSAÇÃO OTIMIZADA
    // ─────────────────────────────────────────────────────────
    const pedido = await this.prisma.$transaction(
      async (tx) => {
        // 3a. Decrementa estoque em PARALELO (Promise.all)
        const decrementos = await Promise.all(
          itensParaProcessar.map((item) =>
            tx.produto.updateMany({
              where: {
                id: item.produtoId,
                estoque: { gte: item.quantidade },
              },
              data: { estoque: { decrement: item.quantidade } },
            }),
          ),
        );

        const algumFalhou = decrementos.some((r) => r.count === 0);
        if (algumFalhou) {
          throw new BadRequestException(
            'Estoque insuficiente (concorrência). Tente novamente.',
          );
        }

        // 3b. Cria pedido
        const novoPedido = await tx.pedido.create({
          data: {
            userId,
            numero: `PED-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`,
            subtotal,
            frete: Number(frete),
            imposto: Number(imposto),
            total,
            enderecoEntrega: enderecoFinal,
            observacoes: observacoes || undefined,
            status: StatusPedido.pendente,
          },
        });

        // 3c. Cria TODOS os itens em UMA query (createMany)
        await tx.pedidoItem.createMany({
          data: itensParaProcessar.map((item) => ({
            pedidoId: novoPedido.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            tamanho: item.tamanho,
            cor: item.cor,
          })),
        });

        // 3d. Limpa carrinho
        if (cartItems.length > 0) {
          await tx.cartItem.deleteMany({ where: { userId } });
        }

        return novoPedido;
      },
      TX_OPTIONS,
    );

    this.notificacoesService
      .create(userId, {
        tipo: 'sistema',
        titulo: '✅ Pedido criado!',
        mensagem: `Pedido #${pedido.numero} criado no valor de ${this.formatCurrency(total)}.`,
      })
      .catch((err) => this.logger.error(`Erro notificação: ${err.message}`));

    this.notifyAdminsNewOrder(pedido, user, itensParaProcessar.length).catch((err) =>
      this.logger.error(`Erro notificar admins: ${err.message}`),
    );

    return this.pedidoRepository.findByIdAndUser(pedido.id, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────
  async findByUser(userId: string, page = 1, limit = 10) {
    if (!userId) throw new BadRequestException('ID do usuário é obrigatório');

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const [data, total] = await Promise.all([
      this.pedidoRepository.findByUser(userId, safePage, safeLimit),
      this.pedidoRepository.countByUser(userId),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: string, userId: string) {
    if (!id || !userId) {
      throw new BadRequestException('ID do pedido e usuário são obrigatórios');
    }

    const pedido = await this.pedidoRepository.findByIdAndUser(id, userId);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    return pedido;
  }

  async cancel(id: string, userId: string) {
    if (!id || !userId) {
      throw new BadRequestException('ID do pedido e usuário são obrigatórios');
    }

    const pedido = await this.findOne(id, userId);

    if (pedido.status !== StatusPedido.pendente) {
      throw new BadRequestException('Só é possível cancelar pedidos pendentes');
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const item of pedido.itens || []) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoque: { increment: item.quantidade } },
          });
        }

        await tx.pedido.update({
          where: { id },
          data: { status: StatusPedido.cancelado },
        });
      },
      TX_OPTIONS,
    );

    const canceledPedido = await this.pedidoRepository.findById(id);

    await this.notificacoesService.create(userId, {
      tipo: 'sistema',
      titulo: '❌ Pedido cancelado',
      mensagem: `Pedido #${pedido.numero} foi cancelado.`,
    });

    return canceledPedido;
  }

  // ─────────────────────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────────────────────
  async findAllAdmin(page = 1, limit = 10, status?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    if (status && !Object.values(StatusPedido).includes(status as StatusPedido)) {
      throw new BadRequestException(`Status inválido: ${status}`);
    }

    const where = status ? { status: status as StatusPedido } : {};

    const [data, total] = await Promise.all([
      this.pedidoRepository.findAllWithFilters(where, skip, safeLimit),
      this.pedidoRepository.countAllWithFilters(where),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findByStatus(status: string, page = 1, limit = 20) {
    if (!status) throw new BadRequestException('Status é obrigatório');

    if (!Object.values(StatusPedido).includes(status as StatusPedido)) {
      throw new BadRequestException(`Status inválido: ${status}`);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    return this.pedidoRepository.findByStatus(status as StatusPedido, safePage, safeLimit);
  }

  async findOneAdmin(id: string) {
    if (!id) throw new BadRequestException('ID do pedido é obrigatório');

    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    return pedido;
  }

  async updateStatusAdmin(id: string, dto: UpdatePedidoStatusDto, adminId: string) {
    if (!id || !adminId) {
      throw new BadRequestException('ID do pedido e admin são obrigatórios');
    }

    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    if (pedido.status === StatusPedido.cancelado) {
      throw new BadRequestException('Pedido já cancelado');
    }

    const statusAntigo = pedido.status;
    const statusNovo = dto.status;

    if (statusAntigo === statusNovo) {
      throw new BadRequestException(`Pedido já está com status "${statusNovo}"`);
    }

    let dataEnvio: Date | undefined;
    let codigoRastreio: string | undefined;

    if (statusNovo === StatusPedido.enviado) {
      dataEnvio = new Date();
      codigoRastreio = dto.codigoRastreio;
      if (!codigoRastreio) {
        throw new BadRequestException('Código de rastreio é obrigatório para status "enviado"');
      }
    }

    if (statusNovo === StatusPedido.cancelado) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const item of pedido.itens || []) {
            await tx.produto.update({
              where: { id: item.produtoId },
              data: { estoque: { increment: item.quantidade } },
            });
          }

          await tx.pedido.update({
            where: { id },
            data: { status: statusNovo, dataEnvio, codigoRastreio },
          });
        },
        TX_OPTIONS,
      );
    } else {
      await this.pedidoRepository.updateStatus(id, statusNovo, dataEnvio, codigoRastreio);
    }

    const updatedPedido = await this.pedidoRepository.findById(id);

    this.notifyUserStatusUpdate(pedido, statusAntigo, statusNovo, codigoRastreio).catch((err) =>
      this.logger.error(`Erro notificar usuário: ${err.message}`),
    );

    return updatedPedido;
  }

  async updateRastreio(id: string, codigoRastreio: string, adminId: string) {
    if (!id || !codigoRastreio || !adminId) {
      throw new BadRequestException('Dados incompletos para atualização');
    }

    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    if (pedido.status === StatusPedido.cancelado || pedido.status === StatusPedido.entregue) {
      throw new BadRequestException(
        `Não é possível atualizar rastreio de pedido com status "${pedido.status}"`,
      );
    }

    const updatedPedido = await this.pedidoRepository.updateRastreio(id, codigoRastreio);

    await this.notificacoesService.create(pedido.userId, {
      tipo: 'entrega',
      titulo: '📦 Código de rastreio!',
      mensagem: `Pedido #${pedido.numero} - Código: ${codigoRastreio}`,
    });

    return updatedPedido;
  }

  async cancelAdmin(id: string, motivo?: string, adminId?: string) {
    if (!id) throw new BadRequestException('ID do pedido é obrigatório');

    const pedido = await this.pedidoRepository.findById(id);
    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    if (
      pedido.status !== StatusPedido.pendente &&
      pedido.status !== StatusPedido.pagamento_confirmado
    ) {
      throw new BadRequestException(
        'Só é possível cancelar pedidos pendentes ou com pagamento confirmado',
      );
    }

    const observacoesAtualizadas = pedido.observacoes
      ? `${pedido.observacoes}\n[ADMIN] Cancelado: ${motivo || 'Sem motivo'}`
      : `[ADMIN] Cancelado: ${motivo || 'Sem motivo'}`;

    await this.prisma.$transaction(
      async (tx) => {
        for (const item of pedido.itens || []) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { estoque: { increment: item.quantidade } },
          });
        }

        await tx.pedido.update({
          where: { id },
          data: {
            status: StatusPedido.cancelado,
            observacoes: observacoesAtualizadas,
          },
        });
      },
      TX_OPTIONS,
    );

    const canceledPedido = await this.pedidoRepository.findById(id);

    await this.notificacoesService.create(pedido.userId, {
      tipo: 'sistema',
      titulo: '⚠️ Pedido cancelado',
      mensagem: `Pedido #${pedido.numero} foi cancelado. Motivo: ${motivo || 'Não informado'}.`,
    });

    return canceledPedido;
  }

  async findPedidosByCliente(clienteId: string, page = 1, limit = 10) {
    return this.findByUser(clienteId, page, limit);
  }

  async getOrderStats() {
    return this.pedidoRepository.getOrderStats();
  }

  async getRecentOrders(limit: number = 10) {
    const safeLimit = Math.min(limit, 50);
    return this.pedidoRepository.findRecentOrders(safeLimit);
  }

  async getOrdersByPeriod(startDate: Date, endDate: Date, page = 1, limit = 10) {
    if (!startDate || !endDate) {
      throw new BadRequestException('Datas de início e fim são obrigatórias');
    }
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Data de início não pode ser maior que data de fim');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    return this.pedidoRepository.findByPeriod(startDate, endDate, safePage, safeLimit);
  }

  async searchOrders(searchTerm: string, page = 1, limit = 10) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException('Termo de busca deve ter pelo menos 2 caracteres');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 50);

    return this.pedidoRepository.findByCliente(searchTerm, safePage, safeLimit);
  }

  private async notifyAdminsNewOrder(pedido: any, user: any, totalItens: number) {
    const admins = await this.userRepository.findAllAdmins();
    if (!admins || admins.length === 0) return;

    const valorFormatado = this.formatCurrency(Number(pedido.total));
    const itensTexto = totalItens === 1 ? '1 item' : `${totalItens} itens`;
    const adminsToNotify = admins.slice(0, 10);

    await Promise.allSettled(
      adminsToNotify.map((admin) =>
        this.notificacoesService
          .create(admin.id, {
            tipo: 'sistema',
            titulo: '🛒 NOVO PEDIDO!',
            mensagem: `Pedido #${pedido.numero} - ${user.nome} - ${itensTexto} - ${valorFormatado}`,
          })
          .catch((err) => this.logger.error(`Erro notificar admin ${admin.id}: ${err.message}`)),
      ),
    );
  }

  private async notifyUserStatusUpdate(
    pedido: any,
    statusAntigo: string,
    statusNovo: string,
    codigoRastreio?: string,
  ) {
    const statusMessages: Record<string, { titulo: string; mensagem: string; tipo: any }> = {
      pagamento_confirmado: {
        tipo: 'pagamento',
        titulo: '✅ Pagamento Confirmado!',
        mensagem: `Pedido #${pedido.numero} - Pagamento confirmado.`,
      },
      enviado: {
        tipo: 'entrega',
        titulo: '📦 Pedido Enviado!',
        mensagem: `Pedido #${pedido.numero} foi enviado! ${
          codigoRastreio ? `Código: ${codigoRastreio}` : ''
        }`,
      },
      entregue: {
        tipo: 'entrega',
        titulo: '🎉 Pedido Entregue!',
        mensagem: `Pedido #${pedido.numero} foi entregue. Obrigado!`,
      },
      cancelado: {
        tipo: 'sistema',
        titulo: '❌ Pedido Cancelado',
        mensagem: `Pedido #${pedido.numero} foi cancelado.`,
      },
    };

    const message = statusMessages[statusNovo];
    if (message && statusAntigo !== statusNovo) {
      await this.notificacoesService.create(pedido.userId, {
        tipo: message.tipo,
        titulo: message.titulo,
        mensagem: message.mensagem,
      });
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}