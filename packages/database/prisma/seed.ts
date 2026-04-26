import { hash } from "bcryptjs";
import {
  PilotStatus,
  PrismaClient,
  UserPlatformRole,
  UserStatus,
} from "@prisma/client";

import { loadRootEnvironment } from "./load-root-env.js";

Object.assign(process.env, loadRootEnvironment());

const prisma = new PrismaClient();

type AccountSeedConfig = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode: string | null;
  platformRole: UserPlatformRole;
  roleCodes: string[];
  createPilotProfile: boolean;
  pilotNumber?: string | null;
  callsign?: string | null;
  simbriefPilotId?: string | null;
  pilotStatus?: PilotStatus;
};

const PRODUCTION_AIRCRAFT_TYPES = [
  {
    icaoCode: "A319",
    name: "Airbus A319",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
  {
    icaoCode: "A320",
    name: "Airbus A320",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
  {
    icaoCode: "A20N",
    name: "Airbus A320neo",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 447,
  },
  {
    icaoCode: "A21N",
    name: "Airbus A321neo",
    manufacturer: "Airbus",
    category: "Narrow-body",
    cruiseSpeedKts: 450,
  },
] as const;

// Production reference network for Virtual Easyjet Geneva.
// Source baseline: Geneva Airport official easyJet destination page and summer 2026 network updates.
const PRODUCTION_AIRPORTS = [
  {
    icao: "LSGG",
    iata: "GVA",
    name: "Geneva Airport",
    city: "Geneva",
    countryCode: "CH",
    latitude: 46.238064,
    longitude: 6.10895,
    elevationFt: 1411,
    isActive: true,
  },
  {
    icao: "LECO",
    iata: "LCG",
    name: "A Coruna Airport",
    city: "A Coruna",
    countryCode: "ES",
    latitude: 43.30206,
    longitude: -8.37726,
    elevationFt: 326,
    isActive: true,
  },
  {
    icao: "EGPD",
    iata: "ABZ",
    name: "Aberdeen Airport",
    city: "Aberdeen",
    countryCode: "GB",
    latitude: 57.20194,
    longitude: -2.19778,
    elevationFt: 215,
    isActive: true,
  },
  {
    icao: "GMAD",
    iata: "AGA",
    name: "Agadir Al Massira Airport",
    city: "Agadir",
    countryCode: "MA",
    latitude: 30.325,
    longitude: -9.41307,
    elevationFt: 250,
    isActive: true,
  },
  {
    icao: "LFKJ",
    iata: "AJA",
    name: "Ajaccio Napoleon Bonaparte Airport",
    city: "Ajaccio",
    countryCode: "FR",
    latitude: 41.92364,
    longitude: 8.80292,
    elevationFt: 18,
    isActive: true,
  },
  {
    icao: "LEAL",
    iata: "ALC",
    name: "Alicante Elche Miguel Hernandez Airport",
    city: "Alicante",
    countryCode: "ES",
    latitude: 38.28217,
    longitude: -0.55816,
    elevationFt: 142,
    isActive: true,
  },
  {
    icao: "EHAM",
    iata: "AMS",
    name: "Amsterdam Airport Schiphol",
    city: "Amsterdam",
    countryCode: "NL",
    latitude: 52.3086,
    longitude: 4.76389,
    elevationFt: -11,
    isActive: true,
  },
  {
    icao: "LTAI",
    iata: "AYT",
    name: "Antalya Airport",
    city: "Antalya",
    countryCode: "TR",
    latitude: 36.89928,
    longitude: 30.80046,
    elevationFt: 177,
    isActive: true,
  },
  {
    icao: "OJAQ",
    iata: "AQJ",
    name: "King Hussein International Airport",
    city: "Aqaba",
    countryCode: "JO",
    latitude: 29.61162,
    longitude: 35.01807,
    elevationFt: 174,
    isActive: true,
  },
  {
    icao: "LGAV",
    iata: "ATH",
    name: "Athens International Airport",
    city: "Athens",
    countryCode: "GR",
    latitude: 37.93636,
    longitude: 23.94747,
    elevationFt: 308,
    isActive: true,
  },
  {
    icao: "LEBL",
    iata: "BCN",
    name: "Barcelona El Prat Airport",
    city: "Barcelona",
    countryCode: "ES",
    latitude: 41.2971,
    longitude: 2.07846,
    elevationFt: 12,
    isActive: true,
  },
  {
    icao: "LFKB",
    iata: "BIA",
    name: "Bastia Poretta Airport",
    city: "Bastia",
    countryCode: "FR",
    latitude: 42.55266,
    longitude: 9.48373,
    elevationFt: 26,
    isActive: true,
  },
  {
    icao: "EGAA",
    iata: "BFS",
    name: "Belfast International Airport",
    city: "Belfast",
    countryCode: "GB",
    latitude: 54.6575,
    longitude: -6.21583,
    elevationFt: 268,
    isActive: true,
  },
  {
    icao: "LYBE",
    iata: "BEG",
    name: "Belgrade Nikola Tesla Airport",
    city: "Belgrade",
    countryCode: "RS",
    latitude: 44.81844,
    longitude: 20.30914,
    elevationFt: 335,
    isActive: true,
  },
  {
    icao: "EDDB",
    iata: "BER",
    name: "Berlin Brandenburg Airport",
    city: "Berlin",
    countryCode: "DE",
    latitude: 52.36667,
    longitude: 13.50333,
    elevationFt: 157,
    isActive: true,
  },
  {
    icao: "LEBB",
    iata: "BIO",
    name: "Bilbao Airport",
    city: "Bilbao",
    countryCode: "ES",
    latitude: 43.3011,
    longitude: -2.91061,
    elevationFt: 138,
    isActive: true,
  },
  {
    icao: "EGBB",
    iata: "BHX",
    name: "Birmingham Airport",
    city: "Birmingham",
    countryCode: "GB",
    latitude: 52.45386,
    longitude: -1.74803,
    elevationFt: 327,
    isActive: true,
  },
  {
    icao: "LFBD",
    iata: "BOD",
    name: "Bordeaux Merignac Airport",
    city: "Bordeaux",
    countryCode: "FR",
    latitude: 44.82834,
    longitude: -0.71556,
    elevationFt: 162,
    isActive: true,
  },
  {
    icao: "EGHH",
    iata: "BOH",
    name: "Bournemouth Airport",
    city: "Bournemouth",
    countryCode: "GB",
    latitude: 50.77999,
    longitude: -1.8425,
    elevationFt: 38,
    isActive: true,
  },
  {
    icao: "LIBR",
    iata: "BDS",
    name: "Brindisi Airport",
    city: "Brindisi",
    countryCode: "IT",
    latitude: 40.65763,
    longitude: 17.94703,
    elevationFt: 47,
    isActive: true,
  },
  {
    icao: "EGGD",
    iata: "BRS",
    name: "Bristol Airport",
    city: "Bristol",
    countryCode: "GB",
    latitude: 51.38267,
    longitude: -2.71909,
    elevationFt: 622,
    isActive: true,
  },
  {
    icao: "EBBR",
    iata: "BRU",
    name: "Brussels Airport",
    city: "Brussels",
    countryCode: "BE",
    latitude: 50.90139,
    longitude: 4.48444,
    elevationFt: 184,
    isActive: true,
  },
  {
    icao: "LHBP",
    iata: "BUD",
    name: "Budapest Ferenc Liszt International Airport",
    city: "Budapest",
    countryCode: "HU",
    latitude: 47.43693,
    longitude: 19.25559,
    elevationFt: 495,
    isActive: true,
  },
  {
    icao: "LIEE",
    iata: "CAG",
    name: "Cagliari Elmas Airport",
    city: "Cagliari",
    countryCode: "IT",
    latitude: 39.25147,
    longitude: 9.05428,
    elevationFt: 13,
    isActive: true,
  },
  {
    icao: "LFKC",
    iata: "CLY",
    name: "Calvi Sainte-Catherine Airport",
    city: "Calvi",
    countryCode: "FR",
    latitude: 42.52444,
    longitude: 8.79306,
    elevationFt: 209,
    isActive: true,
  },
  {
    icao: "LICC",
    iata: "CTA",
    name: "Catania Fontanarossa Airport",
    city: "Catania",
    countryCode: "IT",
    latitude: 37.46678,
    longitude: 15.0664,
    elevationFt: 39,
    isActive: true,
  },
  {
    icao: "LGSA",
    iata: "CHQ",
    name: "Chania International Airport",
    city: "Chania",
    countryCode: "GR",
    latitude: 35.53174,
    longitude: 24.14968,
    elevationFt: 490,
    isActive: true,
  },
  {
    icao: "EKCH",
    iata: "CPH",
    name: "Copenhagen Airport",
    city: "Copenhagen",
    countryCode: "DK",
    latitude: 55.61806,
    longitude: 12.65611,
    elevationFt: 17,
    isActive: true,
  },
  {
    icao: "LGKR",
    iata: "CFU",
    name: "Corfu International Airport",
    city: "Corfu",
    countryCode: "GR",
    latitude: 39.60194,
    longitude: 19.91167,
    elevationFt: 6,
    isActive: true,
  },
  {
    icao: "LCLK",
    iata: "LCA",
    name: "Larnaca International Airport",
    city: "Larnaca",
    countryCode: "CY",
    latitude: 34.87512,
    longitude: 33.62485,
    elevationFt: 8,
    isActive: true,
  },
  {
    icao: "LDDU",
    iata: "DBV",
    name: "Dubrovnik Airport",
    city: "Dubrovnik",
    countryCode: "HR",
    latitude: 42.56135,
    longitude: 18.26824,
    elevationFt: 527,
    isActive: true,
  },
  {
    icao: "EGPH",
    iata: "EDI",
    name: "Edinburgh Airport",
    city: "Edinburgh",
    countryCode: "GB",
    latitude: 55.95,
    longitude: -3.3725,
    elevationFt: 135,
    isActive: true,
  },
  {
    icao: "DTNH",
    iata: "NBE",
    name: "Enfidha-Hammamet International Airport",
    city: "Enfidha",
    countryCode: "TN",
    latitude: 36.07583,
    longitude: 10.43861,
    elevationFt: 21,
    isActive: true,
  },
  {
    icao: "LPFR",
    iata: "FAO",
    name: "Faro Airport",
    city: "Faro",
    countryCode: "PT",
    latitude: 37.01439,
    longitude: -7.96591,
    elevationFt: 24,
    isActive: true,
  },
  {
    icao: "LFKF",
    iata: "FSC",
    name: "Figari Sud-Corse Airport",
    city: "Figari",
    countryCode: "FR",
    latitude: 41.50056,
    longitude: 9.09778,
    elevationFt: 87,
    isActive: true,
  },
  {
    icao: "GCFV",
    iata: "FUE",
    name: "Fuerteventura Airport",
    city: "Puerto del Rosario",
    countryCode: "ES",
    latitude: 28.45272,
    longitude: -13.86376,
    elevationFt: 85,
    isActive: true,
  },
  {
    icao: "LPMA",
    iata: "FNC",
    name: "Cristiano Ronaldo Madeira International Airport",
    city: "Funchal",
    countryCode: "PT",
    latitude: 32.69789,
    longitude: -16.77445,
    elevationFt: 190,
    isActive: true,
  },
  {
    icao: "EGPF",
    iata: "GLA",
    name: "Glasgow Airport",
    city: "Glasgow",
    countryCode: "GB",
    latitude: 55.87194,
    longitude: -4.43306,
    elevationFt: 26,
    isActive: true,
  },
  {
    icao: "GCLP",
    iata: "LPA",
    name: "Gran Canaria Airport",
    city: "Las Palmas",
    countryCode: "ES",
    latitude: 27.93189,
    longitude: -15.38659,
    elevationFt: 78,
    isActive: true,
  },
  {
    icao: "LGIR",
    iata: "HER",
    name: "Heraklion International Airport",
    city: "Heraklion",
    countryCode: "GR",
    latitude: 35.33972,
    longitude: 25.18029,
    elevationFt: 115,
    isActive: true,
  },
  {
    icao: "HEGN",
    iata: "HRG",
    name: "Hurghada International Airport",
    city: "Hurghada",
    countryCode: "EG",
    latitude: 27.17831,
    longitude: 33.79944,
    elevationFt: 52,
    isActive: true,
  },
  {
    icao: "LEIB",
    iata: "IBZ",
    name: "Ibiza Airport",
    city: "Ibiza",
    countryCode: "ES",
    latitude: 38.87286,
    longitude: 1.37312,
    elevationFt: 24,
    isActive: true,
  },
  {
    icao: "EPKK",
    iata: "KRK",
    name: "John Paul II Krakow-Balice Airport",
    city: "Krakow",
    countryCode: "PL",
    latitude: 50.07773,
    longitude: 19.78484,
    elevationFt: 791,
    isActive: true,
  },
  {
    icao: "LFBH",
    iata: "LRH",
    name: "La Rochelle Ile de Re Airport",
    city: "La Rochelle",
    countryCode: "FR",
    latitude: 46.1792,
    longitude: -1.19528,
    elevationFt: 74,
    isActive: true,
  },
  {
    icao: "LICA",
    iata: "SUF",
    name: "Lamezia Terme International Airport",
    city: "Lamezia Terme",
    countryCode: "IT",
    latitude: 38.9054,
    longitude: 16.24227,
    elevationFt: 39,
    isActive: true,
  },
  {
    icao: "GCRR",
    iata: "ACE",
    name: "Lanzarote Airport",
    city: "Arrecife",
    countryCode: "ES",
    latitude: 28.94546,
    longitude: -13.60523,
    elevationFt: 46,
    isActive: true,
  },
  {
    icao: "LFQQ",
    iata: "LIL",
    name: "Lille Airport",
    city: "Lille",
    countryCode: "FR",
    latitude: 50.56333,
    longitude: 3.08689,
    elevationFt: 157,
    isActive: true,
  },
  {
    icao: "LPPT",
    iata: "LIS",
    name: "Lisbon Humberto Delgado Airport",
    city: "Lisbon",
    countryCode: "PT",
    latitude: 38.77417,
    longitude: -9.13417,
    elevationFt: 374,
    isActive: true,
  },
  {
    icao: "EGGP",
    iata: "LPL",
    name: "Liverpool John Lennon Airport",
    city: "Liverpool",
    countryCode: "GB",
    latitude: 53.33361,
    longitude: -2.84972,
    elevationFt: 80,
    isActive: true,
  },
  {
    icao: "EGKK",
    iata: "LGW",
    name: "London Gatwick Airport",
    city: "London",
    countryCode: "GB",
    latitude: 51.14806,
    longitude: -0.19028,
    elevationFt: 203,
    isActive: true,
  },
  {
    icao: "EGGW",
    iata: "LTN",
    name: "London Luton Airport",
    city: "London",
    countryCode: "GB",
    latitude: 51.87472,
    longitude: -0.36833,
    elevationFt: 526,
    isActive: true,
  },
  {
    icao: "EGMC",
    iata: "SEN",
    name: "London Southend Airport",
    city: "London",
    countryCode: "GB",
    latitude: 51.57139,
    longitude: 0.69556,
    elevationFt: 49,
    isActive: true,
  },
  {
    icao: "EGSS",
    iata: "STN",
    name: "London Stansted Airport",
    city: "London",
    countryCode: "GB",
    latitude: 51.885,
    longitude: 0.235,
    elevationFt: 348,
    isActive: true,
  },
  {
    icao: "LEMD",
    iata: "MAD",
    name: "Adolfo Suarez Madrid-Barajas Airport",
    city: "Madrid",
    countryCode: "ES",
    latitude: 40.47222,
    longitude: -3.56083,
    elevationFt: 1998,
    isActive: true,
  },
  {
    icao: "LEMG",
    iata: "AGP",
    name: "Malaga Costa del Sol Airport",
    city: "Malaga",
    countryCode: "ES",
    latitude: 36.6749,
    longitude: -4.49911,
    elevationFt: 53,
    isActive: true,
  },
  {
    icao: "LMML",
    iata: "MLA",
    name: "Malta International Airport",
    city: "Malta",
    countryCode: "MT",
    latitude: 35.8575,
    longitude: 14.4775,
    elevationFt: 300,
    isActive: true,
  },
  {
    icao: "EGCC",
    iata: "MAN",
    name: "Manchester Airport",
    city: "Manchester",
    countryCode: "GB",
    latitude: 53.35374,
    longitude: -2.27495,
    elevationFt: 257,
    isActive: true,
  },
  {
    icao: "GMMX",
    iata: "RAK",
    name: "Marrakesh Menara Airport",
    city: "Marrakech",
    countryCode: "MA",
    latitude: 31.60689,
    longitude: -8.0363,
    elevationFt: 1545,
    isActive: true,
  },
  {
    icao: "LEMH",
    iata: "MAH",
    name: "Menorca Airport",
    city: "Menorca",
    countryCode: "ES",
    latitude: 39.8626,
    longitude: 4.21865,
    elevationFt: 302,
    isActive: true,
  },
  {
    icao: "LGMK",
    iata: "JMK",
    name: "Mykonos Airport",
    city: "Mykonos",
    countryCode: "GR",
    latitude: 37.43511,
    longitude: 25.3481,
    elevationFt: 405,
    isActive: true,
  },
  {
    icao: "LFRS",
    iata: "NTE",
    name: "Nantes Atlantique Airport",
    city: "Nantes",
    countryCode: "FR",
    latitude: 47.15319,
    longitude: -1.61073,
    elevationFt: 90,
    isActive: true,
  },
  {
    icao: "LIRN",
    iata: "NAP",
    name: "Naples International Airport",
    city: "Naples",
    countryCode: "IT",
    latitude: 40.88603,
    longitude: 14.2908,
    elevationFt: 294,
    isActive: true,
  },
  {
    icao: "EGNT",
    iata: "NCL",
    name: "Newcastle Airport",
    city: "Newcastle",
    countryCode: "GB",
    latitude: 55.0375,
    longitude: -1.69167,
    elevationFt: 266,
    isActive: true,
  },
  {
    icao: "LFMN",
    iata: "NCE",
    name: "Nice Cote d'Azur Airport",
    city: "Nice",
    countryCode: "FR",
    latitude: 43.66528,
    longitude: 7.215,
    elevationFt: 12,
    isActive: true,
  },
  {
    icao: "LIEO",
    iata: "OLB",
    name: "Olbia Costa Smeralda Airport",
    city: "Olbia",
    countryCode: "IT",
    latitude: 40.89866,
    longitude: 9.51763,
    elevationFt: 37,
    isActive: true,
  },
  {
    icao: "LICJ",
    iata: "PMO",
    name: "Falcone Borsellino Airport",
    city: "Palermo",
    countryCode: "IT",
    latitude: 38.17595,
    longitude: 13.09102,
    elevationFt: 65,
    isActive: true,
  },
  {
    icao: "LEPA",
    iata: "PMI",
    name: "Palma de Mallorca Airport",
    city: "Palma de Mallorca",
    countryCode: "ES",
    latitude: 39.55169,
    longitude: 2.73881,
    elevationFt: 27,
    isActive: true,
  },
  {
    icao: "LFPO",
    iata: "ORY",
    name: "Paris Orly Airport",
    city: "Paris",
    countryCode: "FR",
    latitude: 48.72624,
    longitude: 2.36525,
    elevationFt: 291,
    isActive: true,
  },
  {
    icao: "LIRP",
    iata: "PSA",
    name: "Pisa International Airport",
    city: "Pisa",
    countryCode: "IT",
    latitude: 43.68391,
    longitude: 10.39275,
    elevationFt: 6,
    isActive: true,
  },
  {
    icao: "LPPR",
    iata: "OPO",
    name: "Porto Airport",
    city: "Porto",
    countryCode: "PT",
    latitude: 41.24806,
    longitude: -8.68139,
    elevationFt: 228,
    isActive: true,
  },
  {
    icao: "LKPR",
    iata: "PRG",
    name: "Vaclav Havel Airport Prague",
    city: "Prague",
    countryCode: "CZ",
    latitude: 50.10083,
    longitude: 14.26,
    elevationFt: 1247,
    isActive: true,
  },
  {
    icao: "BKPR",
    iata: "PRN",
    name: "Pristina International Airport",
    city: "Pristina",
    countryCode: "XK",
    latitude: 42.57278,
    longitude: 21.0358,
    elevationFt: 1789,
    isActive: true,
  },
  {
    icao: "LDPL",
    iata: "PUY",
    name: "Pula Airport",
    city: "Pula",
    countryCode: "HR",
    latitude: 44.89353,
    longitude: 13.92219,
    elevationFt: 274,
    isActive: true,
  },
  {
    icao: "LFRN",
    iata: "RNS",
    name: "Rennes Saint-Jacques Airport",
    city: "Rennes",
    countryCode: "FR",
    latitude: 48.06951,
    longitude: -1.73479,
    elevationFt: 124,
    isActive: true,
  },
  {
    icao: "LIRF",
    iata: "FCO",
    name: "Leonardo da Vinci Rome Fiumicino Airport",
    city: "Rome",
    countryCode: "IT",
    latitude: 41.80028,
    longitude: 12.23889,
    elevationFt: 15,
    isActive: true,
  },
  {
    icao: "LEST",
    iata: "SCQ",
    name: "Santiago de Compostela Airport",
    city: "Santiago de Compostela",
    countryCode: "ES",
    latitude: 42.89633,
    longitude: -8.41514,
    elevationFt: 1213,
    isActive: true,
  },
  {
    icao: "LGSR",
    iata: "JTR",
    name: "Santorini Airport",
    city: "Santorini",
    countryCode: "GR",
    latitude: 36.39917,
    longitude: 25.47933,
    elevationFt: 127,
    isActive: true,
  },
  {
    icao: "LEZL",
    iata: "SVQ",
    name: "Seville Airport",
    city: "Seville",
    countryCode: "ES",
    latitude: 37.418,
    longitude: -5.89311,
    elevationFt: 112,
    isActive: true,
  },
  {
    icao: "HESH",
    iata: "SSH",
    name: "Sharm El Sheikh International Airport",
    city: "Sharm El Sheikh",
    countryCode: "EG",
    latitude: 27.9773,
    longitude: 34.39463,
    elevationFt: 143,
    isActive: true,
  },
  {
    icao: "LWSK",
    iata: "SKP",
    name: "Skopje International Airport",
    city: "Skopje",
    countryCode: "MK",
    latitude: 41.96162,
    longitude: 21.62138,
    elevationFt: 781,
    isActive: true,
  },
  {
    icao: "EGHI",
    iata: "SOU",
    name: "Southampton Airport",
    city: "Southampton",
    countryCode: "GB",
    latitude: 50.95026,
    longitude: -1.3568,
    elevationFt: 44,
    isActive: true,
  },
  {
    icao: "LDSP",
    iata: "SPU",
    name: "Split Airport",
    city: "Split",
    countryCode: "HR",
    latitude: 43.53894,
    longitude: 16.29796,
    elevationFt: 79,
    isActive: true,
  },
  {
    icao: "ESSA",
    iata: "ARN",
    name: "Stockholm Arlanda Airport",
    city: "Stockholm",
    countryCode: "SE",
    latitude: 59.65194,
    longitude: 17.91861,
    elevationFt: 137,
    isActive: true,
  },
  {
    icao: "LLBG",
    iata: "TLV",
    name: "Ben Gurion Airport",
    city: "Tel Aviv-Yafo",
    countryCode: "IL",
    latitude: 32.01139,
    longitude: 34.88667,
    elevationFt: 135,
    isActive: true,
  },
  {
    icao: "GCTS",
    iata: "TFS",
    name: "Tenerife South Airport",
    city: "Tenerife",
    countryCode: "ES",
    latitude: 28.04448,
    longitude: -16.57249,
    elevationFt: 209,
    isActive: true,
  },
  {
    icao: "UGTB",
    iata: "TBS",
    name: "Tbilisi International Airport",
    city: "Tbilisi",
    countryCode: "GE",
    latitude: 41.66917,
    longitude: 44.95472,
    elevationFt: 1624,
    isActive: true,
  },
  {
    icao: "GMTT",
    iata: "TNG",
    name: "Tangier Ibn Battouta Airport",
    city: "Tangier",
    countryCode: "MA",
    latitude: 35.72692,
    longitude: -5.91689,
    elevationFt: 62,
    isActive: true,
  },
  {
    icao: "LATI",
    iata: "TIA",
    name: "Tirana International Airport",
    city: "Tirana",
    countryCode: "AL",
    latitude: 41.4147,
    longitude: 19.72056,
    elevationFt: 126,
    isActive: true,
  },
  {
    icao: "LYTV",
    iata: "TIV",
    name: "Tivat Airport",
    city: "Tivat",
    countryCode: "ME",
    latitude: 42.40472,
    longitude: 18.72333,
    elevationFt: 20,
    isActive: true,
  },
  {
    icao: "LFBO",
    iata: "TLS",
    name: "Toulouse Blagnac Airport",
    city: "Toulouse",
    countryCode: "FR",
    latitude: 43.62928,
    longitude: 1.36382,
    elevationFt: 499,
    isActive: true,
  },
  {
    icao: "LEVC",
    iata: "VLC",
    name: "Valencia Airport",
    city: "Valencia",
    countryCode: "ES",
    latitude: 39.48931,
    longitude: -0.48163,
    elevationFt: 240,
    isActive: true,
  },
  {
    icao: "LIPZ",
    iata: "VCE",
    name: "Venice Marco Polo Airport",
    city: "Venice",
    countryCode: "IT",
    latitude: 45.50528,
    longitude: 12.35194,
    elevationFt: 7,
    isActive: true,
  },
] as const;

function normalizeOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function readAdminConfig(): AccountSeedConfig {
  return {
    email:
      normalizeOptionalString(process.env.SEED_ADMIN_EMAIL)?.toLowerCase() ??
      "admin@virtual-easyjet.local",
    username:
      normalizeOptionalString(process.env.SEED_ADMIN_USERNAME) ??
      "virtualeasyjet-admin",
    password:
      normalizeOptionalString(process.env.SEED_ADMIN_PASSWORD) ??
      "ChangeMe-Admin123!",
    firstName:
      normalizeOptionalString(process.env.SEED_ADMIN_FIRST_NAME) ?? "Virtual",
    lastName:
      normalizeOptionalString(process.env.SEED_ADMIN_LAST_NAME) ?? "Admin",
    countryCode:
      normalizeOptionalString(process.env.SEED_ADMIN_COUNTRY_CODE) ?? "FR",
    platformRole: UserPlatformRole.ADMIN,
    roleCodes: ["admin"],
    createPilotProfile: false,
  };
}

function readOptionalPilotConfig(): AccountSeedConfig | null {
  const email = normalizeOptionalString(process.env.SEED_PILOT_EMAIL)?.toLowerCase();
  const username = normalizeOptionalString(process.env.SEED_PILOT_USERNAME);
  const password = normalizeOptionalString(process.env.SEED_PILOT_PASSWORD);

  if (!email || !username || !password) {
    return null;
  }

  return {
    email,
    username,
    password,
    firstName:
      normalizeOptionalString(process.env.SEED_PILOT_FIRST_NAME) ?? "Pilot",
    lastName:
      normalizeOptionalString(process.env.SEED_PILOT_LAST_NAME) ?? "User",
    countryCode:
      normalizeOptionalString(process.env.SEED_PILOT_COUNTRY_CODE) ?? "FR",
    platformRole: UserPlatformRole.USER,
    roleCodes: ["pilot"],
    createPilotProfile: true,
    pilotNumber:
      normalizeOptionalString(process.env.SEED_PILOT_NUMBER) ?? "VA00001",
    callsign: normalizeOptionalString(process.env.SEED_PILOT_CALLSIGN),
    simbriefPilotId: normalizeOptionalString(process.env.SEED_PILOT_SIMBRIEF_ID),
    pilotStatus: PilotStatus.ACTIVE,
  };
}

async function resetOperationalData(): Promise<void> {
  await prisma.violation.deleteMany();
  await prisma.flightEvent.deleteMany();
  await prisma.telemetryPoint.deleteMany();
  await prisma.pirep.deleteMany();
  await prisma.acarsSession.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.route.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.staffNote.deleteMany();
  await prisma.pilotQualification.deleteMany();
  await prisma.checkride.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.newsPost.deleteMany();
  await prisma.contentPage.deleteMany();
  await prisma.pilotProfile.deleteMany();
}

async function seedRoles(): Promise<void> {
  const roles = [
    {
      code: "admin",
      name: "Administrator",
      description: "Full platform administration access.",
    },
    {
      code: "staff",
      name: "Staff",
      description: "Operational and moderation access.",
    },
    {
      code: "pilot",
      name: "Pilot",
      description: "Standard pilot access to the VA platform.",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }
}

async function seedRanks(): Promise<void> {
  const ranks = [
    {
      code: "CADET",
      name: "Cadet",
      sortOrder: 10,
      minFlights: 0,
      minHoursMinutes: 0,
      minScore: 0,
      description: "Initial rank assigned to a new pilot profile.",
    },
    {
      code: "FO",
      name: "First Officer",
      sortOrder: 20,
      minFlights: 3,
      minHoursMinutes: 600,
      minScore: 70,
      description: "Operational pilot rank for the short-haul network.",
    },
    {
      code: "CPT",
      name: "Captain",
      sortOrder: 30,
      minFlights: 6,
      minHoursMinutes: 3000,
      minScore: 80,
      description: "Confirmed captain rank on the main network.",
    },
    {
      code: "SCC",
      name: "Senior Captain",
      sortOrder: 40,
      minFlights: 12,
      minHoursMinutes: 6000,
      minScore: 88,
      description: "Senior rank reserved for the most consistent pilots.",
    },
  ];

  for (const rank of ranks) {
    await prisma.rank.upsert({
      where: { code: rank.code },
      update: rank,
      create: rank,
    });
  }
}

async function seedAircraftTypes(): Promise<void> {
  for (const aircraftType of PRODUCTION_AIRCRAFT_TYPES) {
    await prisma.aircraftType.upsert({
      where: {
        icaoCode: aircraftType.icaoCode,
      },
      update: aircraftType,
      create: aircraftType,
    });
  }
}

async function seedAirports(): Promise<void> {
  for (const airport of PRODUCTION_AIRPORTS) {
    await prisma.airport.upsert({
      where: {
        icao: airport.icao,
      },
      update: airport,
      create: airport,
    });
  }
}

async function ensureRoleAssignments(
  userId: string,
  roleCodes: string[],
): Promise<void> {
  const roles = await prisma.role.findMany({
    where: {
      code: {
        in: roleCodes,
      },
    },
    select: {
      id: true,
    },
  });

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });
  }
}

async function seedUserAccount(config: AccountSeedConfig): Promise<string> {
  const passwordHash = await hash(config.password, 12);

  const user = await prisma.user.upsert({
    where: {
      email: config.email,
    },
    update: {
      username: config.username,
      passwordHash,
      role: config.platformRole,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: config.email,
      username: config.username,
      passwordHash,
      role: config.platformRole,
      status: UserStatus.ACTIVE,
      avatarUrl: null,
    },
  });

  await ensureRoleAssignments(user.id, config.roleCodes);

  if (!config.createPilotProfile) {
    return user.id;
  }

  const cadetRank = await prisma.rank.findUniqueOrThrow({
    where: {
      code: "CADET",
    },
    select: {
      id: true,
    },
  });

  await prisma.pilotProfile.upsert({
    where: {
      userId: user.id,
    },
    update: {
      pilotNumber: config.pilotNumber ?? "VA00001",
      callsign: config.callsign ?? null,
      firstName: config.firstName,
      lastName: config.lastName,
      countryCode: config.countryCode ?? null,
      simbriefPilotId: config.simbriefPilotId ?? null,
      rankId: cadetRank.id,
      hubId: null,
      status: config.pilotStatus ?? PilotStatus.ACTIVE,
      experiencePoints: 0,
      hoursFlownMinutes: 0,
    },
    create: {
      userId: user.id,
      pilotNumber: config.pilotNumber ?? "VA00001",
      callsign: config.callsign ?? null,
      firstName: config.firstName,
      lastName: config.lastName,
      countryCode: config.countryCode ?? null,
      simbriefPilotId: config.simbriefPilotId ?? null,
      rankId: cadetRank.id,
      status: config.pilotStatus ?? PilotStatus.ACTIVE,
      experiencePoints: 0,
      hoursFlownMinutes: 0,
    },
  });

  return user.id;
}

async function findExistingAdmins() {
  return prisma.user.findMany({
    where: {
      OR: [
        {
          role: UserPlatformRole.ADMIN,
        },
        {
          roles: {
            some: {
              role: {
                code: "admin",
              },
            },
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      email: true,
    },
  });
}

async function ensureBootstrapAdmin(adminConfig: AccountSeedConfig): Promise<string> {
  const existingAdmins = await findExistingAdmins();

  if (existingAdmins.length > 0) {
    for (const admin of existingAdmins) {
      await prisma.user.update({
        where: {
          id: admin.id,
        },
        data: {
          role: UserPlatformRole.ADMIN,
        },
      });
      await ensureRoleAssignments(admin.id, ["admin"]);
    }

    return existingAdmins[0]!.id;
  }

  return seedUserAccount(adminConfig);
}

async function seedSettings(adminUserId: string): Promise<void> {
  const settings = [
    {
      key: "acars.thresholds",
      value: {
        hardLandingFpm: -500,
        overspeedGraceSeconds: 15,
        resumeTimeoutMinutes: 20,
      },
      description: "ACARS detection thresholds used by the MVP rules engine.",
      isPublic: false,
    },
    {
      key: "public.branding",
      value: {
        airlineName: "Virtual Easyjet",
        airlineCode: "VEJ",
      },
      description: "Public branding displayed by the website.",
      isPublic: true,
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: {
        key: setting.key,
      },
      update: {
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: adminUserId,
      },
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: adminUserId,
      },
    });
  }
}

async function main(): Promise<void> {
  const adminConfig = readAdminConfig();
  const optionalPilotConfig = readOptionalPilotConfig();

  await resetOperationalData();
  await seedRoles();
  await seedRanks();
  await seedAirports();
  await seedAircraftTypes();

  const adminUserId = await ensureBootstrapAdmin(adminConfig);

  if (optionalPilotConfig) {
    await seedUserAccount(optionalPilotConfig);
  }

  await seedSettings(adminUserId);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
