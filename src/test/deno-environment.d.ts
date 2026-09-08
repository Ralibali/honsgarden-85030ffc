// Only a type declaration for server modules imported by unit tests.
// The tests mock external effects and never provide production credentials.
declare const Deno: { env: { get(name: string): string | undefined } };
