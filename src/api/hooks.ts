import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, getStoredUsername } from './client';
import type {
  Dashboard, LoadPayload, MaintenanceNote, ManagedUser, Profile, Operation, OperationResult, Page, Pallet, Role, Shuttle, WarehouseLocation,
} from './types';

export const useLocations = () =>
  useQuery({
    queryKey: ['locations'],
    queryFn: () => api<WarehouseLocation[]>('/api/locations/'),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/api/dashboard/'), refetchInterval: 5000 });

export const useShuttle = () =>
  useQuery({ queryKey: ['shuttle'], queryFn: () => api<Shuttle>('/api/shuttle/'), refetchInterval: 10000 });

export type ListParams = Record<string, string | number | boolean | undefined>;

export const usePallets = (params: ListParams) =>
  useQuery({
    queryKey: ['pallets', params],
    queryFn: () => api<Page<Pallet>>('/api/pallets/', { params }),
    placeholderData: keepPreviousData,
  });

export const useOperations = (params: ListParams) =>
  useQuery({
    queryKey: ['operations', params],
    queryFn: () => api<Page<Operation>>('/api/operations/', { params }),
    placeholderData: keepPreviousData,
  });

export const useUsers = (params: ListParams) =>
  useQuery({
    queryKey: ['users', params],
    queryFn: () => api<Page<ManagedUser>>('/api/users/', { params }),
    placeholderData: keepPreviousData,
  });

function useInvalidateStock() {
  const qc = useQueryClient();
  return () =>
    Promise.all(['locations', 'pallets', 'operations', 'dashboard'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** A fresh Idempotency-Key. One key per user intent (one dialog submission), reused on retries. */
export function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Retry only when the request may not have reached the server. Safe because of the Idempotency-Key. */
const retryNetworkOnly = (count: number, err: unknown) => err instanceof ApiError && err.status === 0 && count < 2;

type LocationsSnapshot = { previous: WarehouseLocation[] | undefined };

/**
 * Optimistic stock mutation: patch the cached map immediately, roll back on error,
 * then always reconcile with the server (the polled map is the source of truth).
 */
function useOptimisticStock<V>(
  request: (vars: V) => Promise<OperationResult>,
  patch: (locs: WarehouseLocation[], vars: V, by: string | null) => WarehouseLocation[],
) {
  const qc = useQueryClient();
  const invalidate = useInvalidateStock();
  return useMutation<OperationResult, unknown, V, LocationsSnapshot>({
    mutationFn: request,
    retry: retryNetworkOnly,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['locations'] }); // a poll landing now must not overwrite the patch
      const previous = qc.getQueryData<WarehouseLocation[]>(['locations']);
      if (previous) qc.setQueryData(['locations'], patch(previous, vars, getStoredUsername()));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['locations'], ctx.previous);
    },
    onSuccess: (res) => {
      // Replace the guessed cell with the server's version straight away.
      qc.setQueryData<WarehouseLocation[]>(['locations'], (locs) =>
        locs?.map((l) => (l.code === res.location.code ? res.location : l)),
      );
    },
    onSettled: invalidate,
  });
}

export function useLoadPallet() {
  return useOptimisticStock<{ body: LoadPayload; idempotencyKey: string }>(
    ({ body, idempotencyKey }) =>
      api<OperationResult>('/api/operations/load/', {
        method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey },
      }),
    (locs, { body }, by) =>
      locs.map((l) =>
        l.code === body.location && l.state === 'free'
          ? {
              ...l,
              state: 'occupied',
              pallet: {
                id: -1, // placeholder until the server responds
                pallet_number: body.pallet_number, barcode: body.barcode, item_name: body.item_name,
                quantity: body.quantity, status: 'active', location: l.code, storage_location: l.code,
                loaded_at: new Date().toISOString(), loaded_by: by, unloaded_at: null, unloaded_by: null,
              },
            }
          : l,
      ),
  );
}

export function useUnloadPallet() {
  return useOptimisticStock<{ location: string; idempotencyKey: string }>(
    ({ location, idempotencyKey }) =>
      api<OperationResult>('/api/operations/unload/', {
        method: 'POST', body: { location }, headers: { 'Idempotency-Key': idempotencyKey },
      }),
    (locs, { location }) =>
      locs.map((l) => (l.code === location && l.state === 'occupied' ? { ...l, state: 'free', pallet: null } : l)),
  );
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; password: string; role: Role }) =>
      api<ManagedUser>('/api/users/', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; role?: Role; is_active?: boolean }) =>
      api<ManagedUser>(`/api/users/${id}/`, { method: 'PATCH', body }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api<void>(`/api/users/${id}/set-password/`, { method: 'POST', body: { password } }),
  });
}

export function useUpdateShuttle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { battery_percent?: number; status?: Shuttle['status']; test_alert_email?: string }) =>
      api<Shuttle>('/api/shuttle/', { method: 'PATCH', body }),
    onSuccess: (s) => qc.setQueryData(['shuttle'], s),
  });
}

export const useMaintenanceNotes = () =>
  useQuery({ queryKey: ['shuttle-maintenance'], queryFn: () => api<MaintenanceNote[]>('/api/shuttle/maintenance/') });

export function useAddMaintenanceNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => api<MaintenanceNote>('/api/shuttle/maintenance/', { method: 'POST', body: { note } }),
    onSuccess: (n) => qc.setQueryData<MaintenanceNote[]>(['shuttle-maintenance'], (old) => [n, ...(old ?? [])].slice(0, 50)),
  });
}

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/auth/profile/') });

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api<{ token: string }>('/api/auth/change-password/', { method: 'POST', body }),
  });
}
