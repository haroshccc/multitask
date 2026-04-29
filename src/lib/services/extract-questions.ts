import { supabase } from "@/lib/supabase/client";
import type { Question } from "@/lib/types/domain";

interface ExtractResult {
  count: number;
  questions: Question[];
}

/**
 * Calls the `extract-questions` Edge Function with the user's JWT, asks Claude
 * to mine the recording's transcript for open questions, and persists them as
 * `questions` rows on the project. The recording must already be transcribed.
 */
export async function extractQuestionsFromRecording(args: {
  recordingId: string;
  projectId?: string | null;
  replace?: boolean;
}): Promise<ExtractResult> {
  const { data, error } = await supabase.functions.invoke<ExtractResult>(
    "extract-questions",
    {
      body: {
        recording_id: args.recordingId,
        project_id: args.projectId ?? null,
        replace: args.replace ?? false,
      },
    }
  );
  if (error) {
    throw new Error(error.message ?? "extract_questions_failed");
  }
  return data ?? { count: 0, questions: [] };
}
