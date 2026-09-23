// src/pedidos/pedidos.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoStatusDto } from './dto/update-pedido-status.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Pedidos')
@ApiBearerAuth('access-token')
@Controller('pedidos')
@UseGuards(AuthGuard('jwt'))
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  // ─────────────────────────────────────────────────────────────
  // CLIENTE
  // ─────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Criar novo pedido' })
  async create(@Req() req: any, @Body() dto: CreatePedidoDto) {
    const userId = req.user.sub;
    this.logger.log(`Criando pedido para usuário: ${userId}`);
    return this.pedidosService.create(userId, dto);
  }

  @Get('meus')
  @ApiOperation({ summary: 'Listar meus pedidos' })
  async findMeusPedidos(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub;
    return this.pedidosService.findByUser(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar pedidos do usuário' })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.sub;
    return this.pedidosService.findByUser(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar pedido por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.pedidosService.findOne(id, req.user.sub);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancelar pedido' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.pedidosService.cancel(id, req.user.sub);
  }

  // ─────────────────────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────────────────────
  @Get('admin/all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Listar todos os pedidos (admin)' })
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.pedidosService.findAllAdmin(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      status,
    );
  }

  @Get('admin/status/:status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Buscar pedidos por status (admin)' })
  async findByStatus(
    @Param('status') status: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.findByStatus(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('admin/stats/orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Estatísticas de pedidos' })
  async getOrderStats() {
    return this.pedidosService.getOrderStats();
  }

  @Get('admin/recent/orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Pedidos recentes' })
  async getRecentOrders(@Query('limit') limit?: string) {
    return this.pedidosService.getRecentOrders(limit ? parseInt(limit, 10) : 10);
  }

  @Get('admin/period/orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Pedidos por período' })
  async getOrdersByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.getOrdersByPeriod(
      new Date(startDate),
      new Date(endDate),
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('admin/search/orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Buscar pedidos por termo' })
  async searchOrders(
    @Query('term') term: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.searchOrders(
      term,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('admin/cliente/:clienteId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Buscar pedidos por cliente' })
  async findPedidosByCliente(
    @Param('clienteId') clienteId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pedidosService.findPedidosByCliente(
      clienteId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('admin/:id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Buscar pedido por ID (admin)' })
  async findOneAdmin(@Param('id') id: string) {
    return this.pedidosService.findOneAdmin(id);
  }

  @Put('admin/:id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Atualizar status do pedido (admin)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePedidoStatusDto,
    @Req() req: any,
  ) {
    return this.pedidosService.updateStatusAdmin(id, dto, req.user.sub);
  }

  @Put('admin/:id/rastreio')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Atualizar código de rastreio' })
  async updateRastreio(
    @Param('id') id: string,
    @Body('codigoRastreio') codigoRastreio: string,
    @Req() req: any,
  ) {
    return this.pedidosService.updateRastreio(id, codigoRastreio, req.user.sub);
  }

  @Delete('admin/:id/cancel')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar pedido (admin)' })
  async cancelAdmin(
    @Param('id') id: string,
    @Body('motivo') motivo?: string,
    @Req() req?: any,
  ) {
    return this.pedidosService.cancelAdmin(id, motivo, req?.user?.userId);
  }
}