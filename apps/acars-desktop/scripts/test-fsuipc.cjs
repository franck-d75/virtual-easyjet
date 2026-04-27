const { connectAndSampleOnce } = require("./fsuipc-official.cjs");

async function main() {
  try {
    const result = await connectAndSampleOnce((message, details) => {
      console.log(message);

      if (details) {
        console.log(JSON.stringify(details, null, 2));
      }
    });

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
      return;
    }

    console.log(
      JSON.stringify(
        {
          connected: result.snapshot?.connected ?? false,
          telemetry: null,
          message: result.snapshot?.message ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FSUIPC error: ${message}`);
    process.exitCode = 1;
  }
}

void main();
