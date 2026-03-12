import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  async findAll() {
    return this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', price: 'ASC' },
    });
  }

  async findOne(id: string) {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  async findBySlug(slug: string) {
    const plan = await this.planRepository.findOne({ where: { slug } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  async seed() {
    const plans = [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Ideal para começar sua jornada financeira',
        price: 97.00,
        cleanNameCredits: 1,
        isPopular: false,
        sortOrder: 1,
        features: {
          cleanName: 1,
          dashboard: true,
          support: 'email',
        },
      },
      {
        name: 'Professional',
        slug: 'professional',
        description: 'Para quem precisa de mais poder',
        price: 297.00,
        cleanNameCredits: 5,
        isPopular: true,
        sortOrder: 2,
        features: {
          cleanName: 5,
          dashboard: true,
          support: 'priority',
          reports: true,
        },
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Solução completa para empresas',
        price: 697.00,
        cleanNameCredits: 20,
        isPopular: false,
        sortOrder: 3,
        features: {
          cleanName: 20,
          dashboard: true,
          support: 'dedicated',
          reports: true,
          api: true,
        },
      },
    ];

    for (const planData of plans) {
      const existing = await this.planRepository.findOne({
        where: { slug: planData.slug },
      });
      if (!existing) {
        await this.planRepository.save(this.planRepository.create(planData));
      }
    }

    return { message: 'Planos criados com sucesso.' };
  }
}
