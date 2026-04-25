import { Module } from "@nestjs/common";

import { AvatarStorageService } from "./avatar-storage.service.js";

@Module({
  providers: [AvatarStorageService],
  exports: [AvatarStorageService],
})
export class AvatarStorageModule {}
