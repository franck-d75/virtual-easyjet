import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { RanksService } from "./ranks.service.js";

@ApiTags("ranks")
@ApiBearerAuth()
@Controller("ranks")
@Dependencies(RanksService)
export class RanksController {
  public constructor(private readonly ranksService: RanksService) {}

  @Get()
  public listRanks() {
    return this.ranksService.findAll();
  }

  @Get(":code")
  public getRank(@Param("code") code: string) {
    return this.ranksService.findByCode(code);
  }
}
