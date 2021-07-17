declare namespace NodeJS {
  interface Global {
    execFunc: (s: string) => Promise<string>;
  }
}

// declare module 'emailjs';
