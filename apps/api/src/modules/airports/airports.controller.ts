import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { AirportsService } from "./airports.service.js";

@ApiTags("airports")
@ApiBearerAuth()
@Controller("airports")
@Dependencies(AirportsService)
export class AirportsController {
  public constructor(private readonly airportsService: AirportsService) {}

  @Get()
  public listAirports() {
    return this.airportsService.findAll();
  }

  @Get(":icao")
  public getAirport(@Param("icao") icao: string) {
    return this.airportsService.findByIcao(icao);
  }
}
