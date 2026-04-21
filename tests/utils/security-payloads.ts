/**
 * XSS payloads. All are benign (no external call, no clipboard theft) —
 * they set window.__XSS_TRIGGERED = true so tests can detect execution.
 * TEST_ prefix ensures cleanup recognizes these rows.
 */
export const XSS_PAYLOADS = [
  `TEST_<script>window.__XSS_TRIGGERED=true</script>`,
  `TEST_<img src=x onerror="window.__XSS_TRIGGERED=true">`,
  `TEST_<svg onload="window.__XSS_TRIGGERED=true">`,
  `TEST_"><script>window.__XSS_TRIGGERED=true</script>`,
  `TEST_javascript:window.__XSS_TRIGGERED=true`,
  `TEST_<iframe src="javascript:window.__XSS_TRIGGERED=true">`,
  // HTML entity / encoding bypass attempts
  `TEST_&lt;script&gt;alert('x')&lt;/script&gt;`,
  // Attribute injection
  `TEST_" onclick="window.__XSS_TRIGGERED=true"`,
];

/**
 * SQL injection payloads targeting common patterns.
 * None are destructive — they probe for leakage, not damage.
 */
export const SQL_PAYLOADS = [
  `TEST_' OR '1'='1`,
  `TEST_' OR 1=1--`,
  `TEST_'; SELECT * FROM users--`,
  `TEST_' UNION SELECT password_hash FROM users--`,
  `TEST_%' OR '%`,
  // Quote handling (legitimate edge cases)
  `TEST_it's a test`,
  `TEST_"double quotes"`,
  // Null byte + backslash
  `TEST_\\'; DROP TABLE--`,
];

/** Marker key that tests check via page.evaluate. */
export const XSS_MARKER_KEY = '__XSS_TRIGGERED';
