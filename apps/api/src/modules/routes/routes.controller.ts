import { Controller, Dependencies, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator.js";
import { RoutesService } from "./routes.service.js";

@ApiTags("routes")
@Public()
@Controller("routes")
@Dependencies(RoutesService)
export class RoutesController {
  public constructor(private readonly routesService: RoutesService) {}

  @Get()
  public listRoutes() {
    return this.routesService.findAll();
  }

  @Get(":code")
  public getRoute(@Param("code") code: string) {
    return this.routesService.findByCode(code);
  }
}
