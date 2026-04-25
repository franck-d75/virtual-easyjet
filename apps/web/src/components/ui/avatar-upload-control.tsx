"use client";

import type { ChangeEvent, JSX } from "react";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

type AvatarUploadControlProps<TResponse> = {
  currentAvatarUrl: string | null;
  displayName: string;
  uploadUrl: string;
  title: string;
  description: string;
  saveLabel?: string;
  onUploaded: (payload: TResponse) => void;
};

type UploadFeedback = {
  tone: "success" | "danger";
  message: string;
};

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export function AvatarUploadControl<TResponse>({
  currentAvatarUrl,
  displayName,
  uploadUrl,
  title,
  description,
  saveLabel = "Enregistrer l'avatar",
  onUploaded,
}: AvatarUploadControlProps<TResponse>): JSX.Element {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<UploadFeedback | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const previewUrl = useMemo(() => {
    if (!selectedFile) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function resetSelection(): void {
    setSelectedFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(nextFile.type)) {
      setFeedback({
        tone: "danger",
        message: "Le format de l'image doit être PNG, JPG, JPEG ou WebP.",
      });
      resetSelection();
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFeedback({
        tone: "danger",
        message: "L'image sélectionnée ne doit pas dépasser 2 Mo.",
      });
      resetSelection();
      return;
    }

    setFeedback(null);
    setSelectedFile(nextFile);
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      setFeedback({
        tone: "danger",
        message: "Sélectionnez une image avant d'enregistrer votre avatar.",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", selectedFile);

    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const rawPayload = await response.text();
      const payload = rawPayload.length > 0 ? parsePayload(rawPayload) : null;

      if (!response.ok) {
        setFeedback({
          tone: "danger",
          message: extractMessage(
            payload,
            "Impossible de téléverser l'avatar pour le moment.",
          ),
        });
        return;
      }

      onUploaded(payload as TResponse);
      setFeedback({
        tone: "success",
        message: "Avatar mis à jour avec succès.",
      });
      resetSelection();

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="avatar-upload-panel">
      <div className="avatar-upload-panel__preview">
        <UserAvatar
          avatarUrl={previewUrl ?? currentAvatarUrl}
          name={displayName}
          size="lg"
        />
        <div>
          <span className="section-eyebrow">Avatar pilote</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className="field">
        <label htmlFor={inputId}>Image de profil</label>
        <input
          accept="image/png,image/jpeg,image/jpg,image/webp"
          id={inputId}
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
      </div>

      <p className="simbrief-card__note">
        Formats acceptés : PNG, JPG, JPEG et WebP. Taille maximale : 2 Mo.
      </p>

      {selectedFile ? (
        <p className="avatar-upload-panel__filename">{selectedFile.name}</p>
      ) : null}

      {feedback ? (
        <p
          className={`inline-feedback inline-feedback--${feedback.tone}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="profile-card__actions">
        <Button
          disabled={isPending || isUploading || !selectedFile}
          onClick={() => void handleUpload()}
        >
          {isUploading || isPending ? "Enregistrement..." : saveLabel}
        </Button>
      </div>
    </section>
  );
}
