import { Module, OnModuleInit, Logger } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PlansService } from "./plans.service";
import { PlansController } from "./plans.controller";
import { Plan } from "./entities/plan.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Plan])],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule implements OnModuleInit {
  private readonly logger = new Logger(PlansModule.name);

  constructor(private readonly plansService: PlansService) {}

  async onModuleInit() {
    try {
      const plans = await this.plansService.findAll();
      if (plans.length === 0) {
        await this.plansService.seed();
        this.logger.log("Planos padrao criados automaticamente no startup.");
      }
    } catch (error) {
      this.logger.warn("Nao foi possivel verificar/criar planos no startup: " + error.message);
    }
  }
}
