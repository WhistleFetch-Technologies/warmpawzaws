export type VetDoctorServiceRow = {
  id: string;
  serviceId?: string;
  service_id?: string;
  vendorServiceId?: string;
  name: string;
  price: number;
  duration: number;
  service_style: string;
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
};

export function mapVetDoctorServiceRows(rows: unknown[]): VetDoctorServiceRow[] {
  return (rows || []).map((raw) => {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const meta =
      s.metadata && typeof s.metadata === 'object'
        ? (s.metadata as Record<string, unknown>)
        : undefined;
    return {
      id: String(s.id ?? ''),
      serviceId: s.serviceId != null ? String(s.serviceId) : s.service_id != null ? String(s.service_id) : undefined,
      service_id: s.service_id != null ? String(s.service_id) : undefined,
      vendorServiceId: s.id != null ? String(s.id) : undefined,
      name: String(s.serviceName ?? s.name ?? s.service_name ?? 'Service'),
      price: parseFloat(String(s.price ?? '0')) || 0,
      duration: Number(s.duration ?? s.duration_minutes ?? 30) || 30,
      service_style: String(s.serviceStyle ?? s.service_style ?? 'at_center'),
      isPackage: Boolean(s.isPackage ?? meta?.isPackage),
      packageDetails: s.packageDetails,
      metadata: s.metadata,
    };
  });
}
