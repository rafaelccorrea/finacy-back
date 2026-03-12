import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditPackage } from './entities/credit-package.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditPackage])],
  exports: [TypeOrmModule],
})
export class CreditPackagesModule {}
