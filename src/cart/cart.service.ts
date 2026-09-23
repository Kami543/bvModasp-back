// src/cart/cart.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { ProdutoRepository } from '../produto/produto.repository';
import { AddToCartDto } from './dto/cart.dto';
import { UpdateCartItemDto } from './dto/cart.dto';

interface ValidationResult {
  itemId: string;
  produtoId: string;
  nome: string;
  available: boolean;
  reason?: string;
  requestedQuantity?: number;
  availableQuantity?: number;
  price?: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly produtoRepository: ProdutoRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // ADD
  // ─────────────────────────────────────────────────────────────
  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { produtoId, quantidade, tamanho, cor } = addToCartDto;

    const produto = await this.produtoRepository.findById(produtoId);
    if (!produto) {
      throw new NotFoundException('Produto não encontrado');
    }

    const existingItem = await this.cartRepository.findCartItem(
      userId,
      produtoId,
      tamanho ?? null,
      cor ?? null,
    );

    const quantidadeFinal = (existingItem?.quantidade ?? 0) + quantidade;

    if (produto.estoque < quantidadeFinal) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${produto.estoque}`,
      );
    }

    if (existingItem) {
      // Incremento atômico — não perde update concorrente
      await this.cartRepository.incrementQuantidade(existingItem.id, quantidade);
    } else {
      try {
        await this.cartRepository.addItem({
          userId,
          produtoId,
          quantidade,
          tamanho,
          cor,
        });
      } catch (error: any) {
        // Se outro request criou o mesmo item em paralelo, o unique constraint
        // dispara (P2002). Nesse caso, incrementa em vez de falhar.
        if (error?.code === 'P2002') {
          const item = await this.cartRepository.findCartItem(
            userId,
            produtoId,
            tamanho ?? null,
            cor ?? null,
          );
          if (item) {
            await this.cartRepository.incrementQuantidade(item.id, quantidade);
          }
        } else {
          throw error;
        }
      }
    }

    return this.getCart(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────
  async getCart(userId: string) {
    const cartItems = await this.cartRepository.findCartByUser(userId);

    const total = cartItems.reduce((sum, item) => {
      return sum + Number(item.produto.preco) * item.quantidade;
    }, 0);

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantidade, 0);

    const formattedItems = cartItems.map((item) => ({
      id: item.id,
      quantidade: item.quantidade,
      tamanho: item.tamanho,
      cor: item.cor,
      produto: {
        id: item.produto.id,
        nome: item.produto.nome,
        preco: Number(item.produto.preco),
        slug: item.produto.slug,
        categoria: item.produto.categoria,
        imagem: item.produto.imagem,
      },
    }));

    return {
      items: formattedItems,
      total: Number(total.toFixed(2)),
      itemCount,
    };
  }

  async getCartItemCount(userId: string) {
    const count = await this.cartRepository.getTotalItemsCount(userId);
    return { count };
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────
  async updateCartItem(
    userId: string,
    itemId: string,
    updateDto: UpdateCartItemDto,
  ) {
    const { quantidade } = updateDto;

    const cartItem = await this.cartRepository.findByIdAndUser(itemId, userId);
    if (!cartItem) {
      throw new NotFoundException('Item do carrinho não encontrado');
    }

    if (quantidade <= 0) {
      return this.removeFromCart(userId, itemId);
    }

    if (cartItem.produto.estoque < quantidade) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${cartItem.produto.estoque}`,
      );
    }

    await this.cartRepository.updateQuantidade(itemId, quantidade);
    return this.getCart(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // REMOVE
  // ─────────────────────────────────────────────────────────────
  async removeFromCart(userId: string, itemId: string) {
    const result = await this.cartRepository.removeItemByUser(itemId, userId);
    if (result.count === 0) {
      throw new NotFoundException('Item do carrinho não encontrado');
    }
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.cartRepository.clearCart(userId);
    return this.getCart(userId);
  }

  // ─────────────────────────────────────────────────────────────
  // VALIDAÇÃO PRÉ-CHECKOUT
  // ─────────────────────────────────────────────────────────────
  async validateCartItems(userId: string) {
    const cartItems = await this.cartRepository.findCartByUser(userId);

    const validationResults: ValidationResult[] = [];
    let isValid = true;

    for (const item of cartItems) {
      const produto = await this.produtoRepository.findById(item.produtoId);

      if (!produto) {
        validationResults.push({
          itemId: item.id,
          produtoId: item.produtoId,
          nome: 'Produto não encontrado',
          available: false,
          reason: 'Produto não existe mais',
        });
        isValid = false;
        continue;
      }

      if (produto.estoque < item.quantidade) {
        validationResults.push({
          itemId: item.id,
          produtoId: item.produtoId,
          nome: produto.nome,
          available: false,
          reason: `Estoque insuficiente. Disponível: ${produto.estoque}`,
          requestedQuantity: item.quantidade,
          availableQuantity: produto.estoque,
        });
        isValid = false;
      } else {
        validationResults.push({
          itemId: item.id,
          produtoId: item.produtoId,
          nome: produto.nome,
          available: true,
          price: Number(produto.preco),
        });
      }
    }

    return {
      isValid,
      items: validationResults,
      totalItems: cartItems.length,
    };
  }
}