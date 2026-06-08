export type ShellEntry<T extends string = string> = {
  screen: T;
  key?: string;
};

export type ShellNavigateMode = 'push' | 'popToIfExists' | 'reset';

export type ShellNavigateOptions = {
  key?: string;
  mode?: ShellNavigateMode;
};
