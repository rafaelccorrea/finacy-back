import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CleanNameRequest } from './entities/clean-name-request.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Document } from '../documents/entities/document.entity';
import { CleanNameRequestStatus, SubscriptionStatus } from '../../common/enums';
import { CreateCleanNameRequestDto } from './dto/create-clean-name-request.dto';
import { AutentiqueService } from './autentique.service';

@Injectable()
export class CleanNameService {
  private readonly logger = new Logger(CleanNameService.name);

  constructor(
    @InjectRepository(CleanNameRequest)
    private readonly cleanNameRepository: Repository<CleanNameRequest>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly autentiqueService: AutentiqueService,
  ) {}

  async createRequest(userId: string, dto: CreateCleanNameRequestDto) {
    // Verificar assinatura ativa com créditos disponíveis
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new ForbiddenException(
        'Você precisa de uma assinatura ativa para solicitar limpeza de nome.',
      );
    }

    if (!subscription.hasCredits()) {
      throw new ForbiddenException(
        'Créditos de Limpa Nome esgotados. Faça upgrade do seu plano.',
      );
    }

    // Normalizar CPF (remover máscara)
    const cpfClean = dto.cpf.replace(/[^\d]/g, '');

    // Verificar duplicata de CPF em solicitações pendentes
    const existingRequest = await this.cleanNameRepository.findOne({
      where: {
        userId,
        cpf: cpfClean,
        status: CleanNameRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        'Já existe uma solicitação em andamento para este CPF.',
      );
    }

    // Verificar documento se informado
    if (dto.documentId) {
      const doc = await this.documentRepository.findOne({
        where: { id: dto.documentId, userId },
      });
      if (!doc) {
        throw new BadRequestException(
          'Documento não encontrado ou não pertence ao usuário.',
        );
      }
    }

    const request = this.cleanNameRepository.create({
      userId,
      personName: dto.personName,
      cpf: cpfClean,
      status: CleanNameRequestStatus.PENDING,
      totalDebtAmount: dto.totalDebtAmount,
      debtDetails: dto.debts || [],
      documentId: dto.documentId,
      notes: dto.notes,
      metadata: {
        requestedAt: new Date().toISOString(),
        phone: dto.phone,
        address: dto.address,
      },
    });

    await this.cleanNameRepository.save(request);

    // Decrementar créditos
    await this.subscriptionRepository.update(subscription.id, {
      cleanNameCreditsUsed: subscription.cleanNameCreditsUsed + 1,
    });

    // Disparar envio para Autentique de forma assíncrona
    this.sendToAutentique(request.id, dto.personName, cpfClean).catch((err) =>
      this.logger.error(`Falha ao enviar para Autentique: ${err.message}`),
    );

    return request;
  }

  /**
   * Envia o contrato de negociação para assinatura no Autentique
   */
  private async sendToAutentique(
    requestId: string,
    personName: string,
    cpf: string,
  ): Promise<void> {
    try {
      const cpfFormatted = cpf.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        '$1.$2.$3-$4',
      );

      const contractContent = [
        `CONTRATO DE NEGOCIAÇÃO DE DÍVIDAS`,
        ``,
        `Solicitante: ${personName}`,
        `CPF: ${cpfFormatted}`,
        `Data: ${new Date().toLocaleDateString('pt-BR')}`,
        ``,
        `Ao assinar este documento, o solicitante autoriza a Finacy a negociar`,
        `em seu nome junto aos credores listados na solicitação de Limpa Nome.`,
        ``,
        `ID da Solicitação: ${requestId}`,
      ].join('\n');

      const fileBase64 = Buffer.from(contractContent).toString('base64');

      const result = await this.autentiqueService.createSignatureDocument(
        `Contrato Limpa Nome - ${personName}`,
        fileBase64,
        [
          {
            email: `${cpf}@finacy.internal`,
            name: personName,
            action: 'SIGN',
          },
        ],
        { requestId },
      );

      // Atualizar a solicitação com os dados do Autentique
      const current = await this.cleanNameRepository.findOne({
        where: { id: requestId },
      });

      if (current) {
        current.metadata = {
          ...(current.metadata || {}),
          autentiqueDocumentId: result.documentId,
          autentiqueSignatoryLink: result.signatoryLink,
          autentiqueStatus: result.status,
        };
        await this.cleanNameRepository.save(current);
      }

      this.logger.log(
        `Contrato enviado para Autentique: doc=${result.documentId}, req=${requestId}`,
      );
    } catch (error) {
      this.logger.error(`Erro ao enviar para Autentique: ${error.message}`);
    }
  }

  /**
   * Processa webhook do Autentique
   */
  async processAutentiqueWebhook(payload: any): Promise<{ received: boolean }> {
    const event = this.autentiqueService.processWebhookEvent(payload);

    if (!event.documentId) {
      this.logger.warn('Webhook Autentique sem documentId');
      return { received: true };
    }

    // Buscar solicitação pelo autentiqueDocumentId no metadata
    const requests = await this.cleanNameRepository
      .createQueryBuilder('req')
      .where(`req.metadata->>'autentiqueDocumentId' = :docId`, {
        docId: event.documentId,
      })
      .getMany();

    if (!requests.length) {
      this.logger.warn(
        `Nenhuma solicitação encontrada para doc Autentique: ${event.documentId}`,
      );
      return { received: true };
    }

    for (const request of requests) {
      const updatedMeta = {
        ...(request.metadata || {}),
        autentiqueEvent: event.event,
        autentiqueSignedAt: event.signedAt,
        autentiqueAllSigned: event.allSigned,
      };

      let newStatus = request.status;
      if (event.allSigned) {
        newStatus = CleanNameRequestStatus.PROCESSING;
      }

      request.status = newStatus;
      request.metadata = updatedMeta;
      await this.cleanNameRepository.save(request);

      this.logger.log(
        `Solicitação ${request.id} atualizada via webhook Autentique: ${event.event}`,
      );
    }

    return { received: true };
  }

  async getUserRequests(userId: string) {
    return this.cleanNameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRequestById(id: string, userId: string) {
    const request = await this.cleanNameRepository.findOne({
      where: { id, userId },
    });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    return request;
  }

  async updateRequestStatus(
    id: string,
    status: CleanNameRequestStatus,
    data?: Partial<CleanNameRequest>,
  ) {
    const request = await this.cleanNameRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    await this.cleanNameRepository.update(id, {
      status,
      ...data,
      processedAt:
        status === CleanNameRequestStatus.COMPLETED ? new Date() : undefined,
    });

    return this.cleanNameRepository.findOne({ where: { id } });
  }

  async getStats(userId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });

    const total = await this.cleanNameRepository.count({ where: { userId } });
    const completed = await this.cleanNameRepository.count({
      where: { userId, status: CleanNameRequestStatus.COMPLETED },
    });
    const pending = await this.cleanNameRepository.count({
      where: { userId, status: CleanNameRequestStatus.PENDING },
    });
    const processing = await this.cleanNameRepository.count({
      where: { userId, status: CleanNameRequestStatus.PROCESSING },
    });

    return {
      total,
      completed,
      pending,
      processing,
      creditsUsed: subscription?.cleanNameCreditsUsed || 0,
      creditsTotal: subscription?.cleanNameCreditsTotal || 0,
      creditsAvailable:
        (subscription?.cleanNameCreditsTotal || 0) -
        (subscription?.cleanNameCreditsUsed || 0),
    };
  }
}
