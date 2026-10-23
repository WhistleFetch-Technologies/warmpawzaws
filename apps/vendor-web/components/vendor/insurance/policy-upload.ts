export function policyUploadBody(input: {
  policyNumber: string;
  amount: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const start = new Date(now.getTime());
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() + 365);
  return {
    policyNumber: input.policyNumber.trim(),
    issuedPremium: Number(input.amount) || 0,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    documents: [{
      s3Key: input.s3Key,
      name: input.fileName || 'policy.pdf',
      mime: input.fileType || 'application/pdf',
      size: input.fileSize,
    }],
  };
}

export function isPdfPolicy(file: { type?: string; name?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}
