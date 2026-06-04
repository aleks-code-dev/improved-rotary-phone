let _quitApproved = false;

export function isQuitApproved(): boolean {
  return _quitApproved;
}

export function approveQuit(): void {
  _quitApproved = true;
}
