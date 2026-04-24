import { Controller, Dependencies, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { AcarsLiveService } from "./acars-live.service.js";

@ApiTags("acars-live")
@Public()
@Controller("acars")
@Dependencies(AcarsLiveService)
export class AcarsLiveController {
  public constructor(private readonly acarsLiveService: AcarsLiveService) {}

  @Get("live")
  public listLiveFlights() {
    return this.acarsLiveService.listLiveFlights();
  }
}
