import { existsSync } from "node:fs";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { DesktopConfig, SimulatorSnapshot, TelemetryInput } from "../shared/types.js";

const REQUEST_TIMEOUT_MS = 8_000;
const CONNECT_RETRY_INTERVAL_MS = 5_000;

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

type WorkerRequestType = "connect" | "sample";

type WorkerRequest = {
  id: number;
  type: WorkerRequestType;
};

type WorkerLogMessage = {
  type: "log";
  level: "info" | "error";
  message: string;
  details?: Record<string, unknown>;
};

type WorkerResponse = {
  type: "response";
  id: number;
  ok: boolean;
  snapshot?: SimulatorSnapshot;
  telemetry?: TelemetryInput | null;
  error?: string;
};

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (value: WorkerResponse) => void;
  timeout: ReturnType<typeof setTimeout>;
};

function isWorkerLogMessage(value: unknown): value is WorkerLogMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "log"
  );
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "response"
  );
}

export class FsuipcBridge {
  private worker: ChildProcess | null = null;
  private requestIdCounter = 1;
  private lastConnectAttemptAt = 0;
  private firstTelemetryLogged = false;
  private snapshot: SimulatorSnapshot = structuredClone(DEFAULT_SIMULATOR_SNAPSHOT);
  private readonly pendingRequests = new Map<number, PendingRequest>();

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
    if (
      Date.now() - this.lastConnectAttemptAt < CONNECT_RETRY_INTERVAL_MS &&
      this.snapshot.status === "UNAVAILABLE"
    ) {
      return this.getSnapshot();
    }

    this.lastConnectAttemptAt = Date.now();
    this.snapshot = {
      ...this.snapshot,
      status: "CONNECTING",
      telemetryMode: this.getConfig().telemetryMode,
      dataSource: "none",
      message: "Connexion a FSUIPC7 en cours...",
      connected: false,
      aircraftDetected: false,
      error: null,
    };

    try {
      const response = await this.sendRequest("connect");
      this.applyWorkerResponse(response);
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        status: "UNAVAILABLE",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "FSUIPC7 est indisponible. Lancez FSUIPC7 avant ACARS.",
        connected: false,
        aircraftDetected: false,
        error: error instanceof Error ? error.message : "Connexion FSUIPC7 impossible.",
      };
    }

    return this.getSnapshot();
  }

  public async sampleTelemetry(): Promise<TelemetryInput | null> {
    try {
      const response = await this.sendRequest("sample");
      this.applyWorkerResponse(response);

      if (response.telemetry && !this.firstTelemetryLogged) {
        this.firstTelemetryLogged = true;
        this.log("fsuipc first telemetry received", {
          capturedAt: response.telemetry.capturedAt ?? null,
        });
      }

      return response.telemetry ?? null;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lecture FSUIPC7 impossible.";

      this.snapshot = {
        ...this.snapshot,
        status: "ERROR",
        telemetryMode: this.getConfig().telemetryMode,
        dataSource: "none",
        message: "La lecture de la telemetrie FSUIPC7 a echoue.",
        connected: false,
        aircraftDetected: false,
        error: message,
      };
      this.log("fsuipc error", {
        error: message,
      });
      this.disposeWorker();

      return null;
    }
  }

  private applyWorkerResponse(response: WorkerResponse): void {
    this.snapshot = structuredClone({
      ...(response.snapshot ?? DEFAULT_SIMULATOR_SNAPSHOT),
      telemetryMode: this.getConfig().telemetryMode,
    });
  }

  private sendRequest(type: WorkerRequestType): Promise<WorkerResponse> {
    const worker = this.ensureWorker();
    const id = this.requestIdCounter;
    this.requestIdCounter += 1;

    return new Promise<WorkerResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`FSUIPC ${type} timed out after ${REQUEST_TIMEOUT_MS} ms.`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      const payload: WorkerRequest = {
        id,
        type,
      };

      worker.send(payload);
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

    const worker = fork(workerPath, [], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      silent: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    worker.on("message", (message: unknown) => {
      if (isWorkerLogMessage(message)) {
        this.log(message.message, message.details);
        return;
      }

      if (!isWorkerResponse(message)) {
        return;
      }

      const pendingRequest = this.pendingRequests.get(message.id);

      if (!pendingRequest) {
        return;
      }

      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(message.id);

      if (!message.ok) {
        pendingRequest.reject(new Error(message.error ?? "FSUIPC worker failed."));
        return;
      }

      pendingRequest.resolve(message);
    });

    worker.on("exit", (code, signal) => {
      this.log("fsuipc worker exited", {
        code,
        signal,
      });
      this.rejectPendingRequests(
        new Error(
          `FSUIPC worker stopped unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
      this.worker = null;
    });

    worker.on("error", (error) => {
      this.log("fsuipc worker process error", {
        error: error.message,
      });
    });

    worker.stdout?.on("data", (chunk) => {
      const message = chunk.toString("utf8").trim();

      if (message.length > 0) {
        this.log("fsuipc worker stdout", {
          message,
        });
      }
    });

    worker.stderr?.on("data", (chunk) => {
      const message = chunk.toString("utf8").trim();

      if (message.length > 0) {
        this.log("fsuipc worker stderr", {
          message,
        });
      }
    });

    this.worker = worker;
    return worker;
  }

  private rejectPendingRequests(error: Error): void {
    for (const [id, pendingRequest] of this.pendingRequests.entries()) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  private disposeWorker(): void {
    if (!this.worker) {
      return;
    }

    this.worker.kill();
    this.worker = null;
  }
}
