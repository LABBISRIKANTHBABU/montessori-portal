export function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Password must be at least 12 characters");
  if (!/[A-Z]/.test(password)) errors.push("Must contain at least one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must contain at least one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Must contain at least one number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Must contain at least one special character");
  return { valid: errors.length === 0, errors };
}
