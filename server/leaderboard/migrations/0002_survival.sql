-- Additive migration: race scores and player identities remain intact.
CREATE TABLE survival_best_runs (
  player_id TEXT NOT NULL REFERENCES players(id),
  department_id TEXT NOT NULL,
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY(player_id, department_id)
);
CREATE INDEX survival_department_ranking ON survival_best_runs(department_id, time_ms DESC, completed_at, player_id);
CREATE TABLE survival_overall_best (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  department_id TEXT NOT NULL,
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL
);
CREATE INDEX survival_overall_ranking ON survival_overall_best(time_ms DESC, completed_at, player_id);
