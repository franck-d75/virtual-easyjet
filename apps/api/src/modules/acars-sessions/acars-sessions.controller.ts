import { Body, Controller, Dependencies, Get, Param, Post } from "@nestjs/common";

import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AcarsSessionsService } from "./acars-sessions.service.js";
import { CompleteSessionDto } from "./dto/complete-session.dto.js";
import { CreateSessionDto } from "./dto/create-session.dto.js";
import { IngestTelemetryDto } from "./dto/ingest-telemetry.dto.js";

@Controller("acars/sessions")
@Dependencies(AcarsSessionsService)
export class AcarsSessionsController {
  public constructor(
    private readonly acarsSessionsService: AcarsSessionsService,
  ) {}

  @Post()
  public createSession(
    @Body() payload: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acarsSessionsService.createSession(user, payload);
  }

  @Get(":id")
  public getSession(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acarsSessionsService.findById(id, user);
  }

  @Post(":id/telemetry")
  public ingestTelemetry(
    @Param("id") id: string,
    @Body() payload: IngestTelemetryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acarsSessionsService.ingestTelemetry(id, user, payload);
  }

  @Post(":id/complete")
  public completeSession(
    @Param("id") id: string,
    @Body() payload: CompleteSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.acarsSessionsService.completeSession(id, user, payload);
  }
}
