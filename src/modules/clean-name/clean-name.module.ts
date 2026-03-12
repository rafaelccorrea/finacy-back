import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CleanNameService } from './clean-name.service';
import { CleanNameController } from './clean-name.controller';
import { CleanNameRequest } from './entities/clean-name-request.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CleanNameRequest, Subscription])],
  controllers: [CleanNameController],
  providers: [CleanNameService],
  exports: [CleanNameService],
})
export class CleanNameModule {}
