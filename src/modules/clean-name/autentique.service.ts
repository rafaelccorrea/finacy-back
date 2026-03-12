import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface AutentiqueSignatory {
  email: string;
  name: string;
  action?: 'SIGN' | 'APPROVE' | 'WITNESS';
}

export interface AutentiqueDocument {
  id: string;
  name: string;
  status: string;
  created_at: string;
  signatures?: AutentiqueSignature[];
  files?: { original?: string; signed?: string };
}

export interface AutentiqueSignature {
  public_id: string;
  name: string;
  email: string;
  signed: boolean;
  signed_at?: string;
  link?: string;
}

export interface CreateDocumentResult {
  documentId: string;
  signatoryLink?: string;
  documentUrl?: string;
  status: string;
}

@Injectable()
export class AutentiqueService {
  private readonly logger = new Logger(AutentiqueService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('AUTENTIQUE_API_KEY') || '';
    this.apiUrl =
      this.configService.get<string>('AUTENTIQUE_API_URL') ||
      'https://api.autentique.com.br/v2';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Envia um documento para assinatura via Autentique usando GraphQL
   */
  async createSignatureDocument(
    documentName: string,
    fileBase64: string,
    signatories: AutentiqueSignatory[],
    metadata?: Record<string, string>,
  ): Promise<CreateDocumentResult> {
    if (!this.apiKey || this.apiKey === 'placeholder_autentique_key') {
      this.logger.warn('Autentique API key não configurada — retornando mock');
      return {
        documentId: `mock_${Date.now()}`,
        signatoryLink: undefined,
        documentUrl: undefined,
        status: 'pending',
      };
    }

    try {
      const mutation = `
        mutation CreateDocument(
          $document: DocumentInput!
          $signatories: [SignatoryInput!]!
        ) {
          createDocument(document: $document, signatories: $signatories) {
            id
            name
            created_at
            signatures {
              public_id
              name
              email
              signed
              link {
                short_link
              }
            }
            files {
              original
            }
          }
        }
      `;

      const variables = {
        document: {
          name: documentName,
          content_base64: fileBase64,
          ...(metadata ? { message: JSON.stringify(metadata) } : {}),
        },
        signatories: signatories.map((s) => ({
          email: s.email,
          name: s.name,
          action: s.action || 'SIGN',
        })),
      };

      const response = await this.client.post('/graphql', {
        query: mutation,
        variables,
      });

      const doc = response.data?.data?.createDocument;
      if (!doc) {
        throw new Error('Resposta inválida da API Autentique');
      }

      const firstSignatory = doc.signatures?.[0];

      this.logger.log(`Documento criado no Autentique: ${doc.id}`);

      return {
        documentId: doc.id,
        signatoryLink: firstSignatory?.link?.short_link,
        documentUrl: doc.files?.original,
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Erro ao criar documento no Autentique: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consulta o status de um documento no Autentique
   */
  async getDocumentStatus(documentId: string): Promise<AutentiqueDocument | null> {
    if (!this.apiKey || this.apiKey === 'placeholder_autentique_key') {
      return null;
    }

    try {
      const query = `
        query GetDocument($id: UUID!) {
          document(id: $id) {
            id
            name
            created_at
            signatures {
              public_id
              name
              email
              signed
              signed_at
              link {
                short_link
              }
            }
            files {
              original
              signed
            }
          }
        }
      `;

      const response = await this.client.post('/graphql', {
        query,
        variables: { id: documentId },
      });

      return response.data?.data?.document || null;
    } catch (error) {
      this.logger.error(`Erro ao consultar documento Autentique ${documentId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Processa o payload do webhook Autentique
   */
  processWebhookEvent(payload: any): {
    event: string;
    documentId: string;
    signerEmail?: string;
    signedAt?: string;
    allSigned?: boolean;
  } {
    // Autentique envia diferentes formatos dependendo do evento
    const event = payload?.event || payload?.type || 'unknown';
    const documentId =
      payload?.document?.id ||
      payload?.data?.document?.id ||
      payload?.id ||
      '';

    const signerEmail =
      payload?.signature?.email ||
      payload?.data?.signature?.email ||
      payload?.signer?.email;

    const signedAt =
      payload?.signature?.signed_at ||
      payload?.data?.signature?.signed_at ||
      payload?.signed_at;

    const allSigned =
      payload?.document?.all_signed ||
      payload?.data?.document?.all_signed ||
      false;

    this.logger.log(`Webhook Autentique recebido: evento=${event}, doc=${documentId}`);

    return { event, documentId, signerEmail, signedAt, allSigned };
  }
}
