import type { CompanyInput } from '../dto/insurance-admin.requests';
import type { InsuranceCompanyDTO } from '../dto/insurance-admin.responses';
import {
  dbGetInsuranceCompany,
  dbInsertInsuranceCompany,
  dbListInsuranceCompanies,
  dbUpdateInsuranceCompany,
} from '../repos/companies.repo';
import { insuranceNotFound } from '../shared/insurance-admin-response';

export function listInsuranceCompanies(): Promise<InsuranceCompanyDTO[]> {
  return dbListInsuranceCompanies();
}

export async function createInsuranceCompany(
  input: CompanyInput,
  actorId: string | null,
): Promise<InsuranceCompanyDTO> {
  const id = await dbInsertInsuranceCompany(input, actorId);
  const company = await dbGetInsuranceCompany(id);
  if (!company) throw insuranceNotFound('Insurance company');
  return company;
}

export async function updateInsuranceCompany(
  id: string,
  input: CompanyInput,
  actorId: string | null,
): Promise<InsuranceCompanyDTO> {
  if (!(await dbUpdateInsuranceCompany(id, input, actorId))) throw insuranceNotFound('Insurance company');
  const company = await dbGetInsuranceCompany(id);
  if (!company) throw insuranceNotFound('Insurance company');
  return company;
}
