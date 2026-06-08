import { wizardBackOrShell } from '../wizard-back';

describe('wizardBackOrShell', () => {
  it('calls internal back when ref is set', () => {
    const internal = jest.fn();
    const shell = jest.fn();
    const ref = { current: internal };
    wizardBackOrShell(ref, shell);
    expect(internal).toHaveBeenCalledTimes(1);
    expect(shell).not.toHaveBeenCalled();
  });

  it('falls back to shell when ref is null', () => {
    const shell = jest.fn();
    const ref = { current: null as (() => void) | null };
    wizardBackOrShell(ref, shell);
    expect(shell).toHaveBeenCalledTimes(1);
  });

  it('must not wire shell fallback to the same ref (root-step recursion)', () => {
    const shell = jest.fn();
    const ref = { current: null as (() => void) | null };
    ref.current = () => {
      wizardBackOrShell(ref, shell);
    };
    expect(() => wizardBackOrShell(ref, shell)).toThrow(RangeError);
    expect(shell).not.toHaveBeenCalled();
  });
});
