import { supabase } from "@/lib/supabase/client";
import type { Question, QuestionInsert } from "@/lib/types/domain";

export async function listProjectQuestions(
  projectId: string
): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("project_id", projectId)
    .order("answered_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createQuestion(payload: QuestionInsert): Promise<Question> {
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await supabase
      .from("questions")
      .select("sort_order")
      .eq("project_id", payload.project_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }
  const { data, error } = await supabase
    .from("questions")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(
  questionId: string,
  patch: Partial<
    Pick<Question, "text" | "answer" | "tags" | "task_id" | "sort_order">
  >
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update(patch)
    .eq("id", questionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function answerQuestion(
  questionId: string,
  answer: string,
  answeredByUserId: string
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update({
      answer,
      answered_at: new Date().toISOString(),
      answered_by_user_id: answeredByUserId,
    })
    .eq("id", questionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reopenQuestion(questionId: string): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update({ answered_at: null, answered_by_user_id: null })
    .eq("id", questionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) throw error;
}
