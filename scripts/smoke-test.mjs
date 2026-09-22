/**
 * Deployment smoke test for the execution API.
 *
 *   node scripts/smoke-test.mjs                       # against localhost:3000
 *   BASE_URL=https://your-app.vercel.app npm run smoke
 *
 * Checks that every language compiles and runs, that stdout/stderr stay
 * separate, that exit codes and signals survive, and that bad input is
 * rejected. Exits non-zero if anything fails, so CI can gate on it.
 */

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

let passed = 0;
let failed = 0;

async function check(label, body, expectations) {
  const started = Date.now();
  let res;
  let data;
  try {
    res = await fetch(`${BASE}/api/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    data = await res.json();
  } catch (err) {
    failed++;
    console.log(`FAIL  ${label}\n        request failed: ${err.message}`);
    return;
  }

  const problems = [];
  for (const [key, want] of Object.entries(expectations)) {
    const got = key === 'httpStatus' ? res.status : data[key];
    const ok = typeof want === 'function' ? want(got) : JSON.stringify(got) === JSON.stringify(want);
    if (!ok) problems.push(`${key}: got ${JSON.stringify(got)}`);
  }

  if (problems.length) {
    failed++;
    console.log(`FAIL  ${label}  (${Date.now() - started}ms)`);
    problems.forEach((p) => console.log(`        ${p}`));
  } else {
    passed++;
    console.log(`PASS  ${label}  (${Date.now() - started}ms, via ${data.provider ?? 'n/a'})`);
  }
}

const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.json())
  .catch(() => null);
console.log(`Target: ${BASE}`);
console.log(`Providers: ${health?.providers?.join(', ') ?? 'unreachable'}\n`);

await check(
  'C++ - stdin, stdout, exit 0',
  {
    language: 'cpp',
    code: '#include <iostream>\nint main(){ int n; std::cin >> n; std::cout << "sq=" << n*n << "\\n"; return 0; }',
    stdin: '9\n',
  },
  { httpStatus: 200, stdout: 'sq=81\n', exitCode: 0, compileFailed: false },
);

await check(
  'C++ - compile error is reported, program never runs',
  { language: 'cpp', code: '#include <iostream>\nint main(){ std::cout << nope; return 0; }', stdin: '' },
  {
    httpStatus: 200,
    compileFailed: true,
    exitCode: null,
    compileOutput: (v) => typeof v === 'string' && v.includes('error:') && v.includes('main.cpp'),
  },
);

await check(
  'C++ - segfault is named',
  { language: 'cpp', code: '#include <cstdio>\nint main(){ int *p = nullptr; *p = 1; return 0; }', stdin: '' },
  { httpStatus: 200, killedBy: (v) => typeof v === 'string' && v.includes('SIGSEGV') },
);

await check(
  'C - stdout and stderr stay separate, exit code survives',
  {
    language: 'c',
    code: [
      '#include <stdio.h>',
      'int main(void){',
      '    int n; if (scanf("%d", &n) != 1) return 2;',
      '    printf("out:%d\\n", n);',
      '    fprintf(stderr, "err:%d\\n", n);',
      '    return 4;',
      '}',
    ].join('\n'),
    stdin: '5\n',
  },
  { httpStatus: 200, stdout: 'out:5\n', stderr: 'err:5\n', exitCode: 4 },
);

await check(
  'Python - traceback points at main.py',
  { language: 'python', code: 'print("hi")\nraise ValueError("boom")\n', stdin: '' },
  {
    httpStatus: 200,
    stdout: 'hi\n',
    stderr: (v) => typeof v === 'string' && v.includes('ValueError: boom') && v.includes('main.py'),
  },
);

await check('rejects an unknown language', { language: 'rust', code: 'fn main(){}' }, { httpStatus: 400 });
await check('rejects empty source', { language: 'c', code: '   ' }, { httpStatus: 400 });
await check('rejects oversized source', { language: 'c', code: 'x'.repeat(100_001) }, { httpStatus: 413 });

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);
