import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
});
try {
  const { runGovernanceTrial } = await server.ssrLoadModule(
    "/scripts/governance-trial.ts",
  );
  const { runStrategyCampaign } = await server.ssrLoadModule(
    "/scripts/strategyCampaigns.ts",
  );
  const { challengingSparkAlternative } = await server.ssrLoadModule(
    "/scripts/challenging-alternative.ts",
  );
  const { trialReport } = await server.ssrLoadModule(
    "/src/v2/governanceTrial.ts",
  );
  const { executeCommand, previewAction, serializeV2, deserializeV2 } =
    await server.ssrLoadModule("/src/v2/engine.ts");
  const perTurn = (r) => {
    let g = structuredClone(r.opening);
    const turns = [];
    for (const t of r.trace) {
      if (t.action.type === "end") g = deserializeV2(serializeV2(g));
      const p = previewAction(g, t.action),
        n = executeCommand(g, t.action);
      assert.notEqual(n.result.status, "failed");
      if (t.action.type === "end")
        turns.push({
          turn: g.core.turn,
          commandsLeft: g.core.commands,
          commandsUsed:
            (turns.at(-1)?.nextCommands ?? r.opening.core.commands) -
            g.core.commands,
          actionTypes: Object.fromEntries(
            [
              ...new Set(
                r.trace
                  .filter(
                    (x) => x.turn === g.core.turn && x.action.type !== "end",
                  )
                  .map((x) => x.action.type),
              ),
            ].map((type) => [
              type,
              r.trace.filter(
                (x) => x.turn === g.core.turn && x.action.type === type,
              ).length,
            ]),
          ),
          decisions: r.trace.filter(
            (x) => x.turn === g.core.turn && x.action.type !== "end",
          ).length,
          nextCommands: n.game.core.commands,
          crises: g.machine.matters.map((m) => ({
            id: m.id,
            kind: m.kind,
            stage: m.stage,
          })),
          works: g.machine.works
            .filter((w) => !w.cancelled)
            .map((w) => ({
              id: w.id,
              type: w.type,
              progress: w.progress,
              completed: w.completed,
            })),
        });
      assert.ok(p.errors.length === 0);
      g = n.game;
    }
    assert.equal(serializeV2(g), serializeV2(r.game));
    return turns;
  };
  const report = {
    version: "0.8.5",
    scope:
      "Actual commands and original settlement, not human playtesting. Four-meeting scenario has disclosed central32/locals10,5,10/cult6/capital8 and five commands. Twelve-turn scripts use unchanged standard budgets/costs. Decisions counts exclude end/preview and include zero-command administrative adjustments; they do not measure meaningful choice, difficulty or fatigue.",
    humanReadability:
      "NOT RUN: see HUMAN_PLAYTEST.md and blank CSV. Independent observer required.",
    trials: [],
    standard12: [],
    challengingAlternative: null,
  };
  for (const route of ["central", "local", "professional"]) {
    const r = runGovernanceTrial(route);
    assert.equal(r.game.core.status, "won");
    assert.ok(r.checks.every((c) => c.met));
    assert.equal(r.settlements.length, 4);
    const grid = r.game.machine.works.find((w) => w.type === "grid");
    report.trials.push({
      route,
      status: r.game.core.status,
      checks: r.checks,
      grid,
      appointments: r.game.core.appointments,
      secondaryAppointments: r.game.machine.secondaryAppointments,
      training: r.game.machine.trainings,
      agendas: r.game.machine.agendas,
      turns: perTurn(r),
      trace: r.trace,
      ending: trialReport(r.game),
    });
  }
  for (const goal of [
    "spark",
    "accord",
    "night",
    "traffic",
    "learning",
    "prosperity",
    "codex",
    "comms",
  ])
    for (const branch of ["central", "plural"]) {
      const config = {
          goal,
          branch,
          seed: `v08-${goal}-${branch}`,
          difficulty: "standard",
          politics: "classic",
        },
        r = runStrategyCampaign(config);
      assert.equal(r.game.core.status, "won");
      assert.ok(r.checks.every((c) => c.met));
      report.standard12.push({
        config,
        status: r.game.core.status,
        turns: perTurn(r),
      });
    }
  const alternative = challengingSparkAlternative();
  assert.equal(alternative.game.core.status, "won");
  assert.equal(alternative.opening.core.treasury, 9);
  report.challengingAlternative = {
    scope:
      "Separate witness, original 80-sample recipes/report unchanged. This disproves impossibility for this one initial situation; it is not comprehensive challenge balance.",
    config: {
      goal: "spark",
      branch: "central",
      seed: "v08-spark-central",
      difficulty: "challenging",
      politics: "classic",
    },
    initialCentral: alternative.opening.core.treasury,
    status: alternative.game.core.status,
    finalCentral: alternative.game.core.treasury,
    checks: alternative.checks,
    trace: alternative.trace,
    turns: perTurn(alternative),
  };
  // Objective answer key for screenshots, kept separate from the blank human sheet.
  const G = await server.ssrLoadModule("/src/v2/governance.ts");
  const local = runGovernanceTrial("local");
  let risk = structuredClone(local.opening);
  for (const t of local.trace) {
    if (t.action.type === "maintenanceSponsor") break;
    risk = executeCommand(risk, t.action).game;
  }
  risk = executeCommand(risk, {
    type: "fiscalTransfer",
    province: "south",
    direction: "levy",
    amount: 2,
  }).game;
  let fixed = executeCommand(risk, {
    type: "appoint",
    office: "plan",
    person: "wen",
  }).game;
  const grid = fixed.machine.works.find((w) => w.type === "grid");
  fixed = executeCommand(fixed, {
    type: "maintenanceSponsor",
    work: grid.id,
    account: "central",
  }).game;
  const facts = (g) => ({
    turn: g.core.turn,
    commands: g.core.commands,
    affairs: G.currentAffairs(g),
    offices: G.organizationBoard(g).map((o) => ({
      id: o.id,
      person: o.person,
      marks: o.marks,
    })),
    works: g.machine.works.map((w) => G.engineeringCard(g, w)),
    missingTargets: G.governanceTargets(g).filter((c) => !c.met),
  });
  report.screenshotFacts = {
    "Case-E-first-meeting": facts(local.opening),
    "Case-A-risk": facts(risk),
    "Case-B-components": facts(risk),
    "Case-C-bottleneck": facts(risk),
    "Case-D-reorganized": facts(fixed),
  };
  const matrix = JSON.parse(
    await readFile("docs/V85_CAMPAIGN_MATRIX.json", "utf8"),
  );
  report.original80 = matrix.summary;
  assert.deepEqual(matrix.summary, { total: 80, won: 71, failed: 9 });
  await mkdir("docs/v85", { recursive: true });
  await writeFile(
    "docs/v85/PLAYABILITY_EVIDENCE.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "PASS: three distinct four-turn organizations; 16 standard twelve-turn policies; one unchanged-resource challenging alternative. Independent human readability/pace evaluation NOT RUN.",
  );
} finally {
  await server.close();
}
