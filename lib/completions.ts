import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor, IRange, Position } from 'monaco-editor';

/**
 * Curated completions for Python, C and C++.
 *
 * Monaco on its own only offers word-based suggestions - it echoes words that
 * already appear in the buffer, which is close to useless while you are
 * writing something new. These lists give real keywords, standard library
 * names and snippets, so the auto-suggest toggle controls something worth
 * turning on.
 */

type ItemKind = 'keyword' | 'function' | 'class' | 'constant' | 'snippet';

interface CompletionSpec {
  label: string;
  kind: ItemKind;
  detail: string;
  insert?: string;
}

const kw = (labels: string[], detail: string): CompletionSpec[] =>
  labels.map((label) => ({ label, kind: 'keyword' as const, detail }));

const fn = (labels: string[], detail: string): CompletionSpec[] =>
  labels.map((label) => ({ label, kind: 'function' as const, detail }));

// --------------------------------------------------------------- python ---

const PYTHON: CompletionSpec[] = [
  ...kw(
    [
      'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
      'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
      'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
      'with', 'yield',
    ],
    'keyword',
  ),
  { label: 'True', kind: 'constant', detail: 'bool' },
  { label: 'False', kind: 'constant', detail: 'bool' },
  { label: 'None', kind: 'constant', detail: 'NoneType' },
  ...fn(
    [
      'print', 'input', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict',
      'set', 'tuple', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed',
      'enumerate', 'zip', 'map', 'filter', 'open', 'type', 'isinstance', 'any', 'all',
      'ord', 'chr', 'format', 'repr', 'divmod', 'pow', 'super',
    ],
    'builtin',
  ),
  {
    label: 'main',
    kind: 'snippet',
    detail: 'if __name__ == "__main__" guard',
    insert: 'if __name__ == "__main__":\n    ${0:main()}',
  },
  {
    label: 'def',
    kind: 'snippet',
    detail: 'function definition',
    insert: 'def ${1:name}(${2:args}):\n    ${0:pass}',
  },
  {
    label: 'class',
    kind: 'snippet',
    detail: 'class with __init__',
    insert: 'class ${1:Name}:\n    def __init__(self${2:}):\n        ${0:pass}',
  },
  {
    label: 'for',
    kind: 'snippet',
    detail: 'for over an iterable',
    insert: 'for ${1:item} in ${2:iterable}:\n    ${0:pass}',
  },
  {
    label: 'fori',
    kind: 'snippet',
    detail: 'for over a range',
    insert: 'for ${1:i} in range(${2:n}):\n    ${0:pass}',
  },
  {
    label: 'while',
    kind: 'snippet',
    detail: 'while loop',
    insert: 'while ${1:condition}:\n    ${0:pass}',
  },
  {
    label: 'ifmain',
    kind: 'snippet',
    detail: 'if / else',
    insert: 'if ${1:condition}:\n    ${2:pass}\nelse:\n    ${0:pass}',
  },
  {
    label: 'try',
    kind: 'snippet',
    detail: 'try / except',
    insert: 'try:\n    ${1:pass}\nexcept ${2:Exception} as exc:\n    ${0:print(exc)}',
  },
  {
    label: 'with',
    kind: 'snippet',
    detail: 'with open(...)',
    insert: 'with open(${1:"file.txt"}) as ${2:f}:\n    ${0:pass}',
  },
  {
    label: 'readints',
    kind: 'snippet',
    detail: 'read a line of integers from stdin',
    insert: '${1:values} = [int(x) for x in input().split()]\n$0',
  },
];

// -------------------------------------------------------------------- c ---

const C_LANG: CompletionSpec[] = [
  ...kw(
    [
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double',
      'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long',
      'register', 'restrict', 'return', 'short', 'signed', 'sizeof', 'static', 'struct',
      'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
    ],
    'keyword',
  ),
  ...fn(
    [
      'printf', 'scanf', 'puts', 'putchar', 'getchar', 'fgets', 'fprintf', 'sprintf',
      'sscanf', 'fopen', 'fclose', 'malloc', 'calloc', 'realloc', 'free', 'memset',
      'memcpy', 'strlen', 'strcpy', 'strncpy', 'strcmp', 'strcat', 'atoi', 'abs', 'exit',
      'qsort', 'rand', 'srand', 'fflush',
    ],
    'stdlib',
  ),
  {
    label: 'main',
    kind: 'snippet',
    detail: 'int main(void)',
    insert: 'int main(void) {\n    $0\n    return 0;\n}',
  },
  {
    label: 'for',
    kind: 'snippet',
    detail: 'counted for loop',
    insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    $0\n}',
  },
  {
    label: 'while',
    kind: 'snippet',
    detail: 'while loop',
    insert: 'while (${1:condition}) {\n    $0\n}',
  },
  {
    label: 'ifelse',
    kind: 'snippet',
    detail: 'if / else',
    insert: 'if (${1:condition}) {\n    ${2}\n} else {\n    $0\n}',
  },
  {
    label: 'printf',
    kind: 'snippet',
    detail: 'printf with a newline',
    insert: 'printf("${1:%d}\\n", ${0});',
  },
  {
    label: 'scanf',
    kind: 'snippet',
    detail: 'scanf into a variable',
    insert: 'scanf("${1:%d}", &${0});',
  },
  {
    label: 'struct',
    kind: 'snippet',
    detail: 'typedef struct',
    insert: 'typedef struct {\n    ${1:int value;}\n} ${2:Name};\n$0',
  },
  { label: '#include <stdio.h>', kind: 'snippet', detail: 'standard I/O', insert: '#include <stdio.h>\n$0' },
  { label: '#include <stdlib.h>', kind: 'snippet', detail: 'standard library', insert: '#include <stdlib.h>\n$0' },
  { label: '#include <string.h>', kind: 'snippet', detail: 'string helpers', insert: '#include <string.h>\n$0' },
];

// ------------------------------------------------------------------ c++ ---

const CPP_LANG: CompletionSpec[] = [
  ...kw(
    [
      'alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class',
      'const', 'constexpr', 'const_cast', 'continue', 'decltype', 'default', 'delete',
      'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'extern', 'false',
      'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable',
      'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected',
      'public', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
      'static_cast', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try',
      'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'while',
    ],
    'keyword',
  ),
  ...[
    'std::vector', 'std::string', 'std::cout', 'std::cin', 'std::cerr', 'std::endl',
    'std::sort', 'std::map', 'std::unordered_map', 'std::set', 'std::unordered_set',
    'std::pair', 'std::make_pair', 'std::max', 'std::min', 'std::swap', 'std::find',
    'std::accumulate', 'std::to_string', 'std::stoi', 'std::queue', 'std::stack',
    'std::priority_queue', 'std::array', 'std::abs', 'std::reverse', 'std::unique',
    'std::lower_bound', 'std::upper_bound', 'std::size_t', 'std::move',
  ].map((label) => ({ label, kind: 'class' as const, detail: 'std' })),
  {
    label: 'main',
    kind: 'snippet',
    detail: 'int main()',
    insert: 'int main() {\n    $0\n    return 0;\n}',
  },
  {
    label: 'fastio',
    kind: 'snippet',
    detail: 'untie cin/cout for speed',
    insert: 'std::ios::sync_with_stdio(false);\nstd::cin.tie(nullptr);\n$0',
  },
  {
    label: 'for',
    kind: 'snippet',
    detail: 'counted for loop',
    insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    $0\n}',
  },
  {
    label: 'foreach',
    kind: 'snippet',
    detail: 'range-based for loop',
    insert: 'for (const auto &${1:item} : ${2:container}) {\n    $0\n}',
  },
  {
    label: 'cout',
    kind: 'snippet',
    detail: 'print with a newline',
    insert: "std::cout << ${1} << '\\n';\n$0",
  },
  {
    label: 'vector',
    kind: 'snippet',
    detail: 'declare a vector',
    insert: 'std::vector<${1:int}> ${2:values};\n$0',
  },
  {
    label: 'readvec',
    kind: 'snippet',
    detail: 'read n values into a vector',
    insert:
      'int ${1:n};\nstd::cin >> ${1:n};\nstd::vector<${2:int}> ${3:values}(${1:n});\nfor (auto &x : ${3:values}) std::cin >> x;\n$0',
  },
  {
    label: 'class',
    kind: 'snippet',
    detail: 'class definition',
    insert: 'class ${1:Name} {\npublic:\n    ${1:Name}() = default;\n\nprivate:\n    $0\n};',
  },
  { label: '#include <iostream>', kind: 'snippet', detail: 'streams', insert: '#include <iostream>\n$0' },
  { label: '#include <vector>', kind: 'snippet', detail: 'vector', insert: '#include <vector>\n$0' },
  { label: '#include <algorithm>', kind: 'snippet', detail: 'algorithms', insert: '#include <algorithm>\n$0' },
  { label: '#include <string>', kind: 'snippet', detail: 'string', insert: '#include <string>\n$0' },
];

let registered = false;

export function registerCompletions(monaco: Monaco): void {
  // Monaco is a page-level singleton; registering twice would duplicate every
  // suggestion in the list.
  if (registered) return;
  registered = true;

  const kindOf = (kind: ItemKind) => {
    const K = monaco.languages.CompletionItemKind;
    switch (kind) {
      case 'keyword':
        return K.Keyword;
      case 'function':
        return K.Function;
      case 'class':
        return K.Class;
      case 'constant':
        return K.Constant;
      default:
        return K.Snippet;
    }
  };

  const build = (specs: CompletionSpec[], range: IRange) =>
    specs.map((spec) => ({
      label: spec.label,
      kind: kindOf(spec.kind),
      detail: spec.detail,
      insertText: spec.insert ?? spec.label,
      insertTextRules: spec.insert
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      // Snippets first, then keywords, then the rest.
      sortText: spec.kind === 'snippet' ? `0${spec.label}` : `1${spec.label}`,
      range,
    }));

  const rangeAt = (model: MonacoEditor.ITextModel, position: Position): IRange => {
    const word = model.getWordUntilPosition(position);
    return {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };
  };

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model, position) => ({
      suggestions: build(PYTHON, rangeAt(model, position)),
    }),
  });

  // Monaco uses one tokenizer id ('cpp') for both C and C++, so the file name
  // is what tells the two apart.
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', ':', '>', '#'],
    provideCompletionItems: (model, position) => {
      const isC = model.uri.path.endsWith('.c');
      return { suggestions: build(isC ? C_LANG : CPP_LANG, rangeAt(model, position)) };
    },
  });
}
