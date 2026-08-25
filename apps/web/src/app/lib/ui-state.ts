type FocusDocument = {
  getElementById(id: string): { focus(): void } | null;
};

export function actionErrorMessage(error: string | null): string | null {
  return error;
}

export function unavailableSessionMessage(token: string | null): string | null {
  return token ? null : "The lab session is unavailable. Reload this page.";
}

export function focusActionResult(documentLike: FocusDocument): void {
  documentLike.getElementById("main-content")?.focus();
}
