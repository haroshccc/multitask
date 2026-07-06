/**
 * Finance module React Query hooks. Org-scoped; mirrors usePlans.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as svc from "@/lib/services/finance";
import type {
  FinanceBudget,
  FinanceBudgetGroup,
  FinanceBudgetVersion,
  FinanceAccount,
  FinanceAccountTransaction,
  FinanceExpense,
  FinanceOccurrence,
  FinanceExpenseTemplate,
  FinanceMonthlyClosing,
  FinanceCarryoverTransfer,
  FinanceCreditImport,
  FinanceEvent,
} from "@/lib/types/finance";

// ---- Queries -----------------------------------------------------------------

export function useBudgetGroups() {
  const scope = useOrgScope();
  return useQuery<FinanceBudgetGroup[]>({
    queryKey: queryKeys.financeBudgetGroups(scope.organizationId ?? ""),
    queryFn: () => svc.listBudgetGroups(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useBudgets() {
  const scope = useOrgScope();
  return useQuery<FinanceBudget[]>({
    queryKey: queryKeys.financeBudgets(scope.organizationId ?? ""),
    queryFn: () => svc.listBudgets(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useBudgetVersions() {
  const scope = useOrgScope();
  return useQuery<FinanceBudgetVersion[]>({
    queryKey: queryKeys.financeBudgetVersionsAll(scope.organizationId ?? ""),
    queryFn: () => svc.listAllBudgetVersions(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useAccounts() {
  const scope = useOrgScope();
  return useQuery<FinanceAccount[]>({
    queryKey: queryKeys.financeAccounts(scope.organizationId ?? ""),
    queryFn: () => svc.listAccounts(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useAccountTransactions() {
  const scope = useOrgScope();
  return useQuery<FinanceAccountTransaction[]>({
    queryKey: queryKeys.financeAccountTxAll(scope.organizationId ?? ""),
    queryFn: () => svc.listAllAccountTransactions(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useExpenses() {
  const scope = useOrgScope();
  return useQuery<FinanceExpense[]>({
    queryKey: queryKeys.financeExpenses(scope.organizationId ?? ""),
    queryFn: () => svc.listExpenses(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useOccurrences() {
  const scope = useOrgScope();
  return useQuery<FinanceOccurrence[]>({
    queryKey: queryKeys.financeOccurrences(scope.organizationId ?? ""),
    queryFn: () => svc.listOccurrences(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useTemplates() {
  const scope = useOrgScope();
  return useQuery<FinanceExpenseTemplate[]>({
    queryKey: queryKeys.financeTemplates(scope.organizationId ?? ""),
    queryFn: () => svc.listTemplates(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useClosings() {
  const scope = useOrgScope();
  return useQuery<FinanceMonthlyClosing[]>({
    queryKey: queryKeys.financeClosings(scope.organizationId ?? ""),
    queryFn: () => svc.listClosings(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCarryovers() {
  const scope = useOrgScope();
  return useQuery<FinanceCarryoverTransfer[]>({
    queryKey: queryKeys.financeCarryovers(scope.organizationId ?? ""),
    queryFn: () => svc.listCarryovers(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useFinanceEvents(entityType: string, entityId: string | null) {
  return useQuery<FinanceEvent[]>({
    queryKey: queryKeys.financeEventLog(entityType, entityId ?? ""),
    queryFn: () => svc.listEvents(entityType, entityId!),
    enabled: !!entityId,
  });
}

// ---- Mutation helpers --------------------------------------------------------

function useInvalidate() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return (families: ((orgId: string) => readonly unknown[])[]) => {
    if (!scope.organizationId) return;
    for (const fam of families) {
      qc.invalidateQueries({ queryKey: fam(scope.organizationId) });
    }
  };
}

// ---- Budget mutations --------------------------------------------------------

export function useCreateBudget() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<svc.CreateBudgetInput, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createBudget({ ...input, organization_id: organizationId, owner_id: userId });
    },
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceBudgets, queryFamilies.allFinanceBudgetVersions]),
  });
}

export function useCreateBudgetGroup() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      name: string;
      share_level?: FinanceBudgetGroup["share_level"];
      subs: svc.GroupSubBudgetInput[];
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createBudgetGroupWithBudgets({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceBudgetGroups,
        queryFamilies.allFinanceBudgets,
        queryFamilies.allFinanceBudgetVersions,
      ]),
  });
}

export function useUpdateBudgetGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ groupId, patch }: { groupId: string; patch: Parameters<typeof svc.updateBudgetGroup>[1] }) =>
      svc.updateBudgetGroup(groupId, patch),
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceBudgetGroups, queryFamilies.allFinanceBudgets]),
  });
}

export function useSetBudgetsArchived() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ budgetIds, archived }: { budgetIds: string[]; archived: boolean }) =>
      svc.setBudgetsArchived(budgetIds, archived),
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceBudgets, queryFamilies.allFinanceOccurrences]),
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ budgetId, patch }: { budgetId: string; patch: Parameters<typeof svc.updateBudgetPresentation>[1] }) =>
      svc.updateBudgetPresentation(budgetId, patch),
    onSuccess: () => invalidate([queryFamilies.allFinanceBudgets]),
  });
}

export function useAddBudgetVersion() {
  const scope = useOrgScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { budget_id: string; title: string; amount: number; period: "monthly" | "yearly" }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.addBudgetVersion({ ...input, organization_id: organizationId, created_by: userId });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allFinanceBudgets(scope.organizationId) });
        qc.invalidateQueries({
          queryKey: queryFamilies.allFinanceBudgetVersions(scope.organizationId),
        });
      }
    },
  });
}

// ---- Account mutations -------------------------------------------------------

export function useCreateAccount() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { name: string; kind: "bank" | "credit" | "cash"; color?: string; opening_balance?: number }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createAccount({ ...input, organization_id: organizationId, owner_id: userId });
    },
    onSuccess: () => invalidate([queryFamilies.allFinanceAccounts]),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ accountId, patch }: { accountId: string; patch: Partial<FinanceAccount> }) =>
      svc.updateAccount(accountId, patch),
    onSuccess: () => invalidate([queryFamilies.allFinanceAccounts]),
  });
}

export function useCreateTransfer() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { from_account_id: string; to_account_id: string; amount: number; tx_date: string; note?: string | null }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createTransfer({ ...input, organization_id: organizationId, created_by: userId });
    },
    onSuccess: () => invalidate([queryFamilies.allFinanceAccounts, queryFamilies.allFinanceAccountTx]),
  });
}

// ---- Expense / occurrence mutations ------------------------------------------

export function useCreateExpense() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<svc.CreateExpenseInput, "organization_id" | "created_by">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createExpense({ ...input, organization_id: organizationId, created_by: userId });
    },
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceExpenses, queryFamilies.allFinanceOccurrences]),
  });
}

export function useUpdateExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ expenseId, patch }: { expenseId: string; patch: Partial<FinanceExpense> }) =>
      svc.updateExpense(expenseId, patch),
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceExpenses, queryFamilies.allFinanceOccurrences]),
  });
}

export function useArchiveExpense() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (expenseId: string) => svc.archiveExpense(expenseId),
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceExpenses, queryFamilies.allFinanceOccurrences]),
  });
}

export function useSetOccurrenceCharged() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ occId, charged }: { occId: string; charged: boolean }) =>
      svc.setOccurrenceCharged(occId, charged),
    onSuccess: () => invalidate([queryFamilies.allFinanceOccurrences]),
  });
}

export function useUpdateOccurrence() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ occ, patch }: { occ: FinanceOccurrence; patch: Parameters<typeof svc.updateOccurrenceFields>[0]["patch"] }) => {
      const { userId } = assertOrgScope(scope);
      return svc.updateOccurrenceFields({ occ, patch, createdBy: userId });
    },
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceOccurrences,
        queryFamilies.allFinanceExpenses,
        queryFamilies.allFinanceAccounts,
        queryFamilies.allFinanceAccountTx,
      ]),
  });
}

export function useDeleteOccurrence() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (occ: FinanceOccurrence) => svc.deleteOccurrence(occ),
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceOccurrences,
        queryFamilies.allFinanceAccounts,
        queryFamilies.allFinanceAccountTx,
      ]),
  });
}

export function useRecreateOccurrence() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (occ: FinanceOccurrence) => {
      const { userId } = assertOrgScope(scope);
      return svc.recreateOccurrence(occ, userId);
    },
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceOccurrences,
        queryFamilies.allFinanceAccounts,
        queryFamilies.allFinanceAccountTx,
      ]),
  });
}

export function useSetOccurrenceWithdrawn() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ occ, withdrawn }: { occ: FinanceOccurrence; withdrawn: boolean }) => {
      const { userId } = assertOrgScope(scope);
      return svc.setOccurrenceWithdrawn(occ, withdrawn, userId);
    },
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceOccurrences,
        queryFamilies.allFinanceAccounts,
        queryFamilies.allFinanceAccountTx,
      ]),
  });
}

export function useCreditImports() {
  const scope = useOrgScope();
  return useQuery<FinanceCreditImport[]>({
    queryKey: queryKeys.financeCreditImports(scope.organizationId ?? ""),
    queryFn: () => svc.listCreditImports(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useImportCreditRows() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { account_id: string; imported_on?: string; rows: svc.CreditImportRow[] }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.importCreditRows({
        ...input,
        organization_id: organizationId,
        created_by: userId,
      });
    },
    onSuccess: () =>
      invalidate([
        queryFamilies.allFinanceExpenses,
        queryFamilies.allFinanceOccurrences,
        queryFamilies.allFinanceAccounts,
        queryFamilies.allFinanceAccountTx,
        queryFamilies.allFinanceCreditImports,
      ]),
  });
}

// ---- Template mutations ------------------------------------------------------

export function useCreateTemplate() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Partial<FinanceExpenseTemplate> & { name: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createTemplate({ ...input, organization_id: organizationId, owner_id: userId });
    },
    onSuccess: () => invalidate([queryFamilies.allFinanceTemplates]),
  });
}

export function useUpdateTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<FinanceExpenseTemplate> }) =>
      svc.updateTemplate(id, patch),
    onSuccess: () => invalidate([queryFamilies.allFinanceTemplates]),
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => svc.deleteTemplate(id),
    onSuccess: () => invalidate([queryFamilies.allFinanceTemplates]),
  });
}

// ---- Closing / carryover mutations -------------------------------------------

export function useUpsertClosing() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Partial<FinanceMonthlyClosing> & { budget_id: string; period_month: string }) => {
      const { organizationId } = assertOrgScope(scope);
      return svc.upsertClosing({ ...input, organization_id: organizationId });
    },
    onSuccess: () => invalidate([queryFamilies.allFinanceClosings]),
  });
}

export function useCreateCarryover() {
  const scope = useOrgScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { from_budget_id: string; to_budget_id: string; period_month: string; amount: number; note?: string | null }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return svc.createCarryover({ ...input, organization_id: organizationId, created_by: userId });
    },
    onSuccess: () =>
      invalidate([queryFamilies.allFinanceCarryovers, queryFamilies.allFinanceClosings]),
  });
}
