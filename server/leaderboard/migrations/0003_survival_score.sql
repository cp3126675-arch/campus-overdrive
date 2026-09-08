-- New score season; preserve all legacy time-only tables and identities for rollback.
CREATE TABLE survival_score_best_runs (
  player_id TEXT NOT NULL REFERENCES players(id),
  department_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 0),
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY(player_id, department_id)
);
CREATE INDEX survival_score_department_ranking ON survival_score_best_runs(department_id, score DESC, time_ms, completed_at, player_id);
CREATE TABLE survival_score_overall_best (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  department_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK(score >= 0),
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL
);
CREATE INDEX survival_score_overall_ranking ON survival_score_overall_best(score DESC, time_ms, completed_at, player_id);
