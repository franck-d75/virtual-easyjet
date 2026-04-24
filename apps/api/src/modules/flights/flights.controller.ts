import { Body, Controller, Dependencies, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CompleteFlightDto } from "./dto/complete-flight.dto.js";
import { CreateFlightDto } from "./dto/create-flight.dto.js";
import { FlightsService } from "./flights.service.js";

@ApiTags("flights")
@ApiBearerAuth()
@Controller("flights")
@Dependencies(FlightsService)
export class FlightsController {
  public constructor(private readonly flightsService: FlightsService) {}

  @Get("me")
  public listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.flightsService.listMine(user);
  }

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get()
  public listAll() {
    return this.flightsService.listAll();
  }

  @Get(":id")
  public getFlight(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flightsService.findById(id, user);
  }

  @Post()
  public createFlight(
    @Body() payload: CreateFlightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flightsService.create(user, payload);
  }

  @Post(":id/abort")
  public abortFlight(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flightsService.abort(id, user);
  }

  @Post(":id/complete")
  public completeFlight(
    @Param("id") id: string,
    @Body() payload: CompleteFlightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flightsService.complete(id, user, payload);
  }
}

