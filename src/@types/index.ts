declare namespace NodeJS {
  interface Global {
    execFunc: (s: string) => Promise<string>;
  }
}

declare module '@shuyun-ep-team/specified-package-version-check';

declare module 'beauty-logger';
