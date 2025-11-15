/**
 * Load fixture data from files
 */
export function loadFixture<T>(fixtureName: string): T {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fixture = require(`../fixtures/${fixtureName}.fixture`);
  return fixture.default || fixture;
}

/**
 * Create a deep copy of fixture data to avoid mutations
 */
export function cloneFixture<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
