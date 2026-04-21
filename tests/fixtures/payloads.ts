export const XSS_PAYLOADS = [
  `<script>window.__xss=1</script>`,
  `"><script>window.__xss=1</script>`,
  `<img src=x onerror="window.__xss=1">`,
  `<svg onload="window.__xss=1">`,
  `javascript:window.__xss=1`,
  `<iframe src="javascript:window.__xss=1">`,
  `" autofocus onfocus="window.__xss=1`,
  `<body onpageshow="window.__xss=1">`,
];

export const SQLI_PAYLOADS = [
  `' OR '1'='1`,
  `'; DROP TABLE users; --`,
  `' UNION SELECT * FROM users--`,
  `1 OR 1=1`,
  `'; DELETE FROM expenses WHERE '1'='1`,
  `admin'--`,
  `" OR ""="`,
  `') OR ('1'='1`,
];
