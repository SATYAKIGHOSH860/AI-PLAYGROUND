/**
 * Word source for the typing test.
 *
 * A hand-written list of the most common English words, which is what makes a
 * typing test measure typing rather than reading comprehension - rare words
 * make people stop and think, and thinking time is not typing speed.
 */

const COMMON_WORDS = [
  'the', 'be', 'of', 'and', 'a', 'to', 'in', 'he', 'have', 'it',
  'that', 'for', 'they', 'with', 'as', 'not', 'on', 'she', 'at', 'by',
  'this', 'we', 'you', 'do', 'but', 'from', 'or', 'which', 'one', 'would',
  'all', 'will', 'there', 'say', 'who', 'make', 'when', 'can', 'more', 'if',
  'no', 'man', 'out', 'other', 'so', 'what', 'time', 'up', 'go', 'about',
  'than', 'into', 'could', 'state', 'only', 'new', 'year', 'some', 'take', 'come',
  'these', 'know', 'see', 'use', 'get', 'like', 'then', 'first', 'any', 'work',
  'now', 'may', 'such', 'give', 'over', 'think', 'most', 'even', 'find', 'day',
  'also', 'after', 'way', 'many', 'must', 'look', 'before', 'great', 'back', 'through',
  'long', 'where', 'much', 'should', 'well', 'people', 'down', 'own', 'just', 'because',
  'good', 'each', 'those', 'feel', 'seem', 'how', 'high', 'too', 'place', 'little',
  'world', 'very', 'still', 'hand', 'old', 'life', 'tell', 'write', 'become', 'here',
  'show', 'house', 'both', 'between', 'need', 'mean', 'call', 'under', 'last', 'right',
  'move', 'thing', 'school', 'never', 'same', 'another', 'begin', 'while', 'number', 'part',
  'turn', 'real', 'leave', 'might', 'want', 'point', 'form', 'off', 'child', 'few',
  'small', 'since', 'against', 'ask', 'late', 'home', 'large', 'person', 'end', 'open',
  'follow', 'during', 'present', 'without', 'again', 'hold', 'around', 'possible', 'head', 'word',
  'problem', 'however', 'lead', 'system', 'set', 'order', 'eye', 'plan', 'run', 'keep',
  'face', 'fact', 'group', 'play', 'stand', 'early', 'course', 'change', 'help', 'line',
  'city', 'money', 'story', 'young', 'night', 'water', 'room', 'study', 'book', 'door',
  'week', 'car', 'road', 'light', 'front', 'voice', 'name', 'friend', 'family', 'music',
];

const SENTENCE_ENDINGS = ['.', '.', '.', '?', '!'];
const MID_MARKS = [',', ',', ';', ':'];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface WordOptions {
  punctuation: boolean;
  numbers: boolean;
}

/**
 * Builds `count` words. Punctuation is applied as whole sentences - a comma or
 * full stop, with the next word capitalised - rather than sprinkled randomly,
 * because typing real sentence shapes is what the option is for.
 */
export function generateWords(count: number, options: WordOptions): string[] {
  const words: string[] = [];
  let capitaliseNext = options.punctuation;

  for (let i = 0; i < count; i++) {
    if (options.numbers && Math.random() < 0.08) {
      words.push(String(Math.floor(Math.random() * 9999) + 1));
      continue;
    }

    let word = pick(COMMON_WORDS);

    if (options.punctuation) {
      if (capitaliseNext) {
        word = word[0].toUpperCase() + word.slice(1);
        capitaliseNext = false;
      }

      const roll = Math.random();
      const isLast = i === count - 1;

      if (isLast || roll < 0.09) {
        word += pick(SENTENCE_ENDINGS);
        capitaliseNext = true;
      } else if (roll < 0.16) {
        word += pick(MID_MARKS);
      } else if (roll < 0.19) {
        word = `"${word}"`;
      } else if (roll < 0.21) {
        word = `(${word})`;
      }
    }

    words.push(word);
  }

  return words;
}
