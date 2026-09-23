// src/pedidos/pedidos.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { PedidoRepository } from './pedido.repository';
import { CartRepository } from '../cart/cart.repository';
import { ProdutoRepository } from '../produto/produto.repository';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';
import { UserModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    forwardRef(() => NotificacoesModule),
  ],
  controllers: [PedidosController],
  providers: [
    PedidosService,
    PedidoRepository,
    CartRepository,
    ProdutoRepository,
  ],
  exports: [PedidosService],
})
export class PedidosModule {}