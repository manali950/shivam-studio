import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { ID } from '@/types';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { errMsg } from '@/services/errors';
 
/** Query scoped to the current studio. Key = [name, tenantId, ...deps] so cache never leaks across tenants. */
export function useTenantQuery<T>(key: [string, ...unknown[]], fn: (tenantId: ID) => Promise<T>, opts?: Partial<UseQueryOptions<T>>) {
  const { tenant } = useTenant();
  return useQuery<T>({ queryKey: [key[0], tenant.id, ...key.slice(1)], queryFn: () => fn(tenant.id), staleTime: 15_000, ...opts });
}
 
/** Mutation that invalidates the named collections for the current studio and toasts failures. */
export function useTenantMutation<A, R>(fn: (tenantId: ID, arg: A) => Promise<R>, invalidate: string[] = [], o?: { success?: string; onSuccess?: (r: R, a: A) => void }) {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, Error, A>({
    mutationFn: (arg) => fn(tenant.id, arg),
    onSuccess: (r, a) => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k, tenant.id] }));
      if (o?.success) toast.success(o.success);
      o?.onSuccess?.(r, a);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}
 
export function usePlatformMutation<A, R>(fn: (arg: A) => Promise<R>, invalidate: string[] = [], o?: { success?: string; onSuccess?: (r: R) => void }) {
  const qc = useQueryClient(); const toast = useToast();
  return useMutation<R, Error, A>({
    mutationFn: fn,
    onSuccess: (r) => { invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); if (o?.success) toast.success(o.success); o?.onSuccess?.(r); },
    onError: (e) => toast.error(errMsg(e)),
  });
}