import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

import { hashSecurityValue } from "../../common/security/request-client.utils.js";

type AttemptBucket = {
  failures: number[];
  blockedUntil: number | null;
};

const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_BLOCK_DURATION_MS = 15 * 60_000;

@Injectable()
export class AuthBruteforceService {
  private readonly buckets = new Map<string, AttemptBucket>();

  public assertCanAttemptLogin(ip: string, identifier: string): void {
    const key = this.getKey(ip, identifier);
    const bucket = this.pruneBucket(this.buckets.get(key), Date.now());

    if (!bucket?.blockedUntil || bucket.blockedUntil <= Date.now()) {
      return;
    }

    const retryAfterSeconds = Math.max(
      Math.ceil((bucket.blockedUntil - Date.now()) / 1_000),
      1,
    );

    console.warn("[security] login temporarily blocked", {
      ipHash: hashSecurityValue(ip),
      identifierHash: hashSecurityValue(identifier.trim().toLowerCase()),
      retryAfterSeconds,
    });

    throw new HttpException(
      {
        statusCode: 429,
        message:
          "Trop de tentatives de connexion. Réessayez dans quelques instants.",
        error: "Too Many Requests",
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  public registerFailure(ip: string, identifier: string): void {
    const key = this.getKey(ip, identifier);
    const now = Date.now();
    const bucket = this.pruneBucket(this.buckets.get(key), now) ?? {
      failures: [],
      blockedUntil: null,
    };

    bucket.failures.push(now);

    if (bucket.failures.length >= LOGIN_FAILURE_LIMIT) {
      bucket.blockedUntil = now + LOGIN_BLOCK_DURATION_MS;

      console.warn("[security] login blocked after repeated failures", {
        ipHash: hashSecurityValue(ip),
        identifierHash: hashSecurityValue(identifier.trim().toLowerCase()),
        blockedForSeconds: Math.floor(LOGIN_BLOCK_DURATION_MS / 1_000),
      });
    }

    this.buckets.set(key, bucket);
  }

  public registerSuccess(ip: string, identifier: string): void {
    this.buckets.delete(this.getKey(ip, identifier));
  }

  private getKey(ip: string, identifier: string): string {
    return `${ip}:${identifier.trim().toLowerCase()}`;
  }

  private pruneBucket(
    bucket: AttemptBucket | undefined,
    now: number,
  ): AttemptBucket | undefined {
    if (!bucket) {
      return undefined;
    }

    const failures = bucket.failures.filter(
      (timestamp) => timestamp > now - LOGIN_FAILURE_WINDOW_MS,
    );
    const blockedUntil =
      bucket.blockedUntil && bucket.blockedUntil > now ? bucket.blockedUntil : null;

    if (failures.length === 0 && blockedUntil === null) {
      return undefined;
    }

    return {
      failures,
      blockedUntil,
    };
  }
}
