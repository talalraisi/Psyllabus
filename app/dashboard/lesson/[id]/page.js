"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/cache";
import { isSubjectLocked } from "@/lib/access";
import { getSlugForSubject } from "@/lib/subject-map";
import DashboardLayout from "@/components/DashboardLayout";
import { Page, PageLoading, EmptyState } from "@/components/PageShell";
import LessonPlayer from "@/components/lessons/LessonPlayer";
import FramePlayer from "@/components/lessons/FramePlayer";

/**
 * A lesson: loading it, checking the student may open it, and saving which
 * of its "what you should know now" statements they have shown. The lesson
 * itself is components/lessons/LessonPlayer.js.
 */
function LessonPage() {
  const { id } = useParams();
  const params = useSearchParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [met, setMet] = useState([]);
  const [userId, setUserId] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const user = await getCurrentUser(supabase);
      if (!user) return router.push("/login");
      const p = await getProfile(supabase, user.id, {
        onFresh: (fresh) => live && setProfile(fresh),
      });
      if (!p) return router.push("/onboarding");
      const [{ data: row }, { data: progress }] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("lesson_progress")
          .select("outcomes_met")
          .eq("lesson_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!live) return;
      if (!row) return setMissing(true);
      // A free account opens one subject; the lesson follows the same rule.
      if (isSubjectLocked(row.subject, p))
        return router.push("/dashboard/profile#unlock");
      setProfile(p);
      setUserId(user.id);
      setLesson(row);
      setMet(progress?.outcomes_met || []);
    })();
    return () => {
      live = false;
    };
  }, [id, router, supabase]);

  const saveProgress = useCallback(
    async (outcomesMet, finished) => {
      if (!userId || !lesson) return;
      await supabase.from("lesson_progress").upsert(
        {
          user_id: userId,
          lesson_id: lesson.id,
          outcomes_met: outcomesMet,
          completed_at: finished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );
    },
    [supabase, userId, lesson],
  );

  const addCards = useCallback(
    async (cards) => {
      if (!userId || !lesson || !cards.length) return false;
      const { error } = await supabase.from("flashcards").insert(
        cards.map((c) => ({
          user_id: userId,
          subject: lesson.subject,
          topic: lesson.topic,
          subtopic: lesson.subtopic,
          front: c.front.slice(0, 300),
          back: c.back.slice(0, 1000),
          source: "preset",
        })),
      );
      return !error;
    },
    [supabase, userId, lesson],
  );

  /** A report on one screen, into the same inbox as the feedback button. */
  const report = useCallback(
    async ({ screen, title, reason, note }) => {
      if (!userId || !lesson) return false;
      const { error } = await supabase.from("feedback").insert({
        user_id: userId,
        kind: "lesson",
        message:
          `${reason}${note ? `: ${note}` : ""}\n\nLesson ${lesson.id} (${lesson.subject} · ${lesson.subtopic}), screen ${screen}: ${title}`.slice(
            0,
            4000,
          ),
        path: `/dashboard/lesson/${lesson.id}`.slice(0, 200),
      });
      return !error;
    },
    [supabase, userId, lesson],
  );

  if (missing) {
    return (
      <DashboardLayout profile={profile}>
        <Page>
          <EmptyState
            title="This lesson is not available"
            description="It may still be being checked. Try the subject's other lessons for now."
          />
        </Page>
      </DashboardLayout>
    );
  }
  if (!lesson) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Lesson" variant="lesson" />
      </DashboardLayout>
    );
  }

  const back = params.get("back") || getSlugForSubject(lesson.subject) || "";
  const backHref = back ? `/dashboard/syllabus/${back}` : "/dashboard";
  const practiseHref = `/dashboard/quiz?subject=${encodeURIComponent(lesson.subject)}&topic=${encodeURIComponent(lesson.topic)}&subtopic=${encodeURIComponent(lesson.subtopic)}&count=5&review=practice${back ? `&back=${encodeURIComponent(back)}` : ""}`;

  return (
    <DashboardLayout profile={profile}>
      <Page>
        {lesson.body?.version === 2 ? (
          <FramePlayer
            lesson={lesson}
            met={met}
            onProgress={saveProgress}
            onAddCards={addCards}
            onReport={report}
            backHref={backHref}
            backLabel={lesson.subject}
            practiseHref={practiseHref}
          />
        ) : (
          <LessonPlayer
            lesson={lesson}
            met={met}
            onProgress={saveProgress}
            onAddCards={addCards}
            backHref={backHref}
            backLabel={lesson.subject}
            practiseHref={practiseHref}
          />
        )}
      </Page>
    </DashboardLayout>
  );
}

export default function LessonRoute() {
  return (
    <Suspense fallback={null}>
      <LessonPage />
    </Suspense>
  );
}
