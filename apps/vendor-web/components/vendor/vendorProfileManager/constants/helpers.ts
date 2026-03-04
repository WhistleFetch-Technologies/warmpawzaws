export function parseSpecializations(specs: any): string[] {
    if (!specs) return [];
    if (Array.isArray(specs)) return specs;
    if (typeof specs === 'string') {
        // Try to parse as JSON array first
        try {
            const parsed = JSON.parse(specs);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            // Split by comma if not JSON
            return specs.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }
    return [];
}