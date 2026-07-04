export function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 4) errors.push("Password must be at least 4 characters");
  return { valid: errors.length === 0, errors };
}
