export type ProvinceId = "industry" | "south" | "north";
export type Domain = "production" | "social" | "anomaly";
export type Issue = "disclosure" | "authority" | "economy" | "method";
export type FactionId = "technocrat" | "popular" | "security";
export type Strategy =
  | "coordinate"
  | "force"
  | "compensate"
  | "negotiate"
  | "delegate";
export interface Person {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  skills: Record<Domain, number>;
  stance: Record<Issue, number>;
  ability: string;
  specialty: Domain;
}
export interface Office {
  id: string;
  name: string;
  short: string;
  province?: ProvinceId;
  domains: Domain[];
}
export interface Province {
  id: ProvinceId;
  name: string;
  subtitle: string;
  districts: { name: string; type: string; output: number }[];
  stock: number;
  pressure: Record<Domain, number>;
  autonomy: number;
}
export interface Project {
  id: string;
  name: string;
  province: ProvinceId;
  age: number;
  output: number;
  risk: boolean;
}
export interface Effect {
  treasury?: number;
  capital?: number;
  crisis?: number;
  stock?: number;
  pressure?: Partial<Record<Domain, number>>;
  spread?: number;
  paralysis?: number;
  extra?: number;
  project?: { name: string; output: number; risk: boolean };
  autonomy?: number;
}
export interface Option {
  id: string;
  name: string;
  description: string;
  issue: Issue;
  side: number;
  commands: number;
  treasury: number;
  stock: number;
  ability: number;
  effect: Effect;
}
export interface EventCard {
  id: string;
  title: string;
  description: string;
  category: "base" | "chain" | "active";
  province: ProvinceId;
  district: number;
  domain: Domain;
  lead: string;
  participants: string[];
  options: Option[];
  consequence: Effect;
  reveal?: Effect;
  deck?: "survey" | "build" | "reform";
}
export interface Task {
  uid: string;
  cardId: string;
  created: number;
  age: number;
}
export interface Log {
  turn: number;
  text: string;
  kind: "info" | "good" | "bad";
}
export interface GameState {
  version: 1;
  seed: string;
  rng: number;
  turn: number;
  commands: number;
  treasury: number;
  capital: number;
  crisis: number;
  insolvency: number;
  paralysis: number;
  paralysisStreak: number;
  status: "playing" | "won" | "lost";
  ending?: string;
  provinces: Province[];
  appointments: Record<string, string | null>;
  grievances: Record<string, number>;
  roots: Record<string, number>;
  politicalTriggered: string[];
  factionSupport: Record<FactionId, number>;
  factions: Record<FactionId, { influence: number; discontent: number }>;
  jurisdictions: Record<string, string>;
  projects: Project[];
  tasks: Task[];
  backlog: Task[];
  admitted: number;
  nextId: number;
  resolved: number;
  policies: Record<Issue, number | null>;
  used: string[];
  logs: Log[];
}
export interface Choice {
  optionId: string;
  strategies: Partial<Record<ConflictType, Strategy>>;
}
export type ConflictType = "jurisdiction" | "route" | "interest";
export interface Conflict {
  type: ConflictType;
  title: string;
  reason: string;
  opponents: string[];
  strategy: Strategy;
  commands: number;
  treasury: number;
  capital: number;
  future: string;
}
export interface Preview {
  task: Task;
  card: EventCard;
  option: Option;
  participants: { office: Office; person?: Person }[];
  lead: string;
  ability: number;
  required: number;
  conflicts: Conflict[];
  base: number;
  resentmentCost: number;
  commands: number;
  treasury: number;
  capital: number;
  stock: number;
  after: { commands: number; treasury: number; capital: number; stock: number };
  final: { commands: number; treasury: number; capital: number; stock: number };
  errors: string[];
  effects: string[];
}
