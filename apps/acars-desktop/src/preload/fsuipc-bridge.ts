import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { DesktopConfig, SimulatorSnapshot, TelemetryInput } from "../shared/types.js";

const REQUEST_TIMEOUT_MS = 8_000;
const STALE_TELEMETRY_MS = 6_500;

const DEFAULT_SIMULATOR_SNAPSHOT: SimulatorSnapshot = {
  status: "UNAVAILABLE",
  telemetryMode: "fsuipc",
  dataSource: "none",
  message: "FSUIPC7 n'est pas detecte pour le moment. Lancez FSUIPC7 avant ACARS.",
  connected: false,
  aircraftDetected: false,
  aircraft: null,
  lastSampleAt: null,
  telemetry: null,
  indicatedAirspeedKts: null,
  error: null,
};

type WorkerLogLine = {
  type: "log";
  level: "info" | "error";
  message: string;
  details?: Record<string, unknown>;
};

type WorkerSnapshotLine = {
  type: "snapshot";
  snapshot: SimulatorSnapshot;
  telemetry: TelemetryInput | null;
};

type SnapshotWaiter = {
  reject: (reason?: unknown) => void;
  resolve: (value: SimulatorSnapshot) => void;
  timeout: ReturnType<typeof setTimeout>;
  telemetryOnly: boolean;
};

function isWorkerLogLine(value: unknown): value is WorkerLogLine {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "log"
  );
}

function isWorkerSnapshotLine(value: unknown): value is WorkerSnapshotLine {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "snapshot"
  );
}

function isFreshTimestamp(value: string | null | undefined, maxAgeMs: number): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= maxAgeMs;
}

export class FsuipcBridge {
  private worker: ChildProcess | null = null;
  private stdoutBuffer = "";
  private snapshot: SimulatorSnapshot = structuredClone(DEFAULT_SIMULATOR_SNAPSHOT);
  private readonly snapshotWaiters = new Set<SnapshotWaiter>();

  public constructor(
    private readonly getConfig: () => DesktopConfig,
    private readonly log: (message: string, details?: Record<string, unknown>) => void,
  ) {}

  public getSnapshot(): SimulatorSnapshot {
    return structuredClone({
      ...this.snapshot,
      telemetryMode: this.getConfig().telemetryMode,
    });
  }

  public async connect(): Promise<SimulatorSnapshot> {
    this.ensureWorker();

    if (
      this.snapshot.connected ||
      this.snapshot.aircraftDetected ||
      isFreshTimestamp(this.snapshot.lastSampleAt, REQUEST_TIMEOUT_MS)
    ) {
      return this.getSnapshot();
    }

    return this.waitForSnapshot(false);
  }

  public async sampleTelemetry(): Promise<TelemetryInput | null> {
    this.ensureWorker();

    if (
      this.snapshot.telemetry &&
      isFreshTimestamp(this.snapshot.lastSampleAt, STALE_TELEMETRY_MS)
    ) {
      return structuredClone(this.snapshot.telemetry);
    }

    const nextSnapshot = await this.waitForSnapshot(true);
    return nextSnapshot.telemetry ? structuredClone(nextSnapshot.telemetry) : null;
  }

  private waitForSnapshot(telemetryOnly: boolean): Promise<SimulatorSnapshot> {
    return new Promise<SimulatorSnapshot>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.snapshotWaiters.delete(waiter);
        reject(
          new Error(
            telemetryOnly
              ? `FSUIPC sample timed out after ${REQUEST_TIMEOUT_MS} ms.`
              : `FSUIPC connect timed out after ${REQUEST_TIMEOUT_MS} ms.`,
          ),
        );
      }, REQUEST_TIMEOUT_MS);

      const waiter: SnapshotWaiter = {
        resolve,
        reject,
        timeout,
        telemetryOnly,
      };

      this.snapshotWaiters.add(waiter);
    });
  }

  private ensureWorker(): ChildProcess {
    if (this.worker && !this.worker.killed) {
      return this.worker;
    }

    const workerPath = fileURLToPath(
      new URL("../../scripts/fsuipc-worker.cjs", import.meta.url),
    );

    if (!existsSync(workerPath)) {
      throw new Error(`FSUIPC worker introuvable: ${workerPath}`);
    }

    const worker = spawn(process.execPath, [workerPath], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
      },
    });

    this.log("FSUIPC worker started", {
      pid: worker.pid ?? null,
      workerPath,
    });

    worker.stdout?.on("data", (chunk) => {
      this.handleStdout(chunk.toString("utf8"));
    });

    worker.stderr?.on("data", (chunk) => {
      const message = chunk.toString("utf8").trim();

      if (message.length > 0) {
        this.log("FSUIPC worker stderr", {
          message,
        });
      }
    });

    worker.on("error", (error) => {
      this.log("fsuipc worker process error", {
        error: error.message,
      });
      this.rejectSnapshotWaiters(
        new Error(`FSUIPC worker process error: ${error.message}`),
      );
    });

    worker.on("exit", (code, signal) => {
      this.log("fsuipc worker exited", {
        code,
        signal,
      });
      this.rejectSnapshotWaiters(
        new Error(
          `FSUIPC worker stopped unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
      this.worker = null;
      this.stdoutBuffer = "";
    });

    this.worker = worker;
    return worker;
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const rawLine = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (rawLine.length === 0) {
        continue;
      }

      this.log("Worker stdout received", {
        line: rawLine,
      });

      try {
        const parsedLine = JSON.parse(rawLine) as unknown;

        if (isWorkerLogLine(parsedLine)) {
          this.log(parsedLine.message, parsedLine.details);
          continue;
        }

        if (isWorkerSnapshotLine(parsedLine)) {
          this.snapshot = structuredClone({
            ...parsedLine.snapshot,
            telemetryMode: this.getConfig().telemetryMode,
          });

          this.resolveSnapshotWaiters(this.snapshot);
          continue;
        }

        this.log("fsuipc worker line ignored", {
          line: rawLine,
        });
      } catch (error) {
        this.log("fsuipc worker line parse failed", {
          line: rawLine,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private resolveSnapshotWaiters(snapshot: SimulatorSnapshot): void {
    for (const waiter of [...this.snapshotWaiters]) {
      const hasTelemetry = Boolean(
        snapshot.telemetry &&
          isFreshTimestamp(snapshot.lastSampleAt, REQUEST_TIMEOUT_MS),
      );

      if (waiter.telemetryOnly && !hasTelemetry) {
        continue;
      }

      clearTimeout(waiter.timeout);
      this.snapshotWaiters.delete(waiter);
      waiter.resolve(structuredClone(snapshot));
    }
  }

  private rejectSnapshotWaiters(error: Error): void {
    for (const waiter of [...this.snapshotWaiters]) {
      clearTimeout(waiter.timeout);
      this.snapshotWaiters.delete(waiter);
      waiter.reject(error);
    }
  }
}
