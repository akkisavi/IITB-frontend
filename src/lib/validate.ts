export type LoadField = 'pallet_number' | 'barcode' | 'item_name' | 'quantity' | 'location';
export interface LoadForm { pallet_number: string; barcode: string; item_name: string; quantity: string; location: string }

/** Messages mirror SPEC section 4.3 / 4.7 exactly. Server remains authoritative. */
export const MSG = {
  pallet_number: 'Pallet number must be 3-32 characters: letters, digits or hyphen.',
  barcode: 'Barcode must be 8-14 digits.',
  item_required: 'Item name is required.',
  item_long: 'Item name must be at most 100 characters.',
  quantity: 'Quantity must be a whole number between 1 and 100000.',
  location: 'Unknown location.',
  transfer: 'A1 is the transfer point and cannot store pallets.',
  password: 'Password must be 12-128 characters with no spaces.',
  username: 'Username must be 3-150 characters: letters, digits, _ . -',
};

export function validateLoad(f: LoadForm, validCodes: string[]): Partial<Record<LoadField, string>> {
  const e: Partial<Record<LoadField, string>> = {};
  if (!/^[A-Z0-9-]{3,32}$/.test(f.pallet_number.trim().toUpperCase())) e.pallet_number = MSG.pallet_number;
  if (!/^[0-9]{8,14}$/.test(f.barcode.trim())) e.barcode = MSG.barcode;
  const item = f.item_name.trim().replace(/\s+/g, ' ');
  if (!item) e.item_name = MSG.item_required;
  else if (item.length > 100) e.item_name = MSG.item_long;
  const q = f.quantity.trim();
  if (!/^\d+$/.test(q) || Number(q) < 1 || Number(q) > 100000) e.quantity = MSG.quantity;
  const loc = f.location.trim().toUpperCase();
  if (loc === 'A1') e.location = MSG.transfer;
  else if (!validCodes.includes(loc)) e.location = MSG.location;
  return e;
}

export const validPassword = (p: string) => p.length >= 12 && p.length <= 128 && !/\s/.test(p);
export const validUsername = (u: string) => /^[A-Za-z0-9_.-]{3,150}$/.test(u.trim());
