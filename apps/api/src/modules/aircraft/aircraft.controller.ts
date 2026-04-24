import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { AircraftService } from "./aircraft.service.js";

@ApiTags("aircraft")
@Public()
@Controller("aircraft")
@Dependencies(AircraftService)
export class AircraftController {
  public constructor(private readonly aircraftService: AircraftService) {}

  @Get()
  public listAircraft() {
    return this.aircraftService.findAll();
  }

  @Get(":registration")
  public getAircraft(@Param("registration") registration: string) {
    return this.aircraftService.findByRegistration(registration);
  }
}
