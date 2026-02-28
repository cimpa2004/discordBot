/**
 * Abstract base class for all audio providers.
 * Every provider must extend this class and implement all methods.
 *
 * A resolved track object must have this shape:
 * {
 *   provider: string,      // provider name, e.g. "spotify"
 *   id:       string,      // provider-specific track ID
 *   title:    string,      // track title
 *   artist:   string,      // comma-separated artist names
 *   album:    string,      // album name
 *   durationMs: number,    // duration in milliseconds
 *   searchQuery: string,   // human-readable query for audio stream lookup
 * }
 */
class BaseProvider {
  /** @type {string} Unique lower-case provider name, e.g. "spotify" */
  get name() {
    throw new Error(`${this.constructor.name} must implement get name()`);
  }

  /**
   * URL / URI patterns that belong to this provider.
   * Used by the registry for automatic provider detection.
   * @returns {RegExp[]}
   */
  get patterns() {
    throw new Error(`${this.constructor.name} must implement get patterns()`);
  }

  /**
   * Resolves any input (URL, URI, or plain search query) into track(s).
   * @param {string} _input
   * @returns {Promise<{tracks: object[], type: "track"|"album"|"playlist"|"search"}>}
   */
  async resolve(_input) {
    throw new Error(`${this.constructor.name} must implement resolve(input)`);
  }
}

module.exports = BaseProvider;
