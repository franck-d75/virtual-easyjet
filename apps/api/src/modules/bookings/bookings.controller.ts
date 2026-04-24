import { Body, Controller, Dependencies, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedUser } from "@va/shared";
import { ROLE_CODES } from "@va/shared";

import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { BookingsService } from "./bookings.service.js";
import { CreateBookingDto } from "./dto/create-booking.dto.js";

@ApiTags("bookings")
@ApiBearerAuth()
@Controller("bookings")
@Dependencies(BookingsService)
export class BookingsController {
  public constructor(private readonly bookingsService: BookingsService) {}

  @Get("me")
  public listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.listMine(user);
  }

  @Roles(ROLE_CODES.ADMIN, ROLE_CODES.STAFF)
  @Get()
  public listAll() {
    return this.bookingsService.listAll();
  }

  @Get(":id")
  public getBooking(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.findById(id, user);
  }

  @Post()
  public createBooking(
    @Body() payload: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.create(user, payload);
  }

  @Post(":id/cancel")
  public cancelBooking(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancel(id, user);
  }
}

