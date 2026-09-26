"use client";

import type { AppRoute } from "@/store/app-store";
import { WorkerDashboard } from "./screens/worker-dashboard";
import { WorkerJobs } from "./screens/worker-jobs";
import { WorkerJobScreen, WorkerJobMissing } from "./screens/worker-job";
import { WorkerSchedule } from "./screens/worker-schedule";
import { WorkerAvailability } from "./screens/worker-availability";
import { WorkerEarnings } from "./screens/worker-earnings";
import { WorkerWelfare } from "./screens/worker-welfare";
import { WorkerGovernance } from "./screens/worker-governance";
import { WorkerVerification } from "./screens/worker-verification";
import { WorkerSkills } from "./screens/worker-skills";
import { WorkerSupport } from "./screens/worker-support";
import { WorkerProfile } from "./screens/worker-profile";

/**
 * Worker platform — route switch.
 * Each screen lives in ./screens and receives its route params as props.
 */
export function WorkerApp({ route }: { route: AppRoute }) {
  switch (route.name) {
    case "worker-dashboard":
      return <WorkerDashboard />;
    case "worker-jobs":
      return <WorkerJobs />;
    case "worker-job":
      return route.params.bookingId ? (
        <WorkerJobScreen key={route.params.bookingId} bookingId={route.params.bookingId} />
      ) : (
        <WorkerJobMissing />
      );
    case "worker-schedule":
      return <WorkerSchedule />;
    case "worker-availability":
      return <WorkerAvailability />;
    case "worker-earnings":
      return <WorkerEarnings />;
    case "worker-welfare":
      return <WorkerWelfare />;
    case "worker-governance":
      return <WorkerGovernance />;
    case "worker-verification":
      return <WorkerVerification />;
    case "worker-skills":
      return <WorkerSkills />;
    case "worker-support":
      return <WorkerSupport />;
    case "worker-profile":
      return <WorkerProfile />;
    default:
      return <WorkerDashboard />;
  }
}
