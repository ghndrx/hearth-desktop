<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { writeFile } from '@tauri-apps/plugin-fs';
  import { save } from '@tauri-apps/plugin-dialog';
  import { join, downloadDir } from '@tauri-apps/api/path';
  
  interface Screenshot {
    id: string;
    data: Uint8Array;
    dataUrl: string;
    width: number;
    height: number;
    capturedAt: Date;
    type: 'fullscreen' | 'window' | 'selection';
  }
  
  interface SelectionRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  
  const dispatch = createEventDispatcher<{
    captured: Screenshot;
    saved: string;
    cancelled: void;
    error: Error;
  }>();
  
  export let captureOnMount = false;
  export let showPreview = true;
  export let enableAnnotations = true;
  
  let isCapturing = false;
  let isSelecting = false;
  let currentScreenshot: Screenshot | null = null;
  let selectionRect: SelectionRect | null = null;
  let selectionStart: { x: number; y: number } | null = null;
  let previewCanvas: HTMLCanvasElement;
  let annotationCanvas: HTMLCanvasElement;
  let annotationCtx: CanvasRenderingContext2D | null = null;
  let currentTool: 'pen' | 'arrow' | 'rectangle' | 'text' | 'blur' = 'pen';
  let currentColor = '#ff0000';
  let isDrawing = false;
  let lastPoint: { x: number; y: number } | null = null;
  let shortcuts: Array<() => void> = [];
  
  onMount(async () => {
    if (captureOnMount) {
      await captureFullscreen();
    }
    setupKeyboardShortcuts();
  });
  
  onDestroy(() => {
    shortcuts.forEach(unsub => unsub());
  });
  
  function setupKeyboardShortcuts() {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + S = Screenshot
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        captureFullscreen();
      }
      // Ctrl/Cmd + Shift + A = Area selection
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        startAreaSelection();
      }
      // Escape to cancel
      if (e.key === 'Escape' && (isSelecting || currentScreenshot)) {
        cancelCapture();
      }
    };
    
    window.addEventListener('keydown', handler);
    shortcuts.push(() => window.removeEventListener('keydown', handler));
  }
  
  function generateId(): string {
    return `ss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  export async function captureFullscreen(): Promise<Screenshot | null> {
    isCapturing = true;
    
    try {
      // Hide our window temporarily for clean capture
      const appWindow = await getCurrentWindow();
      await appWindow.hide();
      
      // Small delay to ensure window is hidden
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture using Tauri command
      const result = await invoke<{ data: number[]; width: number; height: number }>('capture_screen');
      
      // Show window again
      await appWindow.show();
      await appWindow.setFocus();
      
      const data = new Uint8Array(result.data);
      const dataUrl = await arrayToDataUrl(data);
      
      const screenshot: Screenshot = {
        id: generateId(),
        data,
        dataUrl,
        width: result.width,
        height: result.height,
        capturedAt: new Date(),
        type: 'fullscreen'
      };
      
      currentScreenshot = screenshot;
      dispatch('captured', screenshot);
      
      if (showPreview) {
        await renderPreview();
      }
      
      return screenshot;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      dispatch('error', error as Error);
      return null;
    } finally {
      isCapturing = false;
    }
  }
  
  export async function captureWindow(): Promise<Screenshot | null> {
    isCapturing = true;
    
    try {
      const result = await invoke<{ data: number[]; width: number; height: number }>('capture_active_window');
      
      const data = new Uint8Array(result.data);
      const dataUrl = await arrayToDataUrl(data);
      
      const screenshot: Screenshot = {
        id: generateId(),
        data,
        dataUrl,
        width: result.width,
        height: result.height,
        capturedAt: new Date(),
        type: 'window'
      };
      
      currentScreenshot = screenshot;
      dispatch('captured', screenshot);
      
      if (showPreview) {
        await renderPreview();
      }
      
      return screenshot;
    } catch (error) {
      console.error('Window capture failed:', error);
      dispatch('error', error as Error);
      return null;
    } finally {
      isCapturing = false;
    }
  }
  
  export function startAreaSelection() {
    isSelecting = true;
    selectionRect = null;
    selectionStart = null;
  }
  
  function handleSelectionMouseDown(event: MouseEvent) {
    if (!isSelecting) return;
    
    selectionStart = { x: event.clientX, y: event.clientY };
    selectionRect = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
  }
  
  function handleSelectionMouseMove(event: MouseEvent) {
    if (!isSelecting || !selectionStart || !selectionRect) return;
    
    const x = Math.min(selectionStart.x, event.clientX);
    const y = Math.min(selectionStart.y, event.clientY);
    const width = Math.abs(event.clientX - selectionStart.x);
    const height = Math.abs(event.clientY - selectionStart.y);
    
    selectionRect = { x, y, width, height };
  }
  
  async function handleSelectionMouseUp(event: MouseEvent) {
    if (!isSelecting || !selectionRect) return;
    
    isSelecting = false;
    
    if (selectionRect.width < 10 || selectionRect.height < 10) {
      selectionRect = null;
      return;
    }
    
    await captureSelection(selectionRect);
  }
  
  async function captureSelection(rect: SelectionRect): Promise<Screenshot | null> {
    isCapturing = true;
    
    try {
      const result = await invoke<{ data: number[]; width: number; height: number }>('capture_region', {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
      
      const data = new Uint8Array(result.data);
      const dataUrl = await arrayToDataUrl(data);
      
      const screenshot: Screenshot = {
        id: generateId(),
        data,
        dataUrl,
        width: result.width,
        height: result.height,
        capturedAt: new Date(),
        type: 'selection'
      };
      
      currentScreenshot = screenshot;
      selectionRect = null;
      dispatch('captured', screenshot);
      
      if (showPreview) {
        await renderPreview();
      }
      
      return screenshot;
    } catch (error) {
      console.error('Selection capture failed:', error);
      dispatch('error', error as Error);
      return null;
    } finally {
      isCapturing = false;
    }
  }
  
  async function arrayToDataUrl(data: Uint8Array): Promise<string> {
    const blob = new Blob([data], { type: 'image/png' });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  async function renderPreview() {
    if (!currentScreenshot || !previewCanvas) return;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      // Scale to fit container while maintaining aspect ratio
      const maxWidth = 800;
      const maxHeight = 600;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      
      previewCanvas.width = img.width * scale;
      previewCanvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
      
      // Setup annotation canvas
      if (annotationCanvas && enableAnnotations) {
        annotationCanvas.width = previewCanvas.width;
        annotationCanvas.height = previewCanvas.height;
        annotationCtx = annotationCanvas.getContext('2d');
      }
    };
    img.src = currentScreenshot.dataUrl;
  }
  
  function handleAnnotationMouseDown(event: MouseEvent) {
    if (!enableAnnotations || !annotationCtx) return;
    
    isDrawing = true;
    const rect = annotationCanvas.getBoundingClientRect();
    lastPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    if (currentTool === 'pen') {
      annotationCtx.beginPath();
      annotationCtx.moveTo(lastPoint.x, lastPoint.y);
      annotationCtx.strokeStyle = currentColor;
      annotationCtx.lineWidth = 3;
      annotationCtx.lineCap = 'round';
      annotationCtx.lineJoin = 'round';
    }
  }
  
  function handleAnnotationMouseMove(event: MouseEvent) {
    if (!isDrawing || !annotationCtx || !lastPoint) return;
    
    const rect = annotationCanvas.getBoundingClientRect();
    const currentPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    if (currentTool === 'pen') {
      annotationCtx.lineTo(currentPoint.x, currentPoint.y);
      annotationCtx.stroke();
    }
    
    lastPoint = currentPoint;
  }
  
  function handleAnnotationMouseUp() {
    if (!isDrawing || !annotationCtx) return;
    
    isDrawing = false;
    
    if (currentTool === 'pen') {
      annotationCtx.closePath();
    }
    
    lastPoint = null;
  }
  
  function clearAnnotations() {
    if (!annotationCtx || !annotationCanvas) return;
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  }
  
  export async function saveToFile(): Promise<string | null> {
    if (!currentScreenshot) return null;
    
    try {
      // Merge preview and annotations if present
      let finalData = currentScreenshot.data;
      
      if (annotationCanvas && annotationCtx) {
        const mergedCanvas = document.createElement('canvas');
        const mergedCtx = mergedCanvas.getContext('2d');
        if (mergedCtx && previewCanvas) {
          mergedCanvas.width = previewCanvas.width;
          mergedCanvas.height = previewCanvas.height;
          mergedCtx.drawImage(previewCanvas, 0, 0);
          mergedCtx.drawImage(annotationCanvas, 0, 0);
          
          const blob = await new Promise<Blob | null>(resolve => 
            mergedCanvas.toBlob(resolve, 'image/png')
          );
          if (blob) {
            finalData = new Uint8Array(await blob.arrayBuffer());
          }
        }
      }
      
      const defaultName = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });
      
      if (savePath) {
        await writeFile(savePath, finalData);
        dispatch('saved', savePath);
        return savePath;
      }
      
      return null;
    } catch (error) {
      console.error('Save failed:', error);
      dispatch('error', error as Error);
      return null;
    }
  }
  
  export async function copyToClipboard() {
    if (!currentScreenshot) return;
    
    try {
      await invoke('copy_image_to_clipboard', { imageData: Array.from(currentScreenshot.data) });
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      dispatch('error', error as Error);
    }
  }
  
  export function getScreenshot(): Screenshot | null {
    return currentScreenshot;
  }
  
  export function cancelCapture() {
    isSelecting = false;
    selectionRect = null;
    selectionStart = null;
    currentScreenshot = null;
    dispatch('cancelled');
  }
</script>

{#if isSelecting}
  <div 
    class="selection-overlay"
    on:mousedown={handleSelectionMouseDown}
    on:mousemove={handleSelectionMouseMove}
    on:mouseup={handleSelectionMouseUp}
    role="button"
    tabindex="0"
    aria-label="Click and drag to select area"
  >
    {#if selectionRect && selectionRect.width > 0 && selectionRect.height > 0}
      <div 
        class="selection-rect"
        style="
          left: {selectionRect.x}px;
          top: {selectionRect.y}px;
          width: {selectionRect.width}px;
          height: {selectionRect.height}px;
        "
      >
        <span class="selection-size">
          {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
        </span>
      </div>
    {/if}
    <div class="selection-hint">
      Click and drag to select area • ESC to cancel
    </div>
  </div>
{/if}

<div class="screenshot-capture">
  <div class="capture-controls">
    <button 
      class="capture-btn primary"
      on:click={captureFullscreen}
      disabled={isCapturing}
      title="Capture fullscreen (Ctrl+Shift+S)"
    >
      🖥️ Fullscreen
    </button>
    <button 
      class="capture-btn"
      on:click={captureWindow}
      disabled={isCapturing}
      title="Capture active window"
    >
      🪟 Window
    </button>
    <button 
      class="capture-btn"
      on:click={startAreaSelection}
      disabled={isCapturing}
      title="Select area (Ctrl+Shift+A)"
    >
      ✂️ Select Area
    </button>
  </div>
  
  {#if currentScreenshot && showPreview}
    <div class="preview-container">
      <div class="preview-header">
        <span class="preview-info">
          {currentScreenshot.width} × {currentScreenshot.height} • 
          {currentScreenshot.type} • 
          {currentScreenshot.capturedAt.toLocaleTimeString()}
        </span>
        <div class="preview-actions">
          <button class="action-btn" on:click={copyToClipboard} title="Copy to clipboard">
            📋 Copy
          </button>
          <button class="action-btn" on:click={saveToFile} title="Save to file">
            💾 Save
          </button>
          <button class="action-btn danger" on:click={cancelCapture} title="Discard">
            🗑️ Discard
          </button>
        </div>
      </div>
      
      <div class="preview-canvas-container">
        <canvas bind:this={previewCanvas} class="preview-canvas"></canvas>
        {#if enableAnnotations}
          <canvas 
            bind:this={annotationCanvas} 
            class="annotation-canvas"
            on:mousedown={handleAnnotationMouseDown}
            on:mousemove={handleAnnotationMouseMove}
            on:mouseup={handleAnnotationMouseUp}
            on:mouseleave={handleAnnotationMouseUp}
          ></canvas>
        {/if}
      </div>
      
      {#if enableAnnotations}
        <div class="annotation-tools">
          <div class="tool-group">
            <button 
              class="tool-btn"
              class:active={currentTool === 'pen'}
              on:click={() => currentTool = 'pen'}
              title="Pen"
            >
              ✏️
            </button>
            <button 
              class="tool-btn"
              class:active={currentTool === 'arrow'}
              on:click={() => currentTool = 'arrow'}
              title="Arrow"
            >
              ➡️
            </button>
            <button 
              class="tool-btn"
              class:active={currentTool === 'rectangle'}
              on:click={() => currentTool = 'rectangle'}
              title="Rectangle"
            >
              ⬜
            </button>
            <button 
              class="tool-btn"
              class:active={currentTool === 'blur'}
              on:click={() => currentTool = 'blur'}
              title="Blur"
            >
              🔲
            </button>
          </div>
          
          <div class="color-group">
            {#each ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffffff', '#000000'] as color}
              <button 
                class="color-btn"
                class:active={currentColor === color}
                style="background-color: {color}"
                on:click={() => currentColor = color}
                title={color}
              ></button>
            {/each}
          </div>
          
          <button class="tool-btn" on:click={clearAnnotations} title="Clear annotations">
            🧹 Clear
          </button>
        </div>
      {/if}
    </div>
  {/if}
  
  {#if isCapturing}
    <div class="capturing-indicator">
      <span class="spinner"></span>
      Capturing...
    </div>
  {/if}
</div>

<style>
  .screenshot-capture {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
  }
  
  .capture-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .capture-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .capture-btn:hover:not(:disabled) {
    background: var(--bg-hover, #36393f);
  }
  
  .capture-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .capture-btn.primary {
    background: var(--accent, #5865f2);
    color: white;
  }
  
  .capture-btn.primary:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }
  
  .selection-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    cursor: crosshair;
    z-index: 10000;
  }
  
  .selection-rect {
    position: absolute;
    border: 2px solid var(--accent, #5865f2);
    background: rgba(88, 101, 242, 0.1);
  }
  
  .selection-size {
    position: absolute;
    bottom: -24px;
    left: 0;
    padding: 2px 6px;
    background: var(--accent, #5865f2);
    color: white;
    font-size: 0.75rem;
    border-radius: 2px;
    white-space: nowrap;
  }
  
  .selection-hint {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 0.875rem;
    border-radius: 4px;
  }
  
  .preview-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #2f3136);
    border-bottom: 1px solid var(--border-subtle, #1e2124);
  }
  
  .preview-info {
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }
  
  .preview-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-btn {
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .action-btn:hover {
    background: var(--bg-hover, #36393f);
  }
  
  .action-btn.danger:hover {
    background: var(--danger, #ed4245);
    color: white;
  }
  
  .preview-canvas-container {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 1rem;
  }
  
  .preview-canvas, .annotation-canvas {
    max-width: 100%;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .annotation-canvas {
    position: absolute;
    top: 1rem;
    cursor: crosshair;
  }
  
  .annotation-tools {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border-subtle, #1e2124);
  }
  
  .tool-group, .color-group {
    display: flex;
    gap: 0.25rem;
  }
  
  .tool-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .tool-btn:hover {
    background: var(--bg-hover, #36393f);
  }
  
  .tool-btn.active {
    background: var(--accent, #5865f2);
  }
  
  .color-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.1s;
  }
  
  .color-btn:hover {
    transform: scale(1.1);
  }
  
  .color-btn.active {
    border-color: white;
  }
  
  .capturing-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--text-muted, #72767d);
    font-size: 0.875rem;
  }
  
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: var(--accent, #5865f2);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
