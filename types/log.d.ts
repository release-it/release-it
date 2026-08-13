export default interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  verbose(...args: any[]): void;
  exec(...args: any[]): void;
  obtrusive(...args: any[]): void;

  preview({ title, text }: { title: string; text: string }): void;
}
