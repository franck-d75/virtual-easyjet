import { BadRequestException } from "@nestjs/common";

export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT_ATTRIBUTE = AVATAR_ALLOWED_MIME_TYPES.join(",");

export type UploadedAvatarFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export function assertValidAvatarFile(
  file: UploadedAvatarFile | undefined | null,
): asserts file is UploadedAvatarFile {
  if (!file) {
    throw new BadRequestException(
      "Veuillez sélectionner une image PNG, JPG, JPEG ou WebP.",
    );
  }

  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
    throw new BadRequestException(
      "Le format de l'avatar doit être PNG, JPG, JPEG ou WebP.",
    );
  }

  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException("L'avatar ne doit pas dépasser 2 Mo.");
  }
}

export function getAvatarFileExtension(mimetype: string): string {
  switch (mimetype) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}
