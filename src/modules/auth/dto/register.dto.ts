import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva', description: 'Nome completo do usuário' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'joao@email.com', description: 'E-mail do usuário' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: '123.456.789-00', description: 'CPF do usuário' })
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF inválido',
  })
  cpf: string;

  @ApiProperty({ example: '(11) 99999-9999', description: 'Telefone do usuário' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'Senha@123',
    description: 'Senha com mínimo 8 caracteres, letras maiúsculas, minúsculas, números e símbolos',
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Senha deve conter pelo menos 8 caracteres, uma letra maiúscula, uma minúscula, um número e um símbolo especial',
    },
  )
  password: string;
}
