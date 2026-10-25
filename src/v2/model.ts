import type { GameState, Issue, ProvinceId, FactionId } from "../types";
export type Regime = "vertical" | "devolved" | "joint";
export type Mode = "tutorial" | "campaign" | "national" | "experimental";
export type Difficulty = "relaxed" | "standard" | "challenging";
export type Lifecycle =
  | "unrevealed"
  | "revealed"
  | "processing"
  | "partial"
  | "resolved"
  | "deteriorated";
export type Goal =
  | "spark"
  | "accord"
  | "night"
  | "traffic"
  | "learning"
  | "prosperity"
  | "codex"
  | "comms";
export type Capability =
  | "mobilize"
  | "seal"
  | "leywork"
  | "industry"
  | "transport"
  | "rapid"
  | "joint";
export type MatterKind =
  | "warning"
  | "accident"
  | "supply"
  | "distrust"
  | "oldgod"
  | "gazette"
  | "opportunity"
  | "final"
  | "energyFault"
  | "fiscalClaim";
export interface Matter {
  id: string;
  title: string;
  description: string;
  province: ProvinceId;
  kind: MatterKind;
  stage: number;
  containment: number;
  evacuated: boolean;
  isolated: boolean;
  source?: string;
  variant?: string;
  age: number;
  lifecycle?: Lifecycle;
  steps?: string[];
  lastOptionTurn?: number;
  lastOption?: string;
}
export interface History {
  id: string;
  turn: number;
  title: string;
  actors: string[];
  institutions: string[];
  conditions: string[];
  effects: string[];
  parents: string[];
}
export type WorkType =
  | "energy"
  | "warning"
  | "farm"
  | "factory"
  | "port"
  | "cooperative"
  | "rail"
  | "grid"
  | "academy"
  | "relay";
export type TaxSystem = "split" | "central" | "autonomy";
export type FiscalAccount = "central" | ProvinceId | "cult";
export type FundingMode = "central" | "local" | "joint" | "multi" | "cult";
export interface LedgerEntry {
  id: string;
  turn: number;
  from: FiscalAccount | "economy";
  to: FiscalAccount | "public";
  amount: number;
  reason: string;
  source: string;
  category:
    | "tax"
    | "operation"
    | "investment"
    | "transfer"
    | "maintenance"
    | "audit";
}
export interface FiscalState {
  taxSystem: TaxSystem;
  locals: Record<ProvinceId, number>;
  cultTreasury: number;
  agreements: ProvinceId[];
  autonomous: Record<ProvinceId, boolean>;
  localFacilities: Record<ProvinceId, boolean>;
  ledger: LedgerEntry[];
  settlements: number;
  stableTurns: number;
  localDefaults: Record<ProvinceId, number>;
  claims: ProvinceId[];
}
export interface FundingContract {
  mode: FundingMode;
  shares: { account: FiscalAccount; weight: number }[];
  owner: FiscalAccount | "joint";
  beneficiary?: ProvinceId;
  source: string;
}
export type Department = "anomaly" | "evacuation" | "transport";
export type WorkAssignment = "advisor" | "dedicated";
export interface Maintenance {
  turn: number;
  fee: number;
  due: number;
  paid: number;
  arrears: number;
  payments: {
    account: FiscalAccount;
    due: number;
    paid: number;
    arrears: number;
  }[];
  lastPaidTurn?: number;
  source: string;
}
export type TrainingCap = "leywork" | "mobilize" | "seal";
export interface Training {
  id: string;
  mentor?: string;
  student?: string;
  cap: TrainingCap;
  province: ProvinceId;
  facility?: string;
  method: "field" | "academy" | "legacy";
  start: number;
  progress: number;
  duration: number;
  state: "active" | "paused" | "completed" | "cancelled" | "unassigned";
  completedAt?: number;
  reason: string;
  source: string;
}
export type RegionFeature =
  | "leyline"
  | "industrial"
  | "eldritch"
  | "jianghu"
  | "rural"
  | "civic"
  | "aerial"
  | "coastal";
export interface Work {
  id: string;
  type: WorkType;
  province: ProvinceId;
  progress: number;
  duration: number;
  paused: boolean;
  worker?: string;
  completed: boolean;
  source: string;
  assignment?: WorkAssignment;
  to?: ProvinceId;
  cancelled?: boolean;
  contract?: FundingContract;
  maintenance?: Maintenance;
  maintenanceSponsor?: FiscalAccount;
  sponsorSource?: string;
  network?: {
    active: boolean;
    fault: boolean;
    faultAt?: number;
    faultSeen?: boolean;
    consentUntil?: number;
  };
}
export interface Machine {
  agendas?: { seen: string[]; items: FactionAgenda[] };
  governanceTrial?: { id: "four-meetings"; source: string };
  storylines?: { work: string; decisions: StoryDecision[] }[];
  advisor?: { seen: string[]; cooldowns: Record<string, number> };
  strategy?: {
    branch?: "central" | "plural";
    source?: string;
    chosenAt?: number;
    legalRecords: {
      province: ProvinceId;
      work: string;
      signature: string;
      source: string;
      turn: number;
    }[];
    dispatches: {
      matter: string;
      province: ProvinceId;
      source: string;
      turn: number;
    }[];
  };
  mode: Mode;
  goal: Goal;
  regime: Regime;
  pending?: { regime: Regime; due: number; source: string };
  department: "none" | "anomaly" | "evacuation" | "transport";
  departmentPending?: {
    type: "anomaly" | "evacuation" | "transport";
    due: number;
    source: string;
    scope?: ProvinceId | "nation";
  };
  overrides: Record<string, string>;
  authorization: Record<
    string,
    {
      lead: string;
      joint: boolean;
      emergency: boolean;
      expires: number;
      source: string;
    }
  >;
  matters: Matter[];
  backlog: Matter[];
  admitted: number;
  history: History[];
  origins: Record<string, string>;
  budgets: ProvinceId[];
  rights: Record<ProvinceId, boolean>;
  trust: Record<ProvinceId, number>;
  fatigue: Record<ProvinceId, number>;
  suppressed: Record<ProvinceId, boolean>;
  occupied: Record<string, string>;
  knowledge: boolean;
  surveyed: boolean;
  standards: boolean;
  cooperation: boolean;
  reserve: boolean;
  permit: boolean;
  works: Work[];
  accidentRoute?: string;
  finalDone: boolean;
  tutorial: number;
  milestones: string[];
  goalPending: boolean;
  revision: number;
  archive: Matter[];
  results: ActionResult[];
  difficulty: Difficulty;
  rulesVersion: string;
  migratedFrom?: string;
  migrationNotes?: string[];
  politics: "random" | "classic";
  terminalInspected?: boolean;
  agendaSeen: string[];
  opening?: { template: Regime; risk: ProvinceId; summary: string[] };
  departments: Record<Department, ProvinceId[]>;
  departmentBudgets: Record<"plan" | "anomaly" | "defense", 0 | 1 | 2>;
  audits: Partial<
    Record<ProvinceId, { last: number; rounds: number; bonusUntil: number }>
  >;
  discoveries: Record<ProvinceId, string[]>;
  coordination: Partial<Record<ProvinceId, number>>;
  prepared?: { regime: Regime; until: number; supporters: string[] };
  drillsUntil: number;
  fiscal?: FiscalState;
  secondaryAppointments?: Record<string, string | null>;
  demonstration?: { id: "succession"; failed: boolean; reserveSource?: string };
  trainings?: Training[];
  regionFeatures?: Record<ProvinceId, RegionFeature[]>;
  relationships?: {
    id: string;
    kind: "cooperation";
    actors: string[];
    institutions: string[];
    source: string;
    turn: number;
    province: ProvinceId;
  }[];
}
export interface V2Game {
  schema: 2;
  core: GameState;
  machine: Machine;
}
export type Action =
  | {
      type: "agendaDecision";
      agenda: string;
      choice: "accept" | "negotiate" | "delay" | "reject";
    }
  | ({ type: "storyDecision"; work: string } & (
      | { chapter: "charter"; choice: "central" | "local" }
      | {
          chapter: "teaching";
          choice: "field" | "academy";
          mentor: string;
          student: string;
          cap: TrainingCap;
          facility?: string;
        }
      | { chapter: "tax"; choice: "central" | "autonomy" }
    ))
  | { type: "strategyBranch"; branch: "central" | "plural" }
  | { type: "lawRegister"; province: ProvinceId; work: string }
  | { type: "dispatch"; matter: string }
  | { type: "demoReserve" }
  | { type: "selectGoal"; goal: Goal }
  | { type: "inspect" }
  | {
      type: "resolve";
      matter: string;
      option: string;
      force?: boolean;
      exchange?: "ownership" | "budget" | "central";
    }
  | {
      type: "authorize";
      matter: string;
      lead: string;
      joint: boolean;
      emergency: boolean;
    }
  | { type: "regime"; regime: Regime }
  | {
      type: "department";
      department: Department;
      scope?: ProvinceId | "nation";
    }
  | { type: "local"; province: ProvinceId; lead: string }
  | { type: "appoint"; office: string; person: string | null }
  | { type: "policy"; issue: Issue; side: number }
  | { type: "mediate"; person: string }
  | {
      type: "project";
      project: WorkType;
      province: ProvinceId;
      worker?: string;
      assignment?: WorkAssignment;
      to?: ProvinceId;
      funding?: FundingMode;
      partner?: ProvinceId;
    }
  | { type: "concurrent"; office: string; person: string | null }
  | { type: "personSkill"; person: string; province: ProvinceId }
  | {
      type: "train";
      mentor: string;
      student: string;
      cap: TrainingCap;
      province: ProvinceId;
      method: "field" | "academy";
      facility?: string;
    }
  | {
      type: "trainingControl";
      training: string;
      operation: "cancel" | "resume";
      mentor?: string;
    }
  | { type: "legacyTraining"; training: string; student: string }
  | { type: "maintain"; work: string }
  | { type: "maintenanceSponsor"; work: string; account: FiscalAccount }
  | { type: "fiscalReform"; system: TaxSystem }
  | {
      type: "fiscalTransfer";
      province: ProvinceId;
      direction: "grant" | "levy";
      amount: number;
    }
  | { type: "fiscalAgreement"; province: ProvinceId }
  | { type: "localAutonomy"; province: ProvinceId; enabled: boolean }
  | {
      type: "network";
      work: string;
      operation: "repair" | "close" | "reopen" | "consent";
    }
  | { type: "borderSupply"; route: "rail" | "jianghu" | "local" }
  | { type: "workControl"; work: string; operation: "cancel" | "restart" }
  | { type: "audit"; province: ProvinceId; lead: string }
  | {
      type: "budget";
      department: "plan" | "anomaly" | "defense";
      level: 0 | 1 | 2;
    }
  | {
      type: "survey";
      province: ProvinceId;
      field: "resources" | "routes" | "anomaly";
    }
  | {
      type: "coordinate";
      province: ProvinceId;
      kind: "agreement" | "exercise" | "prepare";
      regime?: Regime;
    }
  | { type: "transfer"; from: ProvinceId; to: ProvinceId; amount: number }
  | { type: "pause"; work: string }
  | {
      type: "investigate";
      deck: "ley" | "archive" | "standards" | "civic";
      province?: ProvinceId;
    }
  | { type: "reconcile"; province: ProvinceId }
  | { type: "unblock" }
  | { type: "forecast" }
  | { type: "skip" }
  | { type: "end" };
export interface StoryDecision {
  chapter: "charter" | "teaching" | "tax";
  choice: string;
  turn: number;
  source: string;
  operation?: string;
  training?: string;
}
export interface FactionAgenda {
  id: string;
  kind: "construction-budget" | "maintenance-voice";
  work: string;
  province: ProvinceId;
  office: string;
  issuer: string;
  faction: FactionId;
  created: number;
  deadline: number;
  deferred: boolean;
  delaySource?: string;
  resumeAfter?: number;
  source: string;
  trigger: string;
  state:
    | "active"
    | "accepted"
    | "negotiated"
    | "rejected"
    | "expired"
    | "superseded";
  decisionSource?: string;
}
export interface Condition {
  label: string;
  met: boolean;
  reason: string;
  source?: string;
}
export interface V2Preview {
  action: Action;
  title: string;
  conditions: Condition[];
  errors: string[];
  costs: {
    commands: number;
    treasury: number;
    capital: number;
    stock: number;
    province?: ProvinceId;
  };
  actors: string[];
  institutions: string[];
  effects: string[];
  after: { commands: number; treasury: number; capital: number };
  opponents: string[];
  parents: string[];
}
export interface Plan {
  id: string;
  title: string;
  description: string;
  disclosure?: 0 | 1;
  cap?: Capability;
  command: number;
  treasury: number;
  stock: number;
  scope: "local" | "national" | "joint";
  effect:
    | "repair"
    | "public"
    | "seal"
    | "contain"
    | "evacuate"
    | "isolate"
    | "supply"
    | "ownership"
    | "standard"
    | "cooperate"
    | "permit"
    | "reserve"
    | "suppress"
    | "activate"
    | "invest"
    | "archive";
}
export type ResultStatus =
  | "failed"
  | "partial"
  | "resolved"
  | "changed"
  | "applied";
export interface ActionResult {
  id: string;
  revision: number;
  turn: number;
  action: Action;
  status: ResultStatus;
  title: string;
  effects: string[];
  completed: string[];
  remaining: string[];
  errors: string[];
  costs: V2Preview["costs"];
  phase?: { before: number; after?: number };
}
