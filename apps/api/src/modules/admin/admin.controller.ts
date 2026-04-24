import {
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import { AdminService } from "./admin.service.js";
import {
  CreateAdminAircraftDto,
  CreateAdminHubDto,
  CreateAdminRouteDto,
  UpdateAdminUserDto,
  UpdateAdminAircraftDto,
  UpdateAdminHubDto,
  UpdateAdminRouteDto,
} from "./dto/admin.dto.js";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin")
@Dependencies(AdminService)
export class AdminController {
  public constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  public getStats() {
    return this.adminService.getStats();
  }

  @Get("reference-data")
  public getReferenceData() {
    return this.adminService.getReferenceData();
  }

  @Get("users")
  public listUsers() {
    return this.adminService.listUsers();
  }

  @Get("users/:id")
  public getUser(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Patch("users/:id")
  public updateUser(
    @Param("id") id: string,
    @Body() payload: UpdateAdminUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.updateUser(id, payload, currentUser);
  }

  @Patch("users/:id/suspend")
  public suspendUser(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.suspendUser(id, currentUser);
  }

  @Patch("users/:id/activate")
  public activateUser(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.activateUser(id, currentUser);
  }

  @Get("aircraft")
  public listAircraft() {
    return this.adminService.listAircraft();
  }

  @Get("aircraft/:id")
  public getAircraft(@Param("id") id: string) {
    return this.adminService.getAircraft(id);
  }

  @Post("aircraft")
  public createAircraft(@Body() payload: CreateAdminAircraftDto) {
    return this.adminService.createAircraft(payload);
  }

  @Patch("aircraft/:id")
  public updateAircraft(
    @Param("id") id: string,
    @Body() payload: UpdateAdminAircraftDto,
  ) {
    return this.adminService.updateAircraft(id, payload);
  }

  @Delete("aircraft/:id")
  public deleteAircraft(@Param("id") id: string) {
    return this.adminService.deleteAircraft(id);
  }

  @Get("hubs")
  public listHubs() {
    return this.adminService.listHubs();
  }

  @Get("hubs/:id")
  public getHub(@Param("id") id: string) {
    return this.adminService.getHub(id);
  }

  @Post("hubs")
  public createHub(@Body() payload: CreateAdminHubDto) {
    return this.adminService.createHub(payload);
  }

  @Patch("hubs/:id")
  public updateHub(@Param("id") id: string, @Body() payload: UpdateAdminHubDto) {
    return this.adminService.updateHub(id, payload);
  }

  @Delete("hubs/:id")
  public deleteHub(@Param("id") id: string) {
    return this.adminService.deleteHub(id);
  }

  @Get("routes")
  public listRoutes() {
    return this.adminService.listRoutes();
  }

  @Get("routes/:id")
  public getRoute(@Param("id") id: string) {
    return this.adminService.getRoute(id);
  }

  @Post("routes")
  public createRoute(@Body() payload: CreateAdminRouteDto) {
    return this.adminService.createRoute(payload);
  }

  @Patch("routes/:id")
  public updateRoute(
    @Param("id") id: string,
    @Body() payload: UpdateAdminRouteDto,
  ) {
    return this.adminService.updateRoute(id, payload);
  }

  @Delete("routes/:id")
  public deleteRoute(@Param("id") id: string) {
    return this.adminService.deleteRoute(id);
  }
}
