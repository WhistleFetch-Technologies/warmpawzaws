/** @jest-environment jsdom */

import {
  VENDOR_FEEDBACK_PROMPT_SESSION_KEY,
  hasSeenSessionPrompt,
  markSessionPromptSeen,
} from '../app-session-prompt';

describe('app-session-prompt', () => {
  beforeEach(() => sessionStorage.clear());

  it('is unseen until marked, then seen for the rest of the session', () => {
    expect(hasSeenSessionPrompt(VENDOR_FEEDBACK_PROMPT_SESSION_KEY)).toBe(false);
    markSessionPromptSeen(VENDOR_FEEDBACK_PROMPT_SESSION_KEY);
    expect(hasSeenSessionPrompt(VENDOR_FEEDBACK_PROMPT_SESSION_KEY)).toBe(true);
  });

  it('keys are independent', () => {
    markSessionPromptSeen('other_prompt');
    expect(hasSeenSessionPrompt(VENDOR_FEEDBACK_PROMPT_SESSION_KEY)).toBe(false);
  });
});
