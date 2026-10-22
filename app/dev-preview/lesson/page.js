"use client";

/**
 * A lesson without signing in. Development only: a real lesson written and
 * checked by the pipeline (scripts/build-content.mjs), nothing saved.
 */

import { notFound } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/PageShell";
import LessonPlayer from "@/components/lessons/LessonPlayer";
import FramePlayer from "@/components/lessons/FramePlayer";
import sample from "./sample.json";

const ENABLED = process.env.NODE_ENV !== "production";

export default function LessonPreview() {
  if (!ENABLED) notFound();
  const profile = {
    is_admin: true,
    id: "preview",
    full_name: "Sample Student",
    curriculum: "IB",
    subjects: ["Physics SL"],
  };
  return (
    <DashboardLayout profile={profile}>
      <Page>
        {sample.body?.version >= 2 ? (
          <FramePlayer
            lesson={sample}
            onAddCards={async () => true}
            onReport={async () => true}
            backHref="/dev-preview/lesson"
            backLabel="Physics SL"
            practiseHref="/dev-preview/lesson"
          />
        ) : (
          <LessonPlayer
            lesson={sample}
            onAddCards={async () => true}
            backHref="/dev-preview/lesson"
            backLabel="Physics SL"
            practiseHref="/dev-preview/lesson"
          />
        )}
      </Page>
    </DashboardLayout>
  );
}
