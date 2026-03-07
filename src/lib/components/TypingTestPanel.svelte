<script lang="ts">
	const WORD_LISTS: Record<string, string[]> = {
		common: [
			'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
			'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
			'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
			'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
			'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
			'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
			'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
			'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
			'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
			'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
			'any', 'these', 'give', 'day', 'most', 'us', 'great', 'between', 'need',
			'large', 'under', 'never', 'city', 'learn', 'change', 'light', 'still',
			'world', 'number', 'every', 'found', 'part', 'place', 'made', 'live'
		],
		programming: [
			'function', 'return', 'const', 'class', 'import', 'export', 'async',
			'await', 'interface', 'type', 'string', 'number', 'boolean', 'array',
			'object', 'null', 'undefined', 'promise', 'static', 'public', 'private',
			'extends', 'implements', 'abstract', 'module', 'require', 'default',
			'switch', 'break', 'continue', 'while', 'throw', 'catch', 'finally',
			'yield', 'delete', 'typeof', 'instanceof', 'debugger', 'component',
			'render', 'state', 'props', 'effect', 'callback', 'dispatch', 'action',
			'reducer', 'context', 'provider', 'consumer', 'element', 'event',
			'listener', 'handler', 'middleware', 'endpoint', 'response', 'request',
			'header', 'payload', 'token', 'schema', 'query', 'mutation', 'variable',
			'template', 'binding', 'reactive', 'computed', 'lifecycle', 'mounted'
		],
		chat: [
			'hello', 'thanks', 'meeting', 'update', 'message', 'channel', 'thread',
			'reply', 'mention', 'notification', 'server', 'invite', 'reaction',
			'emoji', 'status', 'online', 'offline', 'typing', 'sending', 'received',
			'pinned', 'bookmark', 'search', 'voice', 'video', 'screen', 'share',
			'mute', 'unmute', 'deafen', 'connect', 'disconnect', 'streaming',
			'upload', 'download', 'attachment', 'image', 'file', 'link', 'preview',
			'profile', 'avatar', 'nickname', 'role', 'permission', 'admin', 'owner',
			'moderator', 'member', 'settings', 'privacy', 'security', 'password',
			'account', 'login', 'logout', 'register', 'verify', 'confirm', 'cancel',
			'accept', 'decline', 'block', 'report', 'feedback', 'support', 'help'
		]
	};

	type TestState = 'idle' | 'running' | 'finished';
	type WordMode = 'common' | 'programming' | 'chat';

	let testState = $state<TestState>('idle');
	let wordMode = $state<WordMode>('common');
	let duration = $state(30);
	let words = $state<string[]>([]);
	let currentWordIndex = $state(0);
	let currentInput = $state('');
	let correctWords = $state(0);
	let incorrectWords = $state(0);
	let totalCharsTyped = $state(0);
	let correctCharsTyped = $state(0);
	let timeRemaining = $state(0);
	let startTime = $state(0);
	let timer: ReturnType<typeof setInterval> | null = null;
	let inputEl: HTMLInputElement | undefined = $state();
	let wordHistory = $state<{ word: string; typed: string; correct: boolean }[]>([]);
	let personalBest = $state<{ wpm: number; accuracy: number } | null>(null);

	let wpm = $derived((() => {
		if (testState === 'idle') return 0;
		const elapsed = testState === 'finished' ? (duration - 0) : (duration - timeRemaining);
		if (elapsed <= 0) return 0;
		return Math.round((correctWords / elapsed) * 60);
	})());

	let accuracy = $derived((() => {
		const total = correctWords + incorrectWords;
		if (total === 0) return 100;
		return Math.round((correctWords / total) * 100);
	})());

	let rawWpm = $derived((() => {
		if (testState === 'idle') return 0;
		const elapsed = duration - timeRemaining;
		if (elapsed <= 0) return 0;
		return Math.round(((correctWords + incorrectWords) / elapsed) * 60);
	})());

	let progress = $derived((() => {
		if (testState === 'idle') return 0;
		return ((duration - timeRemaining) / duration) * 100;
	})());

	function generateWords(count: number): string[] {
		const list = WORD_LISTS[wordMode];
		const result: string[] = [];
		for (let i = 0; i < count; i++) {
			result.push(list[Math.floor(Math.random() * list.length)]);
		}
		return result;
	}

	function startTest() {
		words = generateWords(200);
		currentWordIndex = 0;
		currentInput = '';
		correctWords = 0;
		incorrectWords = 0;
		totalCharsTyped = 0;
		correctCharsTyped = 0;
		timeRemaining = duration;
		wordHistory = [];
		testState = 'running';
		startTime = Date.now();

		timer = setInterval(() => {
			timeRemaining--;
			if (timeRemaining <= 0) {
				finishTest();
			}
		}, 1000);

		requestAnimationFrame(() => inputEl?.focus());
	}

	function finishTest() {
		testState = 'finished';
		if (timer) {
			clearInterval(timer);
			timer = null;
		}

		if (!personalBest || wpm > personalBest.wpm) {
			personalBest = { wpm, accuracy };
		}
	}

	function resetTest() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		testState = 'idle';
		currentInput = '';
		currentWordIndex = 0;
		words = [];
		wordHistory = [];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (testState !== 'running') return;

		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			const typed = currentInput.trim();
			if (typed.length === 0) return;

			const expected = words[currentWordIndex];
			const isCorrect = typed === expected;
			totalCharsTyped += typed.length;
			if (isCorrect) {
				correctWords++;
				correctCharsTyped += typed.length;
			} else {
				incorrectWords++;
			}

			wordHistory = [...wordHistory, { word: expected, typed, correct: isCorrect }];
			currentWordIndex++;
			currentInput = '';

			if (currentWordIndex >= words.length) {
				words = [...words, ...generateWords(50)];
			}
		}
	}

	function handleInput() {
		totalCharsTyped++;
	}

	function formatTime(secs: number): string {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
	}

	function getCharClass(wordIdx: number, charIdx: number): string {
		if (wordIdx > currentWordIndex) return '';
		if (wordIdx < currentWordIndex) {
			const entry = wordHistory[wordIdx];
			if (!entry) return '';
			return entry.correct ? 'correct' : 'incorrect';
		}
		// current word
		if (charIdx >= currentInput.length) return '';
		return currentInput[charIdx] === words[wordIdx][charIdx] ? 'correct' : 'incorrect';
	}
</script>

<div class="typing-test-panel">
	<div class="panel-header">
		<h3>Typing Speed Test</h3>
		{#if testState === 'idle'}
			<div class="config-row">
				<div class="mode-select">
					{#each ['common', 'programming', 'chat'] as mode}
						<button
							class:active={wordMode === mode}
							onclick={() => wordMode = mode as WordMode}
						>{mode}</button>
					{/each}
				</div>
				<div class="duration-select">
					{#each [15, 30, 60] as d}
						<button
							class:active={duration === d}
							onclick={() => duration = d}
						>{d}s</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if testState === 'idle'}
		<div class="start-screen">
			<div class="start-info">
				<p>Test your typing speed with <strong>{wordMode}</strong> words for <strong>{duration}s</strong></p>
				<p class="hint">Press Start or just begin typing</p>
			</div>
			<button class="start-btn" onclick={startTest}>Start Test</button>
			{#if personalBest}
				<div class="personal-best">
					Personal Best: <strong>{personalBest.wpm} WPM</strong> ({personalBest.accuracy}% accuracy)
				</div>
			{/if}
		</div>
	{:else if testState === 'running'}
		<div class="stats-bar">
			<div class="stat">
				<span class="stat-value">{wpm}</span>
				<span class="stat-label">WPM</span>
			</div>
			<div class="stat">
				<span class="stat-value">{accuracy}%</span>
				<span class="stat-label">Accuracy</span>
			</div>
			<div class="stat timer" class:warning={timeRemaining <= 10}>
				<span class="stat-value">{formatTime(timeRemaining)}</span>
				<span class="stat-label">Time</span>
			</div>
			<div class="stat">
				<span class="stat-value">{correctWords + incorrectWords}</span>
				<span class="stat-label">Words</span>
			</div>
		</div>

		<div class="progress-bar">
			<div class="progress-fill" style="width: {progress}%"></div>
		</div>

		<div class="word-display">
			{#each words.slice(Math.max(0, currentWordIndex - 3), currentWordIndex + 20) as word, i}
				{@const actualIdx = Math.max(0, currentWordIndex - 3) + i}
				<span
					class="word"
					class:current={actualIdx === currentWordIndex}
					class:completed={actualIdx < currentWordIndex}
					class:correct-word={actualIdx < currentWordIndex && wordHistory[actualIdx]?.correct}
					class:incorrect-word={actualIdx < currentWordIndex && !wordHistory[actualIdx]?.correct}
				>
					{#each word.split('') as char, ci}
						<span class="char {getCharClass(actualIdx, ci)}">{char}</span>
					{/each}
					{#if actualIdx === currentWordIndex && currentInput.length > word.length}
						{#each currentInput.slice(word.length).split('') as extra}
							<span class="char incorrect extra">{extra}</span>
						{/each}
					{/if}
				</span>
			{/each}
		</div>

		<div class="input-area">
			<input
				bind:this={inputEl}
				bind:value={currentInput}
				onkeydown={handleKeydown}
				oninput={handleInput}
				placeholder="Type here..."
				autocomplete="off"
				autocorrect="off"
				autocapitalize="off"
				spellcheck={false}
			/>
			<button class="reset-btn" onclick={resetTest}>Reset</button>
		</div>
	{:else}
		<div class="results">
			<div class="results-header">Test Complete!</div>
			<div class="results-grid">
				<div class="result-card primary">
					<span class="result-value">{wpm}</span>
					<span class="result-label">WPM</span>
				</div>
				<div class="result-card">
					<span class="result-value">{accuracy}%</span>
					<span class="result-label">Accuracy</span>
				</div>
				<div class="result-card">
					<span class="result-value">{rawWpm}</span>
					<span class="result-label">Raw WPM</span>
				</div>
				<div class="result-card">
					<span class="result-value">{correctWords}</span>
					<span class="result-label">Correct</span>
				</div>
				<div class="result-card">
					<span class="result-value">{incorrectWords}</span>
					<span class="result-label">Errors</span>
				</div>
				<div class="result-card">
					<span class="result-value">{totalCharsTyped}</span>
					<span class="result-label">Chars</span>
				</div>
			</div>

			{#if wordHistory.some(w => !w.correct)}
				<div class="mistakes-section">
					<h4>Mistakes</h4>
					<div class="mistakes-list">
						{#each wordHistory.filter(w => !w.correct) as entry}
							<div class="mistake">
								<span class="expected">{entry.word}</span>
								<span class="arrow">&rarr;</span>
								<span class="typed">{entry.typed}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="results-actions">
				<button class="start-btn" onclick={startTest}>Try Again</button>
				<button class="reset-btn" onclick={resetTest}>Back</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.typing-test-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.config-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.mode-select, .duration-select {
		display: flex;
		gap: 2px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		padding: 2px;
	}

	.mode-select button, .duration-select button {
		padding: 4px 10px;
		border: none;
		background: transparent;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		border-radius: 4px;
		font-size: 12px;
		text-transform: capitalize;
		transition: all 0.15s;
	}

	.mode-select button.active, .duration-select button.active {
		background: var(--brand-experiment, #5865f2);
		color: white;
	}

	.mode-select button:hover:not(.active), .duration-select button:hover:not(.active) {
		color: var(--text-normal, #dbdee1);
		background: rgba(255, 255, 255, 0.06);
	}

	.start-screen {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 16px;
		min-height: 200px;
	}

	.start-info {
		text-align: center;
	}

	.start-info p {
		margin: 4px 0;
		color: var(--text-muted, #949ba4);
		font-size: 14px;
	}

	.start-info .hint {
		font-size: 12px;
		color: var(--text-faint, #6d6f78);
	}

	.start-btn {
		padding: 10px 32px;
		background: var(--brand-experiment, #5865f2);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.start-btn:hover {
		background: var(--brand-experiment-560, #4752c4);
	}

	.personal-best {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		background: var(--bg-secondary, #2b2d31);
		padding: 6px 12px;
		border-radius: 4px;
	}

	.personal-best strong {
		color: #f0b232;
	}

	.stats-bar {
		display: flex;
		gap: 16px;
		justify-content: center;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.stat {
		text-align: center;
		min-width: 60px;
	}

	.stat-value {
		display: block;
		font-size: 20px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat.timer.warning .stat-value {
		color: #f23f43;
		animation: pulse-text 1s ease-in-out infinite;
	}

	@keyframes pulse-text {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.progress-bar {
		height: 3px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--brand-experiment, #5865f2);
		transition: width 1s linear;
		border-radius: 2px;
	}

	.word-display {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 18px;
		line-height: 1.6;
		min-height: 100px;
		user-select: none;
	}

	.word {
		transition: opacity 0.2s;
	}

	.word.completed {
		opacity: 0.5;
	}

	.word.correct-word {
		opacity: 0.4;
	}

	.word.incorrect-word {
		opacity: 0.6;
		text-decoration: line-through;
		text-decoration-color: #f23f43;
	}

	.word.current {
		background: rgba(88, 101, 242, 0.15);
		border-radius: 3px;
		padding: 0 2px;
	}

	.char {
		transition: color 0.1s;
	}

	.char.correct {
		color: #23a559;
	}

	.char.incorrect {
		color: #f23f43;
	}

	.char.extra {
		background: rgba(242, 63, 67, 0.2);
		border-radius: 2px;
	}

	.input-area {
		display: flex;
		gap: 8px;
	}

	.input-area input {
		flex: 1;
		padding: 10px 14px;
		background: var(--bg-tertiary, #1e1f22);
		border: 2px solid var(--brand-experiment, #5865f2);
		border-radius: 6px;
		color: var(--text-normal, #dbdee1);
		font-size: 16px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		outline: none;
		transition: border-color 0.15s;
	}

	.input-area input:focus {
		border-color: var(--brand-experiment-460, #7983f5);
	}

	.reset-btn {
		padding: 8px 16px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.15s;
	}

	.reset-btn:hover {
		color: var(--text-normal, #dbdee1);
		background: rgba(255, 255, 255, 0.06);
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 16px;
		align-items: center;
		flex: 1;
	}

	.results-header {
		font-size: 20px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		width: 100%;
		max-width: 400px;
	}

	.result-card {
		text-align: center;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.result-card.primary {
		background: var(--brand-experiment, #5865f2);
		grid-column: span 1;
	}

	.result-value {
		display: block;
		font-size: 24px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.result-card.primary .result-value {
		color: white;
		font-size: 28px;
	}

	.result-label {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.result-card.primary .result-label {
		color: rgba(255, 255, 255, 0.8);
	}

	.mistakes-section {
		width: 100%;
		max-width: 400px;
	}

	.mistakes-section h4 {
		margin: 0 0 8px 0;
		font-size: 13px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.mistakes-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.mistake {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		font-size: 12px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}

	.expected {
		color: #23a559;
	}

	.arrow {
		color: var(--text-faint, #6d6f78);
		font-size: 10px;
	}

	.typed {
		color: #f23f43;
	}

	.results-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
</style>
