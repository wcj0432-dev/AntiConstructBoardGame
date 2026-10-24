import type { ProvinceId } from "../types";
import type { RegionFeature } from "./model";
export type PlannedProvinceId = "east-sea" | "west-march";
export const expansionDesign: Record<
  PlannedProvinceId,
  {
    name: string;
    features: RegionFeature[];
    dependencies: {
      province: ProvinceId;
      kind: "energy" | "logistics" | "education";
    }[];
    institutions: string[];
    conflict: string;
    playable: false;
  }
> = {
  "east-sea": {
    name: "东海魔法都市省",
    features: ["civic", "coastal", "industrial"],
    dependencies: [
      { province: "south", kind: "energy" },
      { province: "industry", kind: "logistics" },
    ],
    institutions: ["都市救援联社", "魔法少女代表会议"],
    conflict: "都市税源、公开救援和国家安全保密权限如何分配",
    playable: false,
  },
  "west-march": {
    name: "西陲江湖自治省",
    features: ["jianghu", "rural", "leyline"],
    dependencies: [
      { province: "north", kind: "logistics" },
      { province: "south", kind: "education" },
    ],
    institutions: ["江湖承诺公所", "自治门派议事会"],
    conflict: "私人承诺、国家运输标准与地方合同执行如何互认",
    playable: false,
  },
};
