const TOKEN_KEYS = ['access_token', 'refresh_token', 'code', 'token', 'token_hash'] as const;
const ERROR_KEYS = ['error', 'error_code', 'error_description'] as const;

export type RecoveryLinkStatus = 'missing' | 'present' | 'error';

function readParams(raw: string): URLSearchParams {
  const body = raw.startsWith('?') || raw.startsWith('#') ? raw.slice(1) : raw;
  if (!body) return new URLSearchParams();
  return new URLSearchParams(body);
}

function hasNonEmpty(params: URLSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => {
    const value = params.get(key);
    return Boolean(value && value.trim());
  });
}

/**
 * Recovery links land as query (`?code=` / `?token_hash=`) or hash
 * (`#access_token=&type=recovery`). Expired links use `error` / `error_code`.
 */
export function getRecoveryLinkStatus(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  hash: string = typeof window === 'undefined' ? '' : window.location.hash,
): RecoveryLinkStatus {
  const searchParams = readParams(search);
  const hashParams = readParams(hash);

  if (hasNonEmpty(searchParams, ERROR_KEYS) || hasNonEmpty(hashParams, ERROR_KEYS)) {
    return 'error';
  }
  if (hasNonEmpty(searchParams, TOKEN_KEYS) || hasNonEmpty(hashParams, TOKEN_KEYS)) {
    return 'present';
  }
  return 'missing';
}
