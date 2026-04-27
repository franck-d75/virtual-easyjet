import { FlightPhase } from "@va/database";

export interface PhaseDetectionInput {
  previousPhase: FlightPhase;
  previousOnGround: boolean | null;
  onGround: boolean;
  groundspeedKts: number;
  altitudeFt: number;
  verticalSpeedFpm: number;
  parkingBrake: boolean | null;
}

export const PHASE_DETECTION_THRESHOLDS = {
  groundspeedKts: {
    parkedMax: 1,
    pushbackMax: 5,
    taxiMin: 5,
  },
  altitudeFt: {
    takeoffMax: 1_500,
    approachMax: 3_000,
    cruiseMin: 10_000,
  },
  verticalSpeedFpm: {
    takeoffMin: 300,
    climbMin: 500,
    descentMin: 500,
    cruiseMaxAbs: 300,
  },
  tolerance: {
    groundspeedKts: 2,
    altitudeFt: 300,
    verticalSpeedFpm: 100,
  },
} as const;

const PHASE_SEQUENCE: FlightPhase[] = [
  FlightPhase.PRE_FLIGHT,
  FlightPhase.DEPARTURE_PARKING,
  FlightPhase.PUSHBACK,
  FlightPhase.TAXI_OUT,
  FlightPhase.TAKEOFF,
  FlightPhase.CLIMB,
  FlightPhase.CRUISE,
  FlightPhase.DESCENT,
  FlightPhase.APPROACH,
  FlightPhase.LANDING,
  FlightPhase.TAXI_IN,
  FlightPhase.ARRIVAL_PARKING,
  FlightPhase.COMPLETED,
];

const ALLOWED_PHASE_TRANSITIONS: Record<FlightPhase, FlightPhase[]> = {
  [FlightPhase.PRE_FLIGHT]: [FlightPhase.DEPARTURE_PARKING],
  [FlightPhase.DEPARTURE_PARKING]: [
    FlightPhase.PUSHBACK,
    FlightPhase.TAXI_OUT,
  ],
  [FlightPhase.PUSHBACK]: [
    FlightPhase.DEPARTURE_PARKING,
    FlightPhase.TAXI_OUT,
  ],
  [FlightPhase.TAXI_OUT]: [
    FlightPhase.DEPARTURE_PARKING,
    FlightPhase.TAKEOFF,
  ],
  [FlightPhase.TAKEOFF]: [FlightPhase.CLIMB],
  [FlightPhase.CLIMB]: [FlightPhase.CRUISE, FlightPhase.DESCENT],
  [FlightPhase.CRUISE]: [FlightPhase.DESCENT],
  [FlightPhase.DESCENT]: [FlightPhase.APPROACH],
  [FlightPhase.APPROACH]: [FlightPhase.LANDING, FlightPhase.CLIMB],
  [FlightPhase.LANDING]: [FlightPhase.TAXI_IN, FlightPhase.ARRIVAL_PARKING],
  [FlightPhase.TAXI_IN]: [FlightPhase.ARRIVAL_PARKING],
  [FlightPhase.ARRIVAL_PARKING]: [FlightPhase.COMPLETED],
  [FlightPhase.COMPLETED]: [FlightPhase.COMPLETED],
};

const PUSHBACK_ENTRY_PHASES: FlightPhase[] = [
  FlightPhase.PRE_FLIGHT,
  FlightPhase.DEPARTURE_PARKING,
];

const AIRBORNE_HOLD_PHASES: FlightPhase[] = [
  FlightPhase.TAKEOFF,
  FlightPhase.CLIMB,
  FlightPhase.CRUISE,
  FlightPhase.DESCENT,
  FlightPhase.APPROACH,
];

function isPostArrivalPhase(phase: FlightPhase): boolean {
  const postArrivalPhases: FlightPhase[] = [
    FlightPhase.LANDING,
    FlightPhase.TAXI_IN,
    FlightPhase.ARRIVAL_PARKING,
    FlightPhase.COMPLETED,
  ];

  return postArrivalPhases.includes(phase);
}

function resolveCandidatePhase(input: PhaseDetectionInput): FlightPhase {
  const thresholds = PHASE_DETECTION_THRESHOLDS;

  if (input.previousPhase === FlightPhase.COMPLETED) {
    return FlightPhase.COMPLETED;
  }

  if (input.onGround) {
    if (input.previousOnGround === false) {
      return FlightPhase.LANDING;
    }

    if (
      input.groundspeedKts <=
        thresholds.groundspeedKts.parkedMax + thresholds.tolerance.groundspeedKts &&
      input.parkingBrake === true
    ) {
      return isPostArrivalPhase(input.previousPhase)
        ? FlightPhase.ARRIVAL_PARKING
        : FlightPhase.DEPARTURE_PARKING;
    }

    if (isPostArrivalPhase(input.previousPhase)) {
      return input.groundspeedKts >=
        thresholds.groundspeedKts.taxiMin + thresholds.tolerance.groundspeedKts
        ? FlightPhase.TAXI_IN
        : FlightPhase.ARRIVAL_PARKING;
    }

    if (
      PUSHBACK_ENTRY_PHASES.includes(input.previousPhase) &&
      input.parkingBrake === false &&
      input.groundspeedKts <=
        thresholds.groundspeedKts.pushbackMax +
          thresholds.tolerance.groundspeedKts
    ) {
      return FlightPhase.PUSHBACK;
    }

    if (
      input.groundspeedKts >=
      thresholds.groundspeedKts.taxiMin + thresholds.tolerance.groundspeedKts
    ) {
      return FlightPhase.TAXI_OUT;
    }

    return input.previousPhase === FlightPhase.PRE_FLIGHT
      ? FlightPhase.DEPARTURE_PARKING
      : input.previousPhase;
  }

  if (input.previousOnGround === true) {
    return FlightPhase.TAKEOFF;
  }

  if (
    input.altitudeFt <=
      thresholds.altitudeFt.approachMax + thresholds.tolerance.altitudeFt &&
    input.verticalSpeedFpm <=
      -(thresholds.verticalSpeedFpm.descentMin +
        thresholds.tolerance.verticalSpeedFpm)
  ) {
    return FlightPhase.APPROACH;
  }

  if (
    input.verticalSpeedFpm <=
    -(thresholds.verticalSpeedFpm.descentMin +
      thresholds.tolerance.verticalSpeedFpm)
  ) {
    return input.altitudeFt <=
      thresholds.altitudeFt.cruiseMin - thresholds.tolerance.altitudeFt
      ? FlightPhase.APPROACH
      : FlightPhase.DESCENT;
  }

  if (
    input.altitudeFt <=
      thresholds.altitudeFt.takeoffMax + thresholds.tolerance.altitudeFt &&
    input.verticalSpeedFpm >=
      thresholds.verticalSpeedFpm.takeoffMin +
        thresholds.tolerance.verticalSpeedFpm
  ) {
    return FlightPhase.TAKEOFF;
  }

  if (
    input.verticalSpeedFpm >=
    thresholds.verticalSpeedFpm.climbMin +
      thresholds.tolerance.verticalSpeedFpm
  ) {
    return FlightPhase.CLIMB;
  }

  if (
    Math.abs(input.verticalSpeedFpm) <=
      thresholds.verticalSpeedFpm.cruiseMaxAbs +
        thresholds.tolerance.verticalSpeedFpm &&
    input.altitudeFt >=
      thresholds.altitudeFt.cruiseMin - thresholds.tolerance.altitudeFt
  ) {
    return FlightPhase.CRUISE;
  }

  return AIRBORNE_HOLD_PHASES.includes(input.previousPhase)
    ? input.previousPhase
    : FlightPhase.CLIMB;
}

function resolveAllowedTransition(
  previousPhase: FlightPhase,
  candidatePhase: FlightPhase,
): FlightPhase {
  if (previousPhase === candidatePhase) {
    return previousPhase;
  }

  const allowedTransitions = ALLOWED_PHASE_TRANSITIONS[previousPhase];

  if (allowedTransitions.includes(candidatePhase)) {
    return candidatePhase;
  }

  const previousIndex = PHASE_SEQUENCE.indexOf(previousPhase);
  const candidateIndex = PHASE_SEQUENCE.indexOf(candidatePhase);

  if (previousIndex === -1 || candidateIndex === -1) {
    return previousPhase;
  }

  if (candidateIndex > previousIndex) {
    const nextAllowedPhase = allowedTransitions
      .slice()
      .sort(
        (left, right) =>
          PHASE_SEQUENCE.indexOf(left) - PHASE_SEQUENCE.indexOf(right),
      )[0];

    return nextAllowedPhase ?? previousPhase;
  }

  return previousPhase;
}

export function detectFlightPhase(input: PhaseDetectionInput): FlightPhase {
  if (input.previousPhase === FlightPhase.COMPLETED) {
    return FlightPhase.COMPLETED;
  }

  const candidatePhase = resolveCandidatePhase(input);
  return resolveAllowedTransition(input.previousPhase, candidatePhase);
}

export function formatFlightPhaseLabel(phase: FlightPhase): string {
  return phase
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
