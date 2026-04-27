const { fork } = require("node:child_process");
const path = require("node:path");

const ATTEMPT_TIMEOUT_MS = 10_000;
const attemptScriptPath = path.join(__dirname, "fsuipc-attempt.cjs");
const DISCOVERY_STRATEGIES = ["MSFS2020", "MSFS", "CURRENT_MSFS", "ANY"];

function buildConnectionStrategies() {
  return [...DISCOVERY_STRATEGIES];
}

function runAttempt(simVersion) {
  return new Promise((resolve, reject) => {
    const child = fork(attemptScriptPath, [simVersion], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`FSUIPC attempt timed out for ${simVersion}.`));
    }, ATTEMPT_TIMEOUT_MS);

    child.on("message", (message) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill();
      resolve(message);
    });

    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `FSUIPC attempt exited unexpectedly for ${simVersion} (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function main() {
  let lastError = null;
  let selectedSimVersion = null;

  for (const simVersion of buildConnectionStrategies()) {
    console.log(`FSUIPC connect attempt with simVersion=${simVersion}`);

    try {
      const result = await runAttempt(simVersion);

      if (!result || result.ok !== true) {
        const message = result?.error ?? "Unknown FSUIPC error.";
        console.error(`FSUIPC error: ${message}`);
        lastError = new Error(message);
        continue;
      }

      console.log(`FSUIPC connection success with simVersion=${simVersion}`);
      selectedSimVersion = simVersion;
      console.log(
        `FSUIPC selected simVersion=${selectedSimVersion} for MSFS2024/FSUIPC7`,
      );

      if (result.telemetry) {
        console.log("First telemetry received");
        console.log(
          JSON.stringify(
            {
              latitude: result.telemetry.latitude,
              longitude: result.telemetry.longitude,
              altitudeFt: result.telemetry.altitudeFt,
              headingDeg: result.telemetry.headingDeg,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(
          JSON.stringify(
            {
              connected: true,
              telemetry: null,
              message: result.snapshot?.message ?? null,
            },
            null,
            2,
          ),
        );
      }

      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FSUIPC error: ${message}`);
      lastError = error;
    }
  }

  process.exitCode = 1;
  if (lastError instanceof Error) {
    console.error(`FSUIPC error: ${lastError.message}`);
  }
}

void main();
