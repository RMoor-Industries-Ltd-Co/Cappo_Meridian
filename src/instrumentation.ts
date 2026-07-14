export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startLexiconDailySync } = await import("@/lib/lexiconScheduler");
  startLexiconDailySync();
  const { startCappoReportScheduler } = await import("@/lib/cappoReportScheduler");
  startCappoReportScheduler();
}
