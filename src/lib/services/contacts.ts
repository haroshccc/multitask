import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export type ContactType = "customer" | "supplier";

export interface Contact {
  id: string;
  organization_id: string;
  owner_id: string;
  type: ContactType;
  name: string;
  company: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  shared_with_org: boolean;
  custom_fields: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A contact as returned for a project — carries the join-row id so the link
 *  can be removed without re-querying `project_contacts`. */
export interface ProjectContact extends Contact {
  link_id: string;
}

export type ContactInsert = {
  organization_id: string;
  owner_id: string;
  type?: ContactType;
  name?: string;
  company?: string | null;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  shared_with_org?: boolean;
  sort_order?: number;
};

export type ContactUpdate = Partial<
  Omit<Contact, "id" | "organization_id" | "owner_id" | "created_at">
>;

export async function listOrgContacts(orgId: string): Promise<Contact[]> {
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function listProjectContacts(
  projectId: string
): Promise<ProjectContact[]> {
  // Join project_contacts → contacts in one round-trip.
  const { data, error } = await db
    .from("project_contacts")
    .select("id, contact:contacts!inner(*)")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => r.contact)
    .map((r: any) => ({ ...(r.contact as Contact), link_id: r.id }))
    .sort(
      (a: ProjectContact, b: ProjectContact) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    ) as ProjectContact[];
}

/** Project names a contact is linked to (via `project_contacts`). */
export async function listContactProjects(
  contactId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from("project_contacts")
    .select("project:projects!inner(id, name)")
    .eq("contact_id", contactId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.project)
    .filter(Boolean) as { id: string; name: string }[];
}

export async function createContact(payload: ContactInsert): Promise<Contact> {
  const { data, error } = await db
    .from("contacts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  id: string,
  patch: ContactUpdate
): Promise<Contact> {
  const { data, error } = await db
    .from("contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await db.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// ── Contact ⇄ project links ──────────────────────────────────────────────────

export async function linkContactToProject(
  projectId: string,
  contactId: string
): Promise<void> {
  const { error } = await db
    .from("project_contacts")
    .insert({ project_id: projectId, contact_id: contactId });
  if (error && error.code !== "23505") throw error; // ignore duplicate link
}

export async function unlinkContactFromProject(
  projectId: string,
  contactId: string
): Promise<void> {
  const { error } = await db
    .from("project_contacts")
    .delete()
    .eq("project_id", projectId)
    .eq("contact_id", contactId);
  if (error) throw error;
}
