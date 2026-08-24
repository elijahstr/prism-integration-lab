type FocusDocument = {
  getElementById(id: string): { focus(): void } | null;
};

export function actionErrorMessage(
  error: string | null,
  _hasDashboardData: boolean,
): string | null {
  return error;
}

export function focusActionResult(documentLike: FocusDocument): void {
  documentLike.getElementById("main-content")?.focus();
}
