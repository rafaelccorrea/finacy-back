import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Plan } from '../plans/entities/plan.entity';
import { CleanNameRequest } from '../clean-name/entities/clean-name-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription, Payment, Plan, CleanNameRequest]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
