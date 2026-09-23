import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  ValidateNested,
  IsObject,
  Matches,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// ─────────────────────────────────────────────────────────────
// ENDEREÇO
// ─────────────────────────────────────────────────────────────
export class EnderecoDto {
  @IsString({ message: 'Rua é obrigatória' })
  rua: string;

  @IsString({ message: 'Número é obrigatório' })
  numero: string;

  @IsOptional()
  @IsString({ message: 'Complemento deve ser texto' })
  complemento?: string;

  @IsString({ message: 'Bairro é obrigatório' })
  bairro: string;

  @IsString({ message: 'Cidade é obrigatória' })
  cidade: string;

  @Length(2, 2, { message: 'Estado deve ter 2 letras (sigla UF)' })
  @Matches(/^[A-Z]{2}$/, { message: 'Estado deve ser a sigla em maiúsculas (ex: SP)' })
  estado: string;

  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido (use 00000-000)' })
  cep: string;
}

// ─────────────────────────────────────────────────────────────
// CREATE — sem `role` (usuário criado sempre é USER)
// ─────────────────────────────────────────────────────────────
export class CreateUserDto {
  @IsString({ message: 'Nome deve ser uma string' })
  nome: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF inválido (use 000.000.000-00 ou 11 dígitos)',
  })
  cpf: string;

  @IsString({ message: 'Senha deve ser uma string' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  senha: string;

  @ValidateNested()
  @Type(() => EnderecoDto)
  @IsObject({ message: 'Endereço deve ser um objeto válido' })
  endereco: EnderecoDto;
}

// ─────────────────────────────────────────────────────────────
// UPDATE — role só editável por admin (checado no service)
// ─────────────────────────────────────────────────────────────
export class UpdateUserDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @IsOptional()
  nome?: string;

  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF inválido',
  })
  @IsOptional()
  cpf?: string;

  @IsString({ message: 'Senha deve ser uma string' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @IsOptional()
  senha?: string;

  @ValidateNested()
  @Type(() => EnderecoDto)
  @IsObject({ message: 'Endereço deve ser um objeto válido' })
  @IsOptional()
  endereco?: EnderecoDto;

  @IsEnum(UserRole, { message: 'Role deve ser USER ou ADMIN' })
  @IsOptional()
  role?: UserRole;
}

// ─────────────────────────────────────────────────────────────
// RESPONSE
// ─────────────────────────────────────────────────────────────
export class UserResponseDto {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  role: UserRole;
  endereco: EnderecoDto;
  createdAt: Date;
  updatedAt: Date;

  constructor(user: any) {
    this.id = user.id;
    this.nome = user.nome;
    this.email = user.email;
    this.cpf = user.cpf;
    this.role = user.role;
    this.endereco =
      typeof user.endereco === 'string'
        ? JSON.parse(user.endereco)
        : (user.endereco as EnderecoDto);
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}

export class UserDetailResponseDto extends UserResponseDto {
  pedidosTotal: number;
  carrinhoTotal: number;
  notificacoesNaoLidas: number;

  constructor(
    user: any,
    pedidosTotal: number = 0,
    carrinhoTotal: number = 0,
    notificacoesNaoLidas: number = 0,
  ) {
    super(user);
    this.pedidosTotal = pedidosTotal;
    this.carrinhoTotal = carrinhoTotal;
    this.notificacoesNaoLidas = notificacoesNaoLidas;
  }
}