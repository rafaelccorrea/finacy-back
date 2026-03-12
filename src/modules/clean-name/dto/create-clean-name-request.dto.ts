import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Matches,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DebtType {
  CREDIT_CARD = 'cartao_credito',
  PERSONAL_LOAN = 'emprestimo_pessoal',
  BANK_LOAN = 'financiamento',
  UTILITY = 'conta_servico',
  RETAIL = 'loja_varejo',
  OTHER = 'outro',
}

export class DebtItemDto {
  @ApiProperty({ example: 'Banco XYZ', description: 'Nome do credor' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  creditorName: string;

  @ApiPropertyOptional({ example: 1500.0, description: 'Valor da dívida' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ enum: DebtType, description: 'Tipo da dívida' })
  @IsOptional()
  @IsEnum(DebtType)
  debtType?: DebtType;

  @ApiPropertyOptional({ example: 'Conta em atraso desde jan/2024' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateCleanNameRequestDto {
  @ApiProperty({ example: 'João da Silva', description: 'Nome completo da pessoa' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  personName: string;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF da pessoa (com ou sem máscara)' })
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'CPF inválido' })
  cpf: string;

  @ApiPropertyOptional({ example: '(11) 99999-9999', description: 'Telefone de contato' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123, São Paulo - SP' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 5000.0, description: 'Valor total das dívidas' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDebtAmount?: number;

  @ApiPropertyOptional({ type: [DebtItemDto], description: 'Lista de dívidas detalhadas' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DebtItemDto)
  debts?: DebtItemDto[];

  @ApiPropertyOptional({ description: 'ID do documento enviado (CNH, RG, CPF)' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Observações adicionais' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
