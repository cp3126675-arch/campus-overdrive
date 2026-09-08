// Scores reward coursework and submitted exams, never elapsed time.
export const EXAM_SCORE = {
  practiceCap: 300,
  examBase: 1000,
  examStep: 200,
  quickBonus: 450,
  examLimit: 45,
  nextAfterTimeout: 8,
};
export function examPoints(passedBefore: number, seconds: number) {
  return (
    EXAM_SCORE.examBase +
    passedBefore * EXAM_SCORE.examStep +
    Math.max(0, EXAM_SCORE.quickBonus - Math.floor(Math.max(0, seconds) * 10))
  );
}
export function badgeStudyPoints(previous: number, next: number) {
  let points = 0;
  for (let level = previous + 1; level <= Math.min(14, next); level++)
    points += level * 40;
  return points;
}
