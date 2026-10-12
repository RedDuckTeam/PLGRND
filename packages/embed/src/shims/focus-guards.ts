// M14: Radix focus guards add two <span data-radix-focus-guard> to the host <body>. The self-hosted
// dialogs are non-modal (no focus trap to guard), so the guards are no-ops here.
export function useFocusGuards(): void {}
