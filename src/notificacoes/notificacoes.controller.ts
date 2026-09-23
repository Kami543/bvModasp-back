// src/modules/notificacoes/notificacoes.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificacoesService } from './notificacoes.service';
import { CreateNotificacaoDto } from './dto/create-notificacao.dto';

@ApiTags('Notificacoes')
@ApiBearerAuth('access-token')
@Controller('notificacoes')
@UseGuards(AuthGuard('jwt'))
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar notificação para usuário autenticado' })
  async create(@Req() req: any, @Body() dto: CreateNotificacaoDto) {
    return this.notificacoesService.create(req.user.userId, dto);
  }

  // ─── Rotas específicas (declarar ANTES de :id) ─────────────────
  @Get('unread/count')
  @ApiOperation({ summary: 'Contar notificações não lidas' })
  async countUnread(@Req() req: any) {
    const count = await this.notificacoesService.getUnreadCount(req.user.userId);
    return { count };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de notificações' })
  async getStats(@Req() req: any) {
    return this.notificacoesService.getStats(req.user.userId);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Marcar todas notificações como lidas' })
  async markAllAsRead(@Req() req: any) {
    const { count } = await this.notificacoesService.markAllAsRead(req.user.userId);
    return { count };
  }

  @Delete('read/all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar todas notificações lidas' })
  async deleteAllRead(@Req() req: any) {
    const { count } = await this.notificacoesService.deleteAllRead(req.user.userId);
    return { count };
  }

  // ─── Listagem ───────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário' })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('apenasNaoLidas') apenasNaoLidas?: string,
  ) {
    return this.notificacoesService.findAll(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      apenasNaoLidas === 'true',
    );
  }

  // ─── Rotas com :id (por último) ─────────────────────────────
  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificacoesService.markAsRead(req.user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar notificação' })
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.notificacoesService.delete(req.user.userId, id);
  }
}