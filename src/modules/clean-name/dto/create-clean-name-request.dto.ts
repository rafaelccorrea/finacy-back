import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class CreateCleanNameRequestDto {
  @ApiProperty({ example: 'João da Silva', description: 'Nome completo da pessoa' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  personName: string;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF da pessoa' })
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, { message: 'CPF inválido' })
  cpf: string;
}
