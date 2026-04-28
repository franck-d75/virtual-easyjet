import { Controller, Dependencies, Get } from "@nestjs/common";

import { Public } from "../../common/decorators/public.decorator.js";
import { AcarsLiveService } from "./acars-live.service.js";

@Public()
@Controller("live")
@Dependencies(AcarsLiveService)
export class AcarsLiveController {
  public constructor(private readonly acarsLiveService: AcarsLiveService) {}

  @Get()
  public listLiveFlights() {
    return this.acarsLiveService.listLiveFlights();
  }
}
