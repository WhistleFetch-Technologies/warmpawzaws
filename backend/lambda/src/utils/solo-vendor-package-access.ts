/**
 * Solo vendors may create packages for every role, including vet and nutritionist.
 * Returns an error message when creation must be rejected.
 */
export function soloPackageCreateBlockReason(
  _roleName: string,
  _packageType?: string
): string | null {
  return null;
}
