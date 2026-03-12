import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CleanNameService } from './clean-name.service';
import { CleanNameController } from './clean-name.controller';
import { AutentiqueService } from './autentique.service';
import { CleanNameRequest } from './entities/clean-name-request.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Document } from '../documents/entities/document.entity';
import { DocumentsService } from '../documents/documents.service';
import { S3Service } from '../../config/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CleanNameRequest, Subscription, Document]),
  ],
  controllers: [CleanNameController],
  providers: [CleanNameService, AutentiqueService, DocumentsService, S3Service],
  exports: [CleanNameService, AutentiqueService],
})
export class CleanNameModule {}
