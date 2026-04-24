import { spawn } from "node:child_process";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = resolve(scriptDirectory, "..");
const isWindows = process.platform === "win32";
const pnpmCommand = isWindows ? "pnpm.cmd" : "pnpm";
const dockerCommand = isWindows ? "docker.exe" : "docker";
const runningChildren = new Set();

let shutdownRequested = false;

function logStep(message) {
  console.log(`[local-dev] ${message}`);
}

function formatExitCode(code) {
  return code === null ? "null" : String(code);
}

function quoteWindowsArgument(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/gu, "$1$1\\\"").replace(/(\\+)$/u, "$1$1")}"`;
}

function resolveCommandInvocation(command, args) {
  if (!isWindows) {
    return {
      file: command,
      args,
    };
  }

  const commandLine = [command, ...args].map(quoteWindowsArgument).join(" ");

  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", commandLine],
  };
}

function pipeProcessOutput(stream, label) {
  if (!stream) {
    return;
  }

  stream.setEncoding("utf8");

  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk;

    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`[${label}] ${line}`);
      }
    }
  });

  stream.on("end", () => {
    if (buffer.trim().length > 0) {
      console.log(`[${label}] ${buffer}`);
    }
  });
}

function runCommand(command, args, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const invocation = resolveCommandInvocation(command, args);
    const child = spawn(invocation.file, invocation.args, {
      cwd: rootDirectory,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    pipeProcessOutput(child.stdout, label);
    pipeProcessOutput(child.stderr, label);

    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`${label} failed with exit code ${formatExitCode(code)}.`),
      );
    });
  });
}

function spawnLongRunningProcess(label, args) {
  const invocation = resolveCommandInvocation(pnpmCommand, args);
  const child = spawn(invocation.file, invocation.args, {
    cwd: rootDirectory,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  runningChildren.add(child);

  pipeProcessOutput(child.stdout, label);
  pipeProcessOutput(child.stderr, label);

  child.once("exit", (code) => {
    runningChildren.delete(child);

    if (!shutdownRequested) {
      logStep(`${label} stopped unexpectedly (${formatExitCode(code)}).`);
      void shutdown(code ?? 1);
    }
  });

  return child;
}

function canReachPort(port, host = "127.0.0.1") {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({
      host,
      port,
    });

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(result);
    };

    socket.setTimeout(1_500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPort(port, label, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReachPort(port)) {
      return;
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 1_000);
    });
  }

  throw new Error(
    `${label} did not become reachable on port ${port} within ${timeoutMs} ms.`,
  );
}

async function ensureDatabase() {
  if (await canReachPort(5_432)) {
    logStep("PostgreSQL already available on localhost:5432.");
    return;
  }

  logStep("Starting PostgreSQL with Docker Compose...");
  await runCommand(
    dockerCommand,
    ["compose", "-f", "infra/docker/docker-compose.yml", "up", "-d"],
    "Docker Compose",
  );
  await waitForPort(5_432, "PostgreSQL");
  logStep("PostgreSQL is ready.");
}

function terminateChildProcess(child) {
  return new Promise((resolvePromise) => {
    if (child.exitCode !== null) {
      resolvePromise();
      return;
    }

    child.once("exit", () => {
      resolvePromise();
    });

    if (isWindows) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });

      killer.once("error", () => {
        resolvePromise();
      });
      killer.once("exit", () => {
        resolvePromise();
      });
      return;
    }

    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1_500);
  });
}

async function shutdown(exitCode = 0) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  logStep("Stopping local services...");

  await Promise.all(
    [...runningChildren].map((child) => terminateChildProcess(child)),
  );

  process.exit(exitCode);
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

async function main() {
  logStep("Preparing Virtual Easyjet local stack (PostgreSQL + API + web).");

  await ensureDatabase();

  logStep("Applying Prisma migrations...");
  await runCommand(
    pnpmCommand,
    ["--filter", "@va/database", "exec", "prisma", "migrate", "deploy"],
    "Prisma migrate deploy",
  );

  logStep("Refreshing demo seed data...");
  await runCommand(pnpmCommand, ["db:seed"], "Prisma seed");

  logStep("Starting API and web development servers...");
  spawnLongRunningProcess("api", ["--filter", "@va/api", "dev"]);
  spawnLongRunningProcess("web", ["--filter", "@va/web", "dev"]);

  await waitForPort(3_001, "API");
  await waitForPort(3_000, "Web");

  logStep("Virtual Easyjet is ready.");
  logStep("Web: http://localhost:3000");
  logStep("API: http://localhost:3001/api");
  logStep("Press Ctrl+C to stop the local stack.");

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(
    "[local-dev]",
    error instanceof Error ? error.message : error,
  );
  void shutdown(1);
});
