export const workspaceNameMaxLength = 100;

export type WorkspaceNameValidation = 'required' | 'maxLength' | null;

export const validateWorkspaceName = (name: string): WorkspaceNameValidation => {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return 'required';
  }

  if (trimmedName.length > workspaceNameMaxLength) {
    return 'maxLength';
  }

  return null;
};
