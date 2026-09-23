// src/cart/cart.module.ts
import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { ProdutoRepository } from '../produto/produto.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CartController],
  providers: [
    CartService,
    CartRepository,
    ProdutoRepository,
  ],
  exports: [CartService, CartRepository],
})
export class CartModule {}