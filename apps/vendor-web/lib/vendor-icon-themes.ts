export function getVendorIconTheme(roleId?: string): string {
  // Placeholder implementation
  return 'default';
}

export function getRoleIcon(roleId?: string): string {
  // Placeholder implementation - returns emoji icons
  const iconMap: Record<string, string> = {
    'walker': '🚶',
    'groomer': '✂️',
    'trainer': '🎓',
    'boarder': '🏠',
    'vet': '🩺',
    'sitter': '👶',
  };
  return iconMap[roleId || ''] || '🐾';
}

export function getRoleColorScheme(roleId?: string): { primary: string; secondary: string } {
  // Placeholder implementation
  const colorMap: Record<string, { primary: string; secondary: string }> = {
    'walker': { primary: '#3B82F6', secondary: '#DBEAFE' },
    'groomer': { primary: '#8B5CF6', secondary: '#EDE9FE' },
    'trainer': { primary: '#10B981', secondary: '#D1FAE5' },
    'boarder': { primary: '#F59E0B', secondary: '#FEF3C7' },
    'vet': { primary: '#EF4444', secondary: '#FEE2E2' },
    'sitter': { primary: '#EC4899', secondary: '#FCE7F3' },
  };
  return colorMap[roleId || ''] || { primary: '#6B7280', secondary: '#F3F4F6' };
}

