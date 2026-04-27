const fsuipc = require("fsuipc");

const FEET_PER_METER = 3.280839895;
const RADIANS_TO_DEGREES = 180 / Math.PI;

function round(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 1000) / 1000
    : null;
}

async function main() {
  const client = new fsuipc.FSUIPC();

  console.log("FSUIPC connect attempt");

  try {
    await client.open(fsuipc.Simulator.MSFS);
    console.log("FSUIPC connection success");

    client.add("latitudeDeg", 0x6010, fsuipc.Type.Double);
    client.add("longitudeDeg", 0x6018, fsuipc.Type.Double);
    client.add("altitudeMeters", 0x6020, fsuipc.Type.Double);
    client.add("headingRadians", 0x6038, fsuipc.Type.Double);

    const payload = await client.process();
    const latitude = round(payload.latitudeDeg);
    const longitude = round(payload.longitudeDeg);
    const altitudeFt =
      typeof payload.altitudeMeters === "number"
        ? round(payload.altitudeMeters * FEET_PER_METER)
        : null;
    const headingDeg =
      typeof payload.headingRadians === "number"
        ? round(
            ((payload.headingRadians * RADIANS_TO_DEGREES) % 360 + 360) % 360,
          )
        : null;

    console.log("First telemetry received");
    console.log(
      JSON.stringify(
        {
          latitude,
          longitude,
          altitudeFt,
          headingDeg,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FSUIPC error: ${message}`);
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch {
      // Ignore cleanup errors in test mode.
    }
  }
}

void main();
