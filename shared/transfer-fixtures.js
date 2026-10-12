export const transferWork = {
  title: 'Reading-list design: explanation versus transfer', subject: 'Computer science',
  brief: 'Explain the reading-list design, then apply the same ideas when a constraint or bug changes.',
  concepts: ['Dictionaries', 'Search complexity', 'Testing'],
  text: `My reading-list design

Dictionaries
I use a dictionary keyed by ISBN because each catalog entry has a unique ISBN. This prevents duplicate catalog entries and lets me update a book directly. The dictionary uses extra memory compared with a plain list, but the direct lookup makes that trade-off worthwhile.

Search complexity
Looking up an ISBN in the dictionary takes O(1) time on average. Scanning a list to find the same ISBN takes O(n). Hash collisions can make the worst case slower, so average constant time is not a guarantee for every possible input.

Testing
I tested an existing book, a missing ISBN, duplicate catalog entries and an empty reading list. I use books.get(isbn), which returns None for a missing key, and then display a not-found message. A regression test checks that rejecting a duplicate keeps the original catalog entry unchanged.`,
}
const excerpts = transferWork.text.split('\n\n').slice(1).map(s => s.split('\n').slice(1).join('\n'))
export const benchmarkPairs = [
  { concept: 'Dictionaries', sourceQuote: excerpts[0], changeType: 'constraint', invariant: 'Keys identify the entity being updated; distinct physical copies must not overwrite each other.',
    originalQuestion: 'Why did you key the catalog by ISBN rather than use a plain list?',
    changedScenario: 'The library now tracks two physical copies of the same edition. They share an ISBN, but one is loaned and the other is available.',
    transferQuestion: 'How would you change the storage so updating one copy does not overwrite the other copy’s status?',
    expectedOriginal: 'ISBN uniquely identifies each catalog entry; keyed lookup avoids a full list scan, at a memory cost.',
    expectedTransfer: 'Distinguish catalog identity from physical-copy identity. Store copies by copy ID or a composite ISBN/copy key, or maintain a list/map of individually identified copies under each ISBN. Update the correct copy independently.',
    acceptableAlternatives: ['An ISBN metadata catalog plus a separate copy-ID dictionary.', 'A composite (ISBN, copy-ID) key.', 'An ISBN-to-list-of-copy-records structure with distinct copy IDs.'] },
  { concept: 'Search complexity', sourceQuote: excerpts[1], changeType: 'scenario', invariant: 'A direct keyed lookup is fast for its key; searching other fields may require scanning or another index.',
    originalQuestion: 'Why is ISBN lookup faster on average than scanning your reading list?',
    changedScenario: 'A new request asks for all books by an author. Your current dictionary is still keyed by ISBN, not by author.',
    transferQuestion: 'Is the author query still a single average O(1) lookup? Explain a valid way to handle it and the cost.',
    expectedOriginal: 'Average hash-key lookup is O(1), versus O(n) scanning; the guarantee is average-case.',
    expectedTransfer: 'The ISBN index does not directly answer author queries. Scanning values is O(n), or an author-to-many-ISBNs index can locate a bucket efficiently but returning k matches costs at least O(k). Justify the memory/update trade-off if adding an index.',
    acceptableAlternatives: ['An honest O(n) scan for a small or rarely queried catalog, with a justified trade-off.', 'An author-to-list/set-of-ISBNs secondary index, noting multiple books and output cost.', 'A database index on author with accurate explanation of its lookup/output costs.'] },
  { concept: 'Testing', sourceQuote: excerpts[2], changeType: 'bug', invariant: 'Absence is different from a valid empty value; a regression test must expose the actual failure.',
    originalQuestion: 'How did your missing-ISBN and duplicate tests help protect the reading list?',
    changedScenario: 'During import, an existing book may temporarily have an empty record {}. A new function does: book = books.get(isbn); if not book: return "not found".',
    transferQuestion: 'What bug appears for that existing empty record, and what regression test and change would distinguish it from a missing ISBN?',
    expectedOriginal: 'Tests cover missing keys and duplicates; get returns None for absence, and rejection preserves existing data.',
    expectedTransfer: 'An empty dictionary is falsey, so the function incorrectly treats a present record as missing. Test a present key mapped to {} and a genuinely absent key. Use key membership or book is None when None uniquely represents absence.',
    acceptableAlternatives: ['Check isbn in books rather than truthiness.', 'Use a unique sentinel for missing keys.', 'Check book is None under the stated contract, preserving the present-empty regression case.'] },
]
export const transferProfiles = [
  { kind: 'strong', name: 'Strong transfer · fictional example', expected: 'STRONG', description: 'Justifies the original design, then adapts it coherently under each change.',
    originals: [
      'ISBN is unique for a catalog entry, so I can use it as a key and update directly rather than scan a list. That adds memory overhead, but direct access and duplicate prevention suit this catalog.',
      'Hashing the ISBN lets the dictionary locate the value in average O(1) time. Scanning a list may inspect all n entries, so it is O(n). Collisions mean the constant-time claim is an average rather than an absolute guarantee.',
      'The missing-key test checks the not-found path. The duplicate test confirms rejection does not replace the first entry. Using get gives None for a missing key so I can handle absence explicitly instead of crashing.',
    ],
    applications: [
      'ISBN identifies the edition, not each physical copy. I would keep edition metadata keyed by ISBN and give every physical copy a unique copy ID with its own status. Both copy records refer to the same ISBN, so updating one copy ID cannot overwrite the other’s availability.',
      'No: author is not the current key, so the ISBN hash lookup does not directly answer it. I can scan values in O(n), or build an author-to-list-of-ISBNs index. The index costs memory and update work; returning k books still takes O(k), even if finding the author’s bucket is fast.',
      'An empty dictionary is falsey, so if not book incorrectly returns not found for a present key. I would add a regression with books containing an ISBN mapped to {} and also test an absent ISBN. Then I would check key membership, or is None under the stated get contract, instead of truthiness.',
    ] },
  { kind: 'partial', name: 'Partial transfer · fictional example', expected: 'PARTIAL', description: 'Recognizes the change, but leaves a required implementation or reasoning step unresolved.',
    originals: [
      'ISBN is a unique catalog key, so the dictionary gives direct updates and average fast lookup instead of scanning a list. I accept its extra memory use.',
      'A hash dictionary uses the ISBN key for average O(1) lookup; a list search scans entries in O(n). Collisions are a reason the average claim is not a universal guarantee.',
      'The missing test checks how get returns None for absent ISBNs. The duplicate test should preserve the original entry when a new duplicate is rejected.',
    ],
    applications: [
      'I would put a list of statuses under the ISBN so two copies can both be stored. I have not decided how to identify which item in that list belongs to the copy being updated.',
      'The author needs a second lookup structure because it is not the ISBN key. I would map each author to a list of ISBNs. I have not worked out the cost of collecting those results or keeping that index up to date.',
      'The empty dictionary should be a test case as well as a missing ISBN. The function seems to treat them alike. I would add both tests, but I am not certain which condition should replace if not book.',
    ] },
  { kind: 'weak', name: 'Explanation–transfer gap · fictional example', expected: 'WEAK', description: 'Can reproduce sound original reasoning, but repeats it when the changed situation requires a different application.',
    originals: [
      'ISBN uniquely identifies each catalog entry, so the dictionary lets me update directly rather than scan a list. This costs more memory but prevents duplicate catalog entries and gives average fast lookup.',
      'Dictionary lookup is O(1) on average because hashing uses the ISBN key. Searching a list requires O(n) scanning. Collisions can make the worst case slower.',
      'I tested missing ISBNs and duplicate entries. get returns None for a missing key, so I can show a not-found message, and the duplicate test keeps the original catalog entry unchanged.',
    ],
    applications: [
      'I would keep a single record and status under that ISBN. ISBN is unique, so the two physical copies will have different statuses without overwriting even when I update the same key.',
      'It is still O(1) because dictionaries are O(1). The ISBN dictionary will directly find every book by author without scanning or another index.',
      'The function is already correct. If not book only happens when the ISBN is missing. An existing empty dictionary cannot trigger it, so the original missing-ISBN test is enough.',
    ] },
]
