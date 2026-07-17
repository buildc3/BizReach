export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeOnBoot } = await import("@/lib/services/send-queue");
  await resumeOnBoot();
}
