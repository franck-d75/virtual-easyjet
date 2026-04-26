import {
  Dependencies,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

import type { ApiEnvironment } from "../../config/env.js";
import {
  getAvatarFileExtension,
  type UploadedAvatarFile,
} from "./avatar-upload.constants.js";

@Injectable()
@Dependencies(ConfigService)
export class AvatarStorageService {
  public constructor(
    private readonly configService: ConfigService<ApiEnvironment, true>,
  ) {}

  public async uploadUserAvatar(
    userId: string,
    file: UploadedAvatarFile,
  ): Promise<string> {
    const token =
      this.configService.get("BLOB_READ_WRITE_TOKEN", { infer: true }) ??
      process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      const nodeEnv =
        this.configService.get("NODE_ENV", { infer: true }) ?? process.env.NODE_ENV;

      if (nodeEnv !== "production") {
        const base64Payload = file.buffer.toString("base64");
        return `data:${file.mimetype};base64,${base64Payload}`;
      }

      throw new ServiceUnavailableException(
        "Le stockage des avatars n'est pas configuré.",
      );
    }

    const extension = getAvatarFileExtension(file.mimetype);
    const pathname = `avatars/users/${userId}/${Date.now()}-${randomUUID()}.${extension}`;
    const blobBody = Uint8Array.from(file.buffer);
    const blob = await put(
      pathname,
      new Blob([blobBody], { type: file.mimetype }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: file.mimetype,
        token,
      },
    );

    return blob.url;
  }
}
