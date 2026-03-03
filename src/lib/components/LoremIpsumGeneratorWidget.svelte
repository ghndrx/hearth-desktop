<script lang="ts">
  import { onMount } from 'svelte';

  // Lorem Ipsum word bank
  const loremWords = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'at', 'vero', 'eos',
    'accusamus', 'iusto', 'odio', 'dignissimos', 'ducimus', 'blanditiis',
    'praesentium', 'voluptatum', 'deleniti', 'atque', 'corrupti', 'quos', 'dolores',
    'quas', 'molestias', 'excepturi', 'obcaecati', 'cupiditate', 'provident',
    'similique', 'neque', 'porro', 'quisquam', 'nihil', 'impedit', 'quo', 'minus',
    'quod', 'maxime', 'placeat', 'facere', 'possimus', 'omnis', 'voluptas',
    'assumenda', 'repellendus', 'temporibus', 'autem', 'quibusdam', 'officiis',
    'debitis', 'aut', 'rerum', 'necessitatibus', 'saepe', 'eveniet', 'voluptates',
    'repudiandae', 'recusandae', 'itaque', 'earum', 'hic', 'tenetur', 'sapiente',
    'delectus', 'reiciendis', 'voluptatibus', 'maiores', 'alias', 'perferendis',
    'doloribus', 'asperiores', 'repellat'
  ];

  // Classic opening sentence
  const classicOpening = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

  type GenerationType = 'paragraphs' | 'sentences' | 'words';

  let generationType: GenerationType = 'paragraphs';
  let count = 3;
  let startWithLorem = true;
  let generatedText = '';
  let copied = false;
  let charCount = 0;
  let wordCount = 0;

  function getRandomWord(): string {
    return loremWords[Math.floor(Math.random() * loremWords.length)];
  }

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function generateSentence(minWords = 8, maxWords = 15): string {
    const length = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
    const words: string[] = [];
    
    for (let i = 0; i < length; i++) {
      words.push(getRandomWord());
    }
    
    // Capitalize first word and add period
    words[0] = capitalize(words[0]);
    return words.join(' ') + '.';
  }

  function generateParagraph(minSentences = 4, maxSentences = 8): string {
    const length = Math.floor(Math.random() * (maxSentences - minSentences + 1)) + minSentences;
    const sentences: string[] = [];
    
    for (let i = 0; i < length; i++) {
      sentences.push(generateSentence());
    }
    
    return sentences.join(' ');
  }

  function generateWords(count: number): string {
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(getRandomWord());
    }
    return words.join(' ');
  }

  function generate() {
    let result: string[] = [];
    
    switch (generationType) {
      case 'paragraphs':
        for (let i = 0; i < count; i++) {
          if (i === 0 && startWithLorem) {
            result.push(classicOpening + ' ' + generateParagraph(3, 6));
          } else {
            result.push(generateParagraph());
          }
        }
        generatedText = result.join('\n\n');
        break;
        
      case 'sentences':
        for (let i = 0; i < count; i++) {
          if (i === 0 && startWithLorem) {
            result.push(classicOpening);
          } else {
            result.push(generateSentence());
          }
        }
        generatedText = result.join(' ');
        break;
        
      case 'words':
        if (startWithLorem) {
          const loremStart = 'lorem ipsum dolor sit amet';
          const loremWordCount = 5;
          if (count <= loremWordCount) {
            generatedText = loremStart.split(' ').slice(0, count).join(' ');
          } else {
            generatedText = loremStart + ' ' + generateWords(count - loremWordCount);
          }
        } else {
          generatedText = generateWords(count);
        }
        break;
    }
    
    updateCounts();
  }

  function updateCounts() {
    charCount = generatedText.length;
    wordCount = generatedText.trim() ? generatedText.trim().split(/\s+/).length : 0;
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedText);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function clear() {
    generatedText = '';
    charCount = 0;
    wordCount = 0;
  }

  function handleCountInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 100) {
      count = value;
    }
  }

  onMount(() => {
    generate();
  });
</script>

<div class="lorem-widget">
  <div class="widget-header">
    <h3>📝 Lorem Ipsum Generator</h3>
  </div>

  <div class="controls">
    <div class="control-group">
      <label for="gen-type">Generate</label>
      <select id="gen-type" bind:value={generationType} on:change={generate}>
        <option value="paragraphs">Paragraphs</option>
        <option value="sentences">Sentences</option>
        <option value="words">Words</option>
      </select>
    </div>

    <div class="control-group">
      <label for="count">Count</label>
      <input
        id="count"
        type="number"
        min="1"
        max="100"
        bind:value={count}
        on:input={handleCountInput}
        on:change={generate}
      />
    </div>

    <div class="control-group checkbox-group">
      <label>
        <input type="checkbox" bind:checked={startWithLorem} on:change={generate} />
        Start with "Lorem ipsum..."
      </label>
    </div>
  </div>

  <div class="output-area">
    <textarea
      bind:value={generatedText}
      on:input={updateCounts}
      placeholder="Generated text will appear here..."
      spellcheck="false"
    ></textarea>
  </div>

  <div class="stats-bar">
    <span class="stat">{wordCount} words</span>
    <span class="stat">{charCount} characters</span>
  </div>

  <div class="actions">
    <button class="btn-primary" on:click={generate}>
      🔄 Regenerate
    </button>
    <button class="btn-secondary" on:click={copyToClipboard} disabled={!generatedText}>
      {copied ? '✓ Copied!' : '📋 Copy'}
    </button>
    <button class="btn-secondary" on:click={clear} disabled={!generatedText}>
      🗑️ Clear
    </button>
  </div>
</div>

<style>
  .lorem-widget {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    color: var(--text-primary, #dcddde);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-width: 320px;
    max-width: 500px;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #ffffff);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-end;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .control-group label {
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
    font-weight: 500;
  }

  .control-group select,
  .control-group input[type="number"] {
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
    font-size: 14px;
    min-width: 100px;
  }

  .control-group input[type="number"] {
    width: 80px;
  }

  .checkbox-group {
    flex-direction: row;
    align-items: center;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-group input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--brand-primary, #5865f2);
  }

  .output-area {
    flex: 1;
    min-height: 150px;
  }

  .output-area textarea {
    width: 100%;
    height: 150px;
    padding: 12px;
    border: none;
    border-radius: 4px;
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    font-family: inherit;
  }

  .output-area textarea:focus {
    outline: 2px solid var(--brand-primary, #5865f2);
    outline-offset: -2px;
  }

  .output-area textarea::placeholder {
    color: var(--text-muted, #72767d);
  }

  .stats-bar {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .actions button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--brand-primary, #5865f2);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover, #4752c4);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-modifier-hover, #36393f);
  }

  /* Scrollbar styling */
  .output-area textarea::-webkit-scrollbar {
    width: 8px;
  }

  .output-area textarea::-webkit-scrollbar-track {
    background: transparent;
  }

  .output-area textarea::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, #202225);
    border-radius: 4px;
  }

  .output-area textarea::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, #36393f);
  }
</style>
