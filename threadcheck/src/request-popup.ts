// Website code requests that already popped up in this app session.
// Backing out of one (or declining it) must not reopen it in a loop.
export const shownOnMain = new Set<string>(); // main screen already jumped to /browser for these
export const openedInBrowser = new Set<string>(); // browser screen already opened these
