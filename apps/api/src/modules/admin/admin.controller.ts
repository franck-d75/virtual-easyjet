import {
  Body,
  Controller,
  Delete,
  Dependencies,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthenticatedUser } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { AdminGuard } from "../../common/guards/admin.guard.js";
import {
  assertValidAvatarFile,
  type UploadedAvatarFile,
} from "../../common/storage/avatar-upload.constants.js";
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

  @Get("airports")
  public listAirports() {
    return this.adminService.listAirports();
  }

  @Post("reference-data/aircraft-types/init")
  public initializeAircraftTypeReferenceData(
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.initializeAircraftTypeReferenceData(currentUser);
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

  @Post("users/:id/avatar")
  @UseInterceptors(FileInterceptor("file"))
  public uploadUserAvatar(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
  ) {
    assertValidAvatarFile(file);
    return this.adminService.updateUserAvatar(id, file, currentUser);
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
  public createAircraft(
    @Body() payload: CreateAdminAircraftDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.createAircraft(payload, currentUser);
  }

  @Patch("aircraft/:id")
  public updateAircraft(
    @Param("id") id: string,
    @Body() payload: UpdateAdminAircraftDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.updateAircraft(id, payload, currentUser);
  }

  @Delete("aircraft/:id")
  public deleteAircraft(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.deleteAircraft(id, currentUser);
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
  public createHub(
    @Body() payload: CreateAdminHubDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.createHub(payload, currentUser);
  }

  @Patch("hubs/:id")
  public updateHub(
    @Param("id") id: string,
    @Body() payload: UpdateAdminHubDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.updateHub(id, payload, currentUser);
  }

  @Delete("hubs/:id")
  public deleteHub(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.deleteHub(id, currentUser);
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
  public createRoute(
    @Body() payload: CreateAdminRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.createRoute(payload, currentUser);
  }

  @Patch("routes/:id")
  public updateRoute(
    @Param("id") id: string,
    @Body() payload: UpdateAdminRouteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.updateRoute(id, payload, currentUser);
  }

  @Delete("routes/:id")
  public deleteRoute(
    @Param("id") id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.adminService.deleteRoute(id, currentUser);
  }
}
