import { Controller, Get } from "@nestjs/common";

import { Public } from "../../common/decorators/public.decorator.js";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  public getHealth() {
    return {
      status: "ok",
      service: "acars-service",
      timestamp: new Date().toISOString(),
    };
  }
}
