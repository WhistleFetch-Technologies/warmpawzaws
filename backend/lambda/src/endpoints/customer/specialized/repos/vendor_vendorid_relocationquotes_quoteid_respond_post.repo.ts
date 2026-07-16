import { update, query } from '../../../../database/rds-connection';

async function ensureRelocationQuotesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS relocation_quotes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID,
      customer_phone VARCHAR(20),
      origin VARCHAR(255),
      destination VARCHAR(255),
      transport_type VARCHAR(50),
      pet_type VARCHAR(50),
      pet_size VARCHAR(50),
      pet_weight DECIMAL(10,2),
      number_of_pets INTEGER DEFAULT 1,
      preferred_date DATE,
      special_requirements TEXT,
      cage_required BOOLEAN DEFAULT false,
      insurance_required BOOLEAN DEFAULT false,
      base_price DECIMAL(10,2),
      cage_cost DECIMAL(10,2),
      insurance_cost DECIMAL(10,2),
      handling_fee DECIMAL(10,2),
      total_quote DECIMAL(10,2),
      status VARCHAR(50) DEFAULT 'pending',
      valid_until TIMESTAMP,
      vendor_id UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function dbVendorVendoridRelocationquotesQuoteidRespondPost0(
  quoteId: string,
  vendorId: string,
  finalPrice: unknown
) {
  await ensureRelocationQuotesTable();
  return await update(
    'relocation_quotes',
    { id: quoteId },
    {
      vendor_id: vendorId,
      total_quote: finalPrice,
      status: 'quoted',
      updated_at: new Date().toISOString(),
    }
  );
}
