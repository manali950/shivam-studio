import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { errMsg } from '@/services/errors';
import type { DeepPartial } from '@/services/data-provider/types';
import type { TenantConfig } from '@/types';
import { useTenantQuery } from './data';
import { services } from '@/services/data-provider';
 
/** Studio dashboard aggregate — shared by the shell badges, dashboard and analytics (one cached request). */
export const useStudioStats = () => useTenantQuery(['analytics', 'dashboard'], (t) => services.analytics.studioDashboard(t), { refetchInterval: 60_000 });
export const usePhotographerList = () => useTenantQuery(['photographers', 'all'], (t) => services.photographers.list(t, { pageSize: 100, sort: 'name' }));
export const useServiceList = () => useTenantQuery(['services', 'all'], (t) => services.services.list(t, { pageSize: 100, sort: 'sortOrder' } as any));
export const usePackageList = () => useTenantQuery(['packages', 'all'], (t) => services.packages.list(t, { pageSize: 100, sort: 'sortOrder' } as any));
export const useClientList = () => useTenantQuery(['clients', 'all'], (t) => services.clients.list(t, { pageSize: 200, sort: 'name', order: 'asc' } as any));
export const useEventList = () => useTenantQuery(['events', 'all'], (t) => services.events.list(t, { pageSize: 200, sort: 'date', order: 'desc' }));
 
 
/** Save a partial tenant config (website content / branding / settings) and refresh the live theme + public site. */
export function useSaveConfig() {
  const { tenant } = useTenant(); const qc = useQueryClient(); const toast = useToast();
  return useMutation({
    mutationFn: (patch: DeepPartial<TenantConfig>) => services.tenants.updateConfig(tenant.id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-config', tenant.id] }); toast.success('Changes saved'); },
    onError: (e) => toast.error(errMsg(e)),
  });
}