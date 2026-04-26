import { Controller, Dependencies, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { AcarsLiveService } from "../acars-live/acars-live.service.js";

@ApiTags("public")
@Public()
@Controller("public/acars")
@Dependencies(AcarsLiveService)
export class PublicAcarsController {
  public constructor(private readonly acarsLiveService: AcarsLiveService) {}

  @Get("live")
  public liveTraffic() {
    return this.acarsLiveService.listLiveFlights();
  }
}
