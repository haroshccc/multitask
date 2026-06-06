import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/contacts";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
export type { Contact, ProjectContact, ContactType } from "@/lib/services/contacts";

const orgKey = (orgId: string) => ["org-contacts", orgId];
const projectKey = (projectId: string) => ["project-contacts", projectId];

export function useOrgContacts() {
  const scope = useOrgScope();
  return useQuery({
    queryKey: orgKey(scope.organizationId ?? ""),
    queryFn: () => service.listOrgContacts(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useProjectContacts(projectId: string | null | undefined) {
  return useQuery({
    queryKey: projectKey(projectId ?? ""),
    queryFn: () => service.listProjectContacts(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      type?: service.ContactType;
      name?: string;
      company?: string | null;
      tax_id?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      notes?: string | null;
      shared_with_org?: boolean;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createContact({
        organization_id: organizationId,
        owner_id: userId,
        type: input.type ?? "customer",
        name: input.name ?? "",
        company: input.company ?? null,
        tax_id: input.tax_id ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        shared_with_org: input.shared_with_org ?? false,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: orgKey(scope.organizationId) });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      projectId?: string;
      patch: service.ContactUpdate;
    }) => service.updateContact(id, patch),
    onSuccess: (_d, vars) => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: orgKey(scope.organizationId) });
      if (vars.projectId)
        qc.invalidateQueries({ queryKey: projectKey(vars.projectId) });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) =>
      service.deleteContact(id),
    onSuccess: (_d, vars) => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: orgKey(scope.organizationId) });
      if (vars.projectId)
        qc.invalidateQueries({ queryKey: projectKey(vars.projectId) });
    },
  });
}

export function useLinkContact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { projectId: string; contactId: string }) =>
      service.linkContactToProject(input.projectId, input.contactId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: projectKey(vars.projectId) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: orgKey(scope.organizationId) });
    },
  });
}

export function useUnlinkContact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { projectId: string; contactId: string }) =>
      service.unlinkContactFromProject(input.projectId, input.contactId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: projectKey(vars.projectId) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: orgKey(scope.organizationId) });
    },
  });
}
