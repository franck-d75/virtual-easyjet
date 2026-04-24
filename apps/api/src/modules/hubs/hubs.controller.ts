import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { HubsService } from "./hubs.service.js";

@ApiTags("hubs")
@Public()
@Controller("hubs")
@Dependencies(HubsService)
export class HubsController {
  public constructor(private readonly hubsService: HubsService) {}

  @Get()
  public listHubs() {
    return this.hubsService.findAll();
  }

  @Get(":code")
  public getHub(@Param("code") code: string) {
    return this.hubsService.findByCode(code);
  }
}

