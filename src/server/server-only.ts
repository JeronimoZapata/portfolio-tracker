// Local server-only boundary. It keeps this project self-contained while
// preventing accidental use of the database composition from browser code.
if (typeof window !== "undefined") {
  throw new Error("Server-only module imported in a browser context.");
}

export {};
