import { useQuery } from '@tanstack/react-query';
import { services } from '@/services/data-provider';
 
export const usePlatformStats = () => useQuery({ queryKey: ['platform-stats'], queryFn: () => services.platform.stats(), refetchInterval: 60_000 });
export const usePlans = () => useQuery({ queryKey: ['platform-plans'], queryFn: () => services.platform.plans.list() });
export const PLATFORM_KEYS = ['platform-stats', 'platform-tenants', 'platform-plans', 'platform-settings', 'tenants-public'];