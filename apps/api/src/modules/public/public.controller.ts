import { Controller, Dependencies, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { PublicService } from "./public.service.js";

@ApiTags("public")
@Public()
@Controller("public")
@Dependencies(PublicService)
export class PublicController {
  public constructor(private readonly publicService: PublicService) {}

  @Get("home")
  public home() {
    return this.publicService.getHome();
  }

  @Get("stats")
  public stats() {
    return this.publicService.getStats();
  }
}

