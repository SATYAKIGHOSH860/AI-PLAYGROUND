import type { LanguageId } from './types';

export interface LanguageConfig {
  id: LanguageId;
  label: string;
  /** Monaco language id. Monaco ships one tokenizer ('cpp') that covers C too. */
  monaco: string;
  /** File name shown in the editor tab and used by the compilers. */
  filename: string;
  /** Can this language run fully client-side (WASM)? */
  browserCapable: boolean;
  /** Toolchain shown before a run has happened. */
  toolchainHint: string;
  template: string;
  sampleStdin: string;
}

const PYTHON_TEMPLATE = `# AI Playground - Python 3
# Ctrl+Enter (Cmd+Enter on Mac) runs the file.
# Whatever you type in the "Input" tab is piped to stdin.


def fibonacci(count):
    """Yield the first \`count\` Fibonacci numbers."""
    a, b = 0, 1
    for _ in range(count):
        yield a
        a, b = b, a + b


def main():
    count = int(input("How many Fibonacci numbers? "))
    values = list(fibonacci(count))
    print("result:", *values)
    print("sum   :", sum(values))


if __name__ == "__main__":
    main()
`;

const C_TEMPLATE = `/* AI Playground - C (gcc, -std=c17)
 * Ctrl+Enter runs the file. The "Input" tab feeds stdin.
 */
#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) {
        fprintf(stderr, "expected one integer on stdin\\n");
        return 1;
    }

    unsigned long long factorial = 1;
    for (int i = 2; i <= n; i++) {
        factorial *= (unsigned long long)i;
    }

    printf("%d! = %llu\\n", n, factorial);
    return 0;
}
`;

const CPP_TEMPLATE = `// AI Playground - C++ (gcc, -std=c++17)
// Ctrl+Enter runs the file. The "Input" tab feeds stdin.
#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    int n;
    if (!(std::cin >> n)) {
        std::cerr << "expected a count on stdin\\n";
        return 1;
    }

    std::vector<int> values(n);
    for (int &value : values) {
        std::cin >> value;
    }

    std::sort(values.begin(), values.end());

    std::cout << "sorted:";
    for (int value : values) {
        std::cout << ' ' << value;
    }
    std::cout << '\\n';
    return 0;
}
`;

export const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  python: {
    id: 'python',
    label: 'Python',
    monaco: 'python',
    filename: 'main.py',
    browserCapable: true,
    toolchainHint: 'CPython 3.12 (WASM)',
    template: PYTHON_TEMPLATE,
    sampleStdin: '12\n',
  },
  c: {
    id: 'c',
    label: 'C',
    monaco: 'cpp',
    filename: 'main.c',
    browserCapable: false,
    toolchainHint: 'gcc 13.2.0',
    template: C_TEMPLATE,
    sampleStdin: '20\n',
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    monaco: 'cpp',
    filename: 'main.cpp',
    browserCapable: false,
    toolchainHint: 'g++ 13.2.0',
    template: CPP_TEMPLATE,
    sampleStdin: '6\n42 7 13 99 1 -4\n',
  },
};

export const LANGUAGE_ORDER: LanguageId[] = ['python', 'c', 'cpp'];

export function isLanguageId(value: unknown): value is LanguageId {
  return value === 'python' || value === 'c' || value === 'cpp';
}
