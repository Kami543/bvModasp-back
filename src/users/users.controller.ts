import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Put,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiBearerAuth('access-token')
@ApiTags('Users')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE — público (registro)
  // ─────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar um novo usuário' })
  async create(@Body() createUserDto: CreateUserDto) {
    this.logger.log('Criando um novo usuário...');
    return this.userService.create(createUserDto);
  }

  // ─────────────────────────────────────────────────────────────
  // READ — só o próprio ou admin
  // ─────────────────────────────────────────────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar dados do usuário logado' })
  async findMe(@CurrentUser('sub') id: string) {
    return this.userService.findById(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todos os usuários (apenas admin)' })
  async findAll(
    @CurrentUser('role') role: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Apenas administradores podem listar usuários');
    }
    return this.userService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar um usuário por ID (próprio ou admin)' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('sub') requestingId: string,
    @CurrentUser('role') role: string,
  ) {
    this.assertOwnerOrAdmin(id, requestingId, role);
    return this.userService.findById(id);
  }

  @Get(':id/detail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Buscar usuário com detalhes (próprio ou admin)' })
  async findDetail(
    @Param('id') id: string,
    @CurrentUser('sub') requestingId: string,
    @CurrentUser('role') role: string,
  ) {
    this.assertOwnerOrAdmin(id, requestingId, role);
    return this.userService.findDetail(id);
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE — próprio ou admin
  // ─────────────────────────────────────────────────────────────
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar um usuário (próprio ou admin)' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('sub') requestingId: string,
    @CurrentUser('role') role: string,
  ) {
    this.assertOwnerOrAdmin(id, requestingId, role);
    return this.userService.update(id, updateUserDto, role as any);
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE — próprio ou admin
  // ─────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar um usuário (próprio ou admin)' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') requestingId: string,
    @CurrentUser('role') role: string,
  ): Promise<void> {
    this.assertOwnerOrAdmin(id, requestingId, role);
    return this.userService.delete(id);
  }

  // ─────────────────────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────────────────────
  private assertOwnerOrAdmin(id: string, requestingId: string, role: string) {
    if (role !== 'ADMIN' && id !== requestingId) {
      throw new ForbiddenException('Você só pode acessar seus próprios dados');
    }
  }
}