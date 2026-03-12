import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../../common/enums';

export class CreatePaymentDto {
  @ApiProperty({ description: 'ID do plano', example: 'uuid-do-plano' })
  @IsUUID()
  planId: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Método de pagamento' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
