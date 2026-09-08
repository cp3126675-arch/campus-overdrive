CREATE TABLE players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE best_runs (
  player_id TEXT NOT NULL REFERENCES players(id),
  department_id TEXT NOT NULL,
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY(player_id, department_id)
);
CREATE INDEX department_ranking ON best_runs(department_id, time_ms, completed_at, player_id);
CREATE TABLE overall_best (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  department_id TEXT NOT NULL,
  time_ms INTEGER NOT NULL CHECK(time_ms > 0),
  completed_at INTEGER NOT NULL,
  version TEXT NOT NULL
);
CREATE INDEX overall_ranking ON overall_best(time_ms, completed_at, player_id);
