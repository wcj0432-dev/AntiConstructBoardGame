import type { GameState, Issue, ProvinceId } from "../types";
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
export type Goal = "spark" | "accord" | "night";
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
  | "final";
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
  "energy" | "warning" | "farm" | "factory" | "port" | "cooperative" | "rail";
export type Department = "anomaly" | "evacuation" | "transport";
export type WorkAssignment = "advisor" | "dedicated";
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
}
export interface Machine {
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
}
export interface V2Game {
  schema: 2;
  core: GameState;
  machine: Machine;
}
export type Action =
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
    }
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
  | { type: "investigate"; deck: "ley" | "archive" | "standards" | "civic" }
  | { type: "reconcile"; province: ProvinceId }
  | { type: "unblock" }
  | { type: "forecast" }
  | { type: "skip" }
  | { type: "end" };
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
  "failed" | "partial" | "resolved" | "changed" | "applied";
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
