/**
 * Insurance Policy PDF Generator
 * Generates downloadable PDF policies
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

/**
 * Generate policy PDF HTML
 */
function generatePolicyHTML(policy: any, plan: any, customer: any, pet: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      margin: 40px;
      color: #333;
    }
    .header {
      border-bottom: 3px solid #FF8C42;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #FF8C42;
    }
    .policy-number {
      text-align: right;
      margin-top: 10px;
      font-size: 14px;
    }
    .section {
      margin: 30px 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #FF8C42;
      margin-bottom: 15px;
      border-bottom: 2px solid #FF8C42;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      margin: 10px 0;
    }
    .info-label {
      width: 200px;
      font-weight: bold;
    }
    .info-value {
      flex: 1;
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .coverage-table th,
    .coverage-table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    .coverage-table th {
      background-color: #FF8C42;
      color: white;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      font-size: 12px;
      color: #666;
    }
    .signature {
      margin-top: 50px;
    }
    .signature-line {
      border-top: 1px solid #333;
      width: 300px;
      margin-top: 60px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Warmpawz Pet Insurance</div>
    <div class="policy-number">
      <strong>Policy Number:</strong> ${policy.policyNumber}<br>
      <strong>Policy ID:</strong> ${policy.policyId}
    </div>
  </div>

  <h1 style="text-align: center; color: #FF8C42;">PET INSURANCE POLICY</h1>

  <div class="section">
    <div class="section-title">Policyholder Information</div>
    <div class="info-row">
      <div class="info-label">Name:</div>
      <div class="info-value">${customer.name || customer.phone}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Phone:</div>
      <div class="info-value">${customer.phone}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Email:</div>
      <div class="info-value">${customer.email || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Address:</div>
      <div class="info-value">${customer.address || 'N/A'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Insured Pet Information</div>
    <div class="info-row">
      <div class="info-label">Pet Name:</div>
      <div class="info-value">${pet.name || petName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Breed:</div>
      <div class="info-value">${pet.breed || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Age:</div>
      <div class="info-value">${pet.age || 'N/A'} ${pet.ageUnit || 'years'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Species:</div>
      <div class="info-value">${pet.type || pet.species || 'N/A'}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Policy Details</div>
    <div class="info-row">
      <div class="info-label">Plan Name:</div>
      <div class="info-value">${plan.planName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Provider:</div>
      <div class="info-value">${plan.provider || 'Warmpawz Insurance'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Policy Start Date:</div>
      <div class="info-value">${new Date(policy.startDate).toLocaleDateString('en-IN')}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Policy End Date:</div>
      <div class="info-value">${new Date(policy.endDate).toLocaleDateString('en-IN')}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Premium Amount:</div>
      <div class="info-value">₹${policy.premiumAmount} (${policy.paymentFrequency})</div>
    </div>
    <div class="info-row">
      <div class="info-label">Next Payment Date:</div>
      <div class="info-value">${new Date(policy.nextPaymentDate).toLocaleDateString('en-IN')}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Coverage Details</div>
    <table class="coverage-table">
      <thead>
        <tr>
          <th>Coverage Type</th>
          <th>Coverage Amount</th>
          <th>Deductible</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Accident Coverage</td>
          <td>₹${plan.coverage.accidentCover.toLocaleString('en-IN')}</td>
          <td>₹${plan.deductible.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td>Illness Coverage</td>
          <td>₹${plan.coverage.illnessCover.toLocaleString('en-IN')}</td>
          <td>₹${plan.deductible.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td><strong>Total Coverage</strong></td>
          <td><strong>₹${policy.coverageAmount.toLocaleString('en-IN')}</strong></td>
          <td><strong>₹${plan.deductible.toLocaleString('en-IN')}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p style="line-height: 1.6;">
      This policy is subject to the terms and conditions as specified in the insurance plan.
      Coverage is valid for the policy period mentioned above. Claims must be filed within
      30 days of the incident. Pre-existing conditions may not be covered. Please refer to
      the full policy document for complete terms and conditions.
    </p>
  </div>

  <div class="footer">
    <p><strong>Warmpawz Pet Insurance</strong></p>
    <p>Generated on: ${new Date().toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
    <p>For queries, contact: support@warmpawz.com | +91-XXXXX-XXXXX</p>
  </div>

  <div class="signature">
    <p><strong>Authorized Signatory</strong></p>
    <div class="signature-line"></div>
    <p style="margin-top: 5px;">Warmpawz Insurance Services</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate policy PDF (returns HTML that can be converted to PDF)
 * In production, use a PDF library like pdfkit or puppeteer
 */
export async function generatePolicyPDF(policyId: string): Promise<string> {
  const policy = await kv.get(`insurance:policy:${policyId}`);
  if (!policy) {
    throw new Error('Policy not found');
  }

  const plan = await kv.get(`insurance:plan:${policy.planId}`);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const customer = await kv.get(`customer:${policy.customerId}`);
  const pet = await kv.get(`pet:${policy.petId}`);

  const html = generatePolicyHTML(policy, plan, customer || {}, pet || {});

  // Store PDF HTML
  const pdfKey = `insurance:policy:${policyId}:pdf`;
  await kv.set(pdfKey, {
    html,
    generatedAt: new Date().toISOString(),
    policyId,
  });

  return html;
}

/**
 * Register policy PDF endpoints
 */
export function registerPolicyPDFEndpoints(app: Hono) {
  /**
   * Generate and get policy PDF
   * GET /make-server-3dd53475/insurance/policy/:policyId/pdf
   */
  app.get('/make-server-3dd53475/insurance/policy/:policyId/pdf', async (c) => {
    try {
      const { policyId } = c.req.param();
      
      // Check if PDF already exists
      const pdfKey = `insurance:policy:${policyId}:pdf`;
      let pdfData = await kv.get(pdfKey);

      if (!pdfData) {
        // Generate new PDF
        const html = await generatePolicyPDF(policyId);
        pdfData = await kv.get(pdfKey);
      }

      // Return HTML (can be converted to PDF on client or server)
      c.header('Content-Type', 'text/html');
      return c.html(pdfData.html);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Download policy PDF
   * GET /make-server-3dd53475/insurance/policy/:policyId/download
   */
  app.get('/make-server-3dd53475/insurance/policy/:policyId/download', async (c) => {
    try {
      const { policyId } = c.req.param();
      
      const html = await generatePolicyPDF(policyId);
      
      // In production, convert HTML to PDF using puppeteer or similar
      // For now, return HTML with download headers
      c.header('Content-Type', 'text/html');
      c.header('Content-Disposition', `attachment; filename="policy-${policyId}.html"`);
      return c.html(html);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

