import { Controller, Dependencies, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Public } from "../../common/decorators/public.decorator.js";
import type { AcarsEnvironment } from "../../config/env.js";

@Controller("health")
@Dependencies(ConfigService)
export class HealthController {
  public constructor(
    private readonly configService: ConfigService<AcarsEnvironment, true>,
  ) {}

  @Public()
  @Get()
  public getHealth() {
    return {
      status: "ok",
      service: "acars-service",
      timestamp: new Date().toISOString(),
      thresholds: {
        resumeTimeoutMinutes: this.configService.get(
          "ACARS_RESUME_TIMEOUT_MINUTES",
          {
            infer: true,
          },
        ),
        overspeedGraceSeconds: this.configService.get(
          "ACARS_OVERSPEED_GRACE_SECONDS",
          {
            infer: true,
          },
        ),
        hardLandingThresholdFpm: this.configService.get(
          "ACARS_HARD_LANDING_THRESHOLD_FPM",
          {
            infer: true,
          },
        ),
      },
    };
  }
}
