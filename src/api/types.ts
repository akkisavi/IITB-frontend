export type Role = 'admin' | 'auditor' | 'technician';
export type LocationState = 'transfer' | 'free' | 'occupied';

export interface AuthUser { id: number; username: string; role: Role }

export interface Pallet {
  id: number;
  pallet_number: string;
  barcode: string;
  item_name: string;
  quantity: number;
  status: 'active' | 'unloaded';
  location: string | null;
  /** Where it was stored; kept after unload. */
  storage_location: string | null;
  loaded_at: string;
  loaded_by: string | null;
  unloaded_at: string | null;
  unloaded_by: string | null;
}

export interface WarehouseLocation {
  code: string;
  column: string;
  row: number;
  kind: 'transfer' | 'storage';
  state: LocationState;
  pallet: Pallet | null;
}

export interface Operation {
  id: number;
  op_type: 'LOAD' | 'UNLOAD';
  location_code: string;
  pallet_id?: number;
  pallet_number: string;
  item_name: string;
  quantity: number;
  username: string;
  created_at: string;
}

export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }

export interface Shuttle { identifier: string; status: 'idle' | 'busy' | 'charging' | 'offline'; battery_percent: number; updated_at: string }

export interface HistoryPoint { date: string; occupied: number | null; free: number | null; source: 'sample' | 'live' | 'live_now' | 'missing' }

export interface Dashboard {
  capacity: number;
  occupied: number;
  free: number;
  occupancy_pct: number;
  history: HistoryPoint[];
  recent_operations: Operation[];
  top_items: { item_name: string; pallets: number; quantity: number }[];
  oldest_pallets: Pallet[];
  loads_today: number;
  unloads_today: number;
  generated_at: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  role: Role;
  is_active: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface LoadPayload { pallet_number: string; barcode: string; item_name: string; quantity: number; location: string }
export interface OperationResult { operation: Operation; pallet: Pallet; location: WarehouseLocation }

export interface MaintenanceNote { id: number; note: string; username: string; created_at: string }

export interface Profile extends ManagedUser {
  activity: { loads: number; unloads: number; recent: Operation[] };
}
