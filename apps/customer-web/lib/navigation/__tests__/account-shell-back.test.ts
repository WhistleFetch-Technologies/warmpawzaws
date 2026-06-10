import {
  resolveAccountHubRootBack,
  resolveWalletHubChildBack,
} from '../account-shell-back';

describe('resolveWalletHubChildBack', () => {
  it('pops to wallet when rewards opened from wallet hub', () => {
    const pop = jest.fn();
    const backToAccountMenu = jest.fn();
    resolveWalletHubChildBack({
      navigationHistory: ['home', 'wallet', 'rewards-loyalty'],
      pushedFromWallet: false,
      accountHubFromMenu: true,
      pop,
      backToAccountMenu,
    });
    expect(pop).toHaveBeenCalledTimes(1);
    expect(backToAccountMenu).not.toHaveBeenCalled();
  });

  it('returns to profile menu from rewards when opened directly from menu', () => {
    const pop = jest.fn();
    const backToAccountMenu = jest.fn();
    resolveWalletHubChildBack({
      navigationHistory: ['home', 'rewards-loyalty'],
      pushedFromWallet: false,
      accountHubFromMenu: true,
      pop,
      backToAccountMenu,
    });
    expect(backToAccountMenu).toHaveBeenCalledTimes(1);
    expect(pop).not.toHaveBeenCalled();
  });

  it('pops when pushedFromWallet even if stack parent is not wallet', () => {
    const pop = jest.fn();
    const backToAccountMenu = jest.fn();
    resolveWalletHubChildBack({
      navigationHistory: ['home', 'rewards-loyalty'],
      pushedFromWallet: true,
      accountHubFromMenu: true,
      pop,
      backToAccountMenu,
    });
    expect(pop).toHaveBeenCalledTimes(1);
    expect(backToAccountMenu).not.toHaveBeenCalled();
  });
});

describe('resolveAccountHubRootBack', () => {
  it('returns to profile menu from wallet when opened from menu', () => {
    const pop = jest.fn();
    const backToAccountMenu = jest.fn();
    const clearMenuRef = jest.fn();
    resolveAccountHubRootBack({
      accountHubFromMenu: true,
      pop,
      backToAccountMenu,
      clearMenuRef,
    });
    expect(clearMenuRef).toHaveBeenCalledTimes(1);
    expect(backToAccountMenu).toHaveBeenCalledTimes(1);
    expect(pop).not.toHaveBeenCalled();
  });

  it('pops generically when not opened from menu', () => {
    const pop = jest.fn();
    const backToAccountMenu = jest.fn();
    const clearMenuRef = jest.fn();
    resolveAccountHubRootBack({
      accountHubFromMenu: false,
      pop,
      backToAccountMenu,
      clearMenuRef,
    });
    expect(pop).toHaveBeenCalledTimes(1);
    expect(backToAccountMenu).not.toHaveBeenCalled();
    expect(clearMenuRef).not.toHaveBeenCalled();
  });
});
