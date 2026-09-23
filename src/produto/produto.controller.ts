import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProdutoService } from './produto.service';
import {
  CreateProdutoDto,
  UpdateProdutoDto,
  UpdatePromocaoDto,
  UpdateEstoqueDto,
} from './dto/produto.dto';

@ApiBearerAuth('access-token')
@ApiTags('Produtos')
@Controller('products')
export class ProdutoController {
  private readonly logger = new Logger(ProdutoController.name);

  constructor(private readonly produtoService: ProdutoService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar um novo produto' })
  async create(@Body() createProdutoDto: CreateProdutoDto) {
    return this.produtoService.create(createProdutoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar todos os produtos' })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.produtoService.findAll(pageNum, limitNum);
  }

  @Get('categoria/:categoria')
  @ApiOperation({ summary: 'Buscar produtos por categoria' })
  async findByCategoria(
    @Param('categoria') categoria: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.produtoService.findByCategoria(categoria, pageNum, limitNum);
  }

  @Get('tag/:tag')
  @ApiOperation({ summary: 'Buscar produtos por tag' })
  async findByTag(
    @Param('tag') tag: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.produtoService.findByTag(tag, pageNum, limitNum);
  }

  @Get('estoque/disponivel')
  @ApiOperation({ summary: 'Buscar produtos em estoque' })
  async findEmEstoque(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.produtoService.findEmEstoque(pageNum, limitNum);
  }

  @Get('novos')
  @ApiOperation({ summary: 'Buscar produtos novos' })
  async findNovos(
    @Query('dias') dias: string = '30',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const diasNum = parseInt(dias, 10);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.produtoService.findNovos(diasNum, pageNum, limitNum);
  }

  @Get('populares')
  @ApiOperation({ summary: 'Buscar produtos populares' })
  async findPopulares(@Query('limit') limit: string = '10') {
    return this.produtoService.findPopulares(parseInt(limit, 10));
  }

  @Get('promocao')
  @ApiOperation({ summary: 'Buscar produtos em promoção' })
  async findEmPromocao() {
    return this.produtoService.findEmPromocao();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Buscar produto por slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.produtoService.findBySlug(slug);
  }

  @Get('cores')
  @ApiOperation({ summary: 'Buscar cores disponíveis' })
  async getCoresDisponiveis() {
    return this.produtoService.getCoresDisponiveis();
  }

  @Get('tamanhos')
  @ApiOperation({ summary: 'Buscar tamanhos disponíveis' })
  async getTamanhosDisponiveis() {
    return this.produtoService.getTamanhosDisponiveis();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar produto por ID' })
  async findById(@Param('id') id: string) {
    return this.produtoService.findById(id);
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'Buscar produto com detalhes' })
  async findDetail(@Param('id') id: string) {
    return this.produtoService.findDetail(id);
  }

  @Get(':id/similares')
  @ApiOperation({ summary: 'Buscar produtos similares' })
  async findSimilares(@Param('id') id: string, @Query('limit') limit: string = '5') {
    return this.produtoService.findSimilares(id, parseInt(limit, 10));
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar um produto' })
  async update(@Param('id') id: string, @Body() updateProdutoDto: UpdateProdutoDto) {
    return this.produtoService.update(id, updateProdutoDto);
  }

  @Put(':id/estoque')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar estoque do produto' })
  async updateEstoque(@Param('id') id: string, @Body() dto: UpdateEstoqueDto) {
    return this.produtoService.updateEstoque(id, dto.quantidade);
  }

  @Put(':id/promocao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar promoção do produto' })
  async updatePromocao(
    @Param('id') id: string,
    @Body() updatePromocaoDto: UpdatePromocaoDto,
  ) {
    return this.produtoService.updatePromocao(id, updatePromocaoDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar um produto' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.produtoService.delete(id);
  }
}