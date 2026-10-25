import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
});
const goals = [
  "spark",
  "accord",
  "night",
  "traffic",
  "learning",
  "prosperity",
  "codex",
  "comms",
];
const report = {
  scope:
    "Fixed classic opening. 16 scripted policies, 3 standard seeds and one relaxed/challenging sample each. Scripts are witnesses, not adaptive players; a failed script does not prove a goal impossible. All money, projects and people use executeCommand; no resource injection.",
  runs: [],
};
try {
  const { runStrategyCampaign } = await server.ssrLoadModule(
    "/scripts/strategyCampaigns.ts",
  );
  for (const difficulty of ["standard", "relaxed", "challenging"])
    for (const sample of difficulty === "standard" ? [0, 1, 2] : [0])
      for (const goal of goals)
        for (const branch of ["central", "plural"]) {
          const config = {
            goal,
            branch,
            difficulty,
            politics: "classic",
            seed:
              sample === 0
                ? `v08-${goal}-${branch}`
                : `v08-matrix-${sample}-${goal}-${branch}`,
          };
          try {
            const r = runStrategyCampaign(config);
            assert.equal(r.game.core.status, "won");
            assert.equal(r.game.machine.finalDone, true);
            assert.equal(r.settlements.length, 12);
            assert.ok(r.checks.every((c) => c.met));
            report.runs.push({
              ...config,
              status: "won",
              actions: r.trace.length,
              reloads:
                typeof r.reloads === "number" ? r.reloads : r.reloads.length,
              minCentral: Math.min(
                r.opening.core.treasury,
                ...r.trace.map((x) => x.cash),
              ),
              finalCentral: r.game.core.treasury,
              minLocals: Object.fromEntries(
                ["industry", "south", "north"].map((p) => [
                  p,
                  Math.min(
                    r.opening.machine.fiscal.locals[p],
                    ...r.trace.map((x) => x.local[p]),
                  ),
                ]),
              ),
              maxCrisis: Math.max(...r.trace.map((x) => x.crisis)),
              maxParalysis: Math.max(...r.trace.map((x) => x.paralysis)),
              minCommands: Math.min(...r.trace.map((x) => x.commands)),
              centralDefaultSettlements: r.settlements.filter((f) => f.default)
                .length,
              localDefaultSettlements: r.settlements.filter((f) =>
                f.locals.some((x) => x.default),
              ).length,
              maintenanceArrearsSettlements: r.settlements.filter((f) =>
                f.facilities.some((w) => w.maintenance.arrears > 0),
              ).length,
              cashByTurn: r.settlements.map((f, i) => ({
                turn: i + 1,
                current: f.current,
                income: f.income,
                obligation: f.total,
                next: f.next,
                defaults: f.locals
                  .filter((x) => x.default)
                  .map((x) => x.province),
                arrears: f.facilities
                  .filter((w) => w.maintenance.arrears > 0)
                  .map((w) => ({
                    work: w.work,
                    arrears: w.maintenance.arrears,
                  })),
              })),
            });
          } catch (e) {
            report.runs.push({
              ...config,
              status: "script_failed",
              reason: e.message,
            });
          }
        }
  report.summary = {
    total: report.runs.length,
    won: report.runs.filter((r) => r.status === "won").length,
    failed: report.runs.filter((r) => r.status !== "won").length,
  };
  await writeFile(
    process.argv[2] || "docs/V85_CAMPAIGN_MATRIX.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.summary));
  for (const r of report.runs.filter((r) => r.status !== "won"))
    console.log(r.difficulty, r.seed, r.goal, r.branch, r.reason.slice(0, 240));
  // Only the documented standard witness is the deterministic regression gate.
  assert.ok(
    report.runs
      .filter(
        (r) =>
          r.difficulty === "standard" &&
          r.seed.startsWith("v08-") &&
          !r.seed.startsWith("v08-matrix"),
      )
      .every((r) => r.status === "won"),
  );
} finally {
  await server.close();
}
