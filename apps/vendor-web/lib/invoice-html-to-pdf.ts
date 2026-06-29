'use client';

/** Extract invoice number from API-generated tax invoice HTML. */
export function extractInvoiceNumberFromHtml(html: string): string | null {
  const fromBody = html.match(/class="invoice-number"[^>]*>([^<]+)/i)?.[1]?.trim();
  if (fromBody) return fromBody;

  const fromTitle = html.match(/<title>\s*Tax Invoice\s*-\s*([^<]+)\s*<\/title>/i)?.[1]?.trim();
  return fromTitle ?? null;
}

export function safeInvoiceFileBaseName(invoiceNumber: string, fallbackId: string): string {
  const raw = invoiceNumber || fallbackId.slice(0, 8);
  return `invoice-${raw}`.replace(/[^\w.-]+/g, '_');
}

/** Render self-contained invoice HTML off-screen and export as PDF (mobile-friendly). */
export async function convertInvoiceHtmlToPdfBlob(html: string): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:800px;background:#fff;pointer-events:none;opacity:1;';

  const iframe = document.createElement('iframe');
  iframe.style.width = '800px';
  iframe.style.height = '1400px';
  iframe.style.border = 'none';
  host.appendChild(iframe);
  document.body.appendChild(host);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Could not render invoice'));
      iframe.srcdoc = html;
    });

    const body = iframe.contentDocument?.body;
    if (!body) {
      throw new Error('Could not render invoice');
    }

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    host.remove();
  }
}
