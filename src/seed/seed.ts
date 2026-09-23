// src/seed/seed.ts
import { PrismaClient, TipoPagamento } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function findOrCreateProduto(nome: string, createData: any) {
  const existingProduto = await prisma.produto.findFirst({
    where: { nome },
  });

  if (existingProduto) {
    const { imagem, ...updateData } = createData;
    return await prisma.produto.update({
      where: { id: existingProduto.id },
      data: updateData,
    });
  }

  return await prisma.produto.create({ data: createData });
}

export async function seedDatabase() {
  console.log('🌱 Iniciando seeding...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // ========================================
  // USUÁRIOS
  // ========================================

  const user1 = await prisma.user.upsert({
    where: { email: 'joao.silva@example.com' },
    update: {},
    create: {
      nome: 'João Silva',
      email: 'joao.silva@example.com',
      cpf: '111.111.111-11',
      role: 'USER',
      endereco: {
        rua: 'Rua das Flores',
        numero: '123',
        complemento: 'Apto 101',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      senha: hashedPassword,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'maria.souza@example.com' },
    update: {},
    create: {
      nome: 'Maria Souza',
      email: 'maria.souza@example.com',
      cpf: '222.222.222-22',
      role: 'USER',
      endereco: {
        rua: 'Avenida Paulista',
        numero: '1578',
        complemento: 'Conj 500',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-200',
      },
      senha: hashedPassword,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@example.com',
      cpf: '333.333.333-33',
      role: 'ADMIN',
      endereco: {
        rua: 'Rua Admin',
        numero: '1',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      senha: hashedPassword,
    },
  });

  console.log('✅ Usuários criados:', {
    user1: user1.email,
    user2: user2.email,
    admin: admin.email,
  });

  // ========================================
  // PRODUTOS (SÓ FEMININO)
  // ========================================

  const produto1 = await findOrCreateProduto('Vestido Floral', {
    nome: 'Vestido Floral',
    slug: 'vestido-floral',
    descricao: 'Vestido elegante com estampa floral, tecido leve e fluido. Perfeito para ocasiões especiais.',
    preco: 129.90,
    preco_promocional: 103.92,
    desconto: 20,
    promocao_ativa: true,
    categoria: 'Feminino',
    tag: 'vestido',
    estoque: 50,
    cores: ['Vermelho', 'Azul', 'Rosa', 'Amarelo'],
    tamanhos: ['P', 'M', 'G', 'GG'],
    imagem: 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=500',
  });

  const produto2 = await findOrCreateProduto('Blusa de Seda', {
    nome: 'Blusa de Seda',
    slug: 'blusa-de-seda',
    descricao: 'Blusa em seda com caimento impecável. Sofisticação e conforto para o dia a dia.',
    preco: 89.90,
    preco_promocional: null,
    desconto: 0,
    promocao_ativa: false,
    categoria: 'Feminino',
    tag: 'blusa',
    estoque: 80,
    cores: ['Branco', 'Preto', 'Rosa', 'Bege'],
    tamanhos: ['P', 'M', 'G'],
    imagem: 'https://images.unsplash.com/photo-1564257577501-3d6f2c8f1e1e?w=500',
  });

  const produto3 = await findOrCreateProduto('Calça Wide Leg', {
    nome: 'Calça Wide Leg',
    slug: 'calca-wide-leg',
    descricao: 'Calça wide leg de cintura alta, alonga a silhueta e garante elegância.',
    preco: 159.90,
    preco_promocional: 135.92,
    desconto: 15,
    promocao_ativa: true,
    categoria: 'Feminino',
    tag: 'calca',
    estoque: 40,
    cores: ['Preto', 'Bege', 'Azul Marinho'],
    tamanhos: ['P', 'M', 'G', 'GG'],
    imagem: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500',
  });

  const produto4 = await findOrCreateProduto('Saia Midi Plissada', {
    nome: 'Saia Midi Plissada',
    slug: 'saia-midi-plissada',
    descricao: 'Saia midi plissada com movimento fluido. Versátil para workwear e ocasiões casuais.',
    preco: 119.90,
    preco_promocional: null,
    desconto: 0,
    promocao_ativa: false,
    categoria: 'Feminino',
    tag: 'saia',
    estoque: 35,
    cores: ['Rosa', 'Preto', 'Dourado'],
    tamanhos: ['P', 'M', 'G'],
    imagem: 'https://images.unsplash.com/photo-1583496661160-fb5886a0f8b7?w=500',
  });

  const produto5 = await findOrCreateProduto('Shorts Jeans Cintura Alta', {
    nome: 'Shorts Jeans Cintura Alta',
    slug: 'shorts-jeans-cintura-alta',
    descricao: 'Shorts jeans moderno com cintura alta, ideal para looks casuais e despojados.',
    preco: 89.90,
    preco_promocional: 62.93,
    desconto: 30,
    promocao_ativa: true,
    categoria: 'Feminino',
    tag: 'short',
    estoque: 40,
    cores: ['Azul Claro', 'Azul Escuro', 'Preto'],
    tamanhos: ['P', 'M', 'G'],
    imagem: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500',
  });

  const produto6 = await findOrCreateProduto('Blazer Estruturado', {
    nome: 'Blazer Estruturado',
    slug: 'blazer-estruturado',
    descricao: 'Blazer estruturado com modelagem impecável. Peça-chave para looks sofisticados.',
    preco: 249.90,
    preco_promocional: 212.42,
    desconto: 15,
    promocao_ativa: true,
    categoria: 'Feminino',
    tag: 'blazer',
    estoque: 20,
    cores: ['Preto', 'Branco', 'Rosa'],
    tamanhos: ['P', 'M', 'G'],
    imagem: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=500',
  });

  const produto7 = await findOrCreateProduto('Camisa Social Feminina', {
    nome: 'Camisa Social Feminina',
    slug: 'camisa-social-feminina',
    descricao: 'Camisa social de alta qualidade, perfeita para ocasiões formais e trabalho.',
    preco: 149.90,
    preco_promocional: null,
    desconto: 0,
    promocao_ativa: false,
    categoria: 'Feminino',
    tag: 'camisa',
    estoque: 60,
    cores: ['Branco', 'Azul Claro', 'Cinza'],
    tamanhos: ['P', 'M', 'G', 'GG'],
    imagem: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
  });

  const produto8 = await findOrCreateProduto('Vestido Longo Plissado', {
    nome: 'Vestido Longo Plissado',
    slug: 'vestido-longo-plissado',
    descricao: 'Vestido longo plissado com caimento leve. Elegância para eventos e ocasiões especiais.',
    preco: 289.90,
    preco_promocional: 217.43,
    desconto: 25,
    promocao_ativa: true,
    categoria: 'Feminino',
    tag: 'vestido',
    estoque: 15,
    cores: ['Rosa', 'Vinho', 'Preto'],
    tamanhos: ['P', 'M', 'G'],
    imagem: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500',
  });

  console.log('✅ Produtos criados:', {
    produto1: `${produto1.nome} (${produto1.desconto}% OFF)`,
    produto2: produto2.nome,
    produto3: `${produto3.nome} (${produto3.desconto}% OFF)`,
    produto4: produto4.nome,
    produto5: `${produto5.nome} (${produto5.desconto}% OFF)`,
    produto6: `${produto6.nome} (${produto6.desconto}% OFF)`,
    produto7: produto7.nome,
    produto8: `${produto8.nome} (${produto8.desconto}% OFF)`,
  });

  // ========================================
  // ITENS DO CARRINHO
  // ========================================

  await prisma.cartItem.upsert({
    where: {
      userId_produtoId_tamanho_cor: {
        userId: user1.id,
        produtoId: produto2.id,
        tamanho: 'M',
        cor: 'Preto',
      },
    },
    update: { quantidade: 2 },
    create: {
      quantidade: 2,
      tamanho: 'M',
      cor: 'Preto',
      userId: user1.id,
      produtoId: produto2.id,
    },
  });

  await prisma.cartItem.upsert({
    where: {
      userId_produtoId_tamanho_cor: {
        userId: user1.id,
        produtoId: produto6.id,
        tamanho: 'G',
        cor: 'Rosa',
      },
    },
    update: { quantidade: 1 },
    create: {
      quantidade: 1,
      tamanho: 'G',
      cor: 'Rosa',
      userId: user1.id,
      produtoId: produto6.id,
    },
  });

  await prisma.cartItem.upsert({
    where: {
      userId_produtoId_tamanho_cor: {
        userId: user2.id,
        produtoId: produto1.id,
        tamanho: 'M',
        cor: 'Vermelho',
      },
    },
    update: { quantidade: 1 },
    create: {
      quantidade: 1,
      tamanho: 'M',
      cor: 'Vermelho',
      userId: user2.id,
      produtoId: produto1.id,
    },
  });

  console.log('✅ Itens do carrinho criados/atualizados');

  // ========================================
  // MÉTODOS DE PAGAMENTO
  // ========================================

  await prisma.metodoPagamento.upsert({
    where: { id: 'metodo-pagamento-1' },
    update: {},
    create: {
      id: 'metodo-pagamento-1',
      tipo: TipoPagamento.CARTAO_CREDITO,
      ultimosDigitos: '1234',
      pagamentoDefault: true,
      userId: user1.id,
    },
  });

  await prisma.metodoPagamento.upsert({
    where: { id: 'metodo-pagamento-2' },
    update: {},
    create: {
      id: 'metodo-pagamento-2',
      tipo: TipoPagamento.CARTAO_DEBITO,
      ultimosDigitos: '5678',
      pagamentoDefault: false,
      userId: user1.id,
    },
  });

  console.log('✅ Métodos de pagamento criados');

  // ========================================
  // PEDIDOS
  // ========================================

  const pedido1 = await prisma.pedido.upsert({
    where: { numero: 'PED-2024-001' },
    update: {},
    create: {
      numero: 'PED-2024-001',
      status: 'entregue',
      subtotal: 259.70,
      frete: 15.00,
      imposto: 41.96,
      total: 316.66,
      enderecoEntrega: {
        rua: 'Rua das Flores',
        numero: '123',
        complemento: 'Apto 101',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01000-000',
      },
      dataPagamento: new Date('2024-01-15'),
      dataEnvio: new Date('2024-01-16'),
      dataEntrega: new Date('2024-01-20'),
      codigoRastreio: 'BR123456789',
      userId: user1.id,
      itens: {
        create: [
          {
            quantidade: 2,
            precoUnitario: 89.90,
            tamanho: 'M',
            cor: 'Preto',
            produtoId: produto2.id,
          },
          {
            quantidade: 1,
            precoUnitario: 249.90,
            tamanho: 'G',
            cor: 'Rosa',
            produtoId: produto6.id,
          },
        ],
      },
    },
  });

  console.log('✅ Pedido criado:', pedido1.numero);

  // ========================================
  // NOTIFICAÇÕES
  // ========================================

  await prisma.notificacao.upsert({
    where: { id: 'notificacao-1' },
    update: {},
    create: {
      id: 'notificacao-1',
      tipo: 'promo',
      titulo: '🔥 Ofertas imperdíveis!',
      mensagem: 'Aproveite descontos de até 30% em produtos selecionados!',
      lida: false,
      userId: user1.id,
    },
  });

  await prisma.notificacao.upsert({
    where: { id: 'notificacao-2' },
    update: {},
    create: {
      id: 'notificacao-2',
      tipo: 'entrega',
      titulo: '📦 Pedido entregue!',
      mensagem: `Seu pedido ${pedido1.numero} foi entregue com sucesso.`,
      lida: true,
      userId: user1.id,
    },
  });

  await prisma.notificacao.upsert({
    where: { id: 'notificacao-3' },
    update: {},
    create: {
      id: 'notificacao-3',
      tipo: 'sistema',
      titulo: '✨ Bem-vindo à Loja!',
      mensagem: 'Obrigado por se cadastrar. Explore nossos produtos!',
      lida: false,
      userId: user2.id,
    },
  });

  await prisma.notificacao.upsert({
    where: { id: 'notificacao-4' },
    update: {},
    create: {
      id: 'notificacao-4',
      tipo: 'promo',
      titulo: '💎 Oferta Especial!',
      mensagem: 'Vestido Longo Plissado com 25% OFF! Aproveite essa oportunidade única.',
      lida: false,
      userId: user2.id,
    },
  });

  console.log('✅ Notificações criadas');

  // ========================================
  // REFRESH TOKENS
  // ========================================

  await prisma.refreshToken.upsert({
    where: { token: 'sample_refresh_token_for_joao' },
    update: {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      token: 'sample_refresh_token_for_joao',
      userId: user1.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked: false,
    },
  });

  console.log('✅ Refresh token criado');

  console.log('🎉 Seeding finalizado com sucesso!');

  return {
    users: { user1, user2, admin },
    produtos: {
      produto1, produto2, produto3, produto4,
      produto5, produto6, produto7, produto8,
    },
    pedidos: { pedido1 },
  };
}

seedDatabase()
  .catch((e) => {
    console.error('❌ Erro durante seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });