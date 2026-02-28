<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable } from 'svelte/store';

  // Screenshot state
  interface ScreenshotState {
    imageData: string | null;
    isCapturing: boolean;
    captureMode: 'fullscreen' | 'window' | 'region';
    selectedRegion: { x: number; y: number; width: number; height: number } | null;
  }

  const screenshotState = writable<ScreenshotState>({
    imageData: null,
    isCapturing: false,
    captureMode: 'fullscreen',
    selectedRegion: null
  });

  // Annotation tools
  type ToolType = 'select' | 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'blur' | 'crop';

  interface AnnotationSettings {
    tool: ToolType;
    color: string;
    strokeWidth: number;
    fontSize: number;
    opacity: number;
  }

  const annotationSettings = writable<AnnotationSettings>({
    tool: 'select',
    color: '#ef4444',
    strokeWidth: 3,
    fontSize: 16,
    opacity: 1
  });

  // Annotation history for undo/redo
  interface Annotation {
    id: string;
    type: ToolType;
    data: any;
  }

  let annotations: Annotation[] = [];
  let undoStack: Annotation[][] = [];
  let redoStack: Annotation[][] = [];

  // Canvas references
  let canvasContainer: HTMLDivElement;
  let imageCanvas: HTMLCanvasElement;
  let annotationCanvas: HTMLCanvasElement;
  let imageCtx: CanvasRenderingContext2D | null = null;
  let annotationCtx: CanvasRenderingContext2D | null = null;

  // Drawing state
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let currentPath: { x: number; y: number }[] = [];

  // Text input
  let textInput = '';
  let textPosition: { x: number; y: number } | null = null;
  let showTextInput = false;

  // UI state
  let showToolbar = true;
  let showColorPicker = false;
  let isFullscreen = false;
  export let visible = false;

  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ffffff', '#000000'
  ];

  const tools: { type: ToolType; icon: string; label: string }[] = [
    { type: 'select', icon: 'cursor', label: 'Select' },
    { type: 'pen', icon: 'pen', label: 'Pen' },
    { type: 'highlighter', icon: 'highlighter', label: 'Highlighter' },
    { type: 'arrow', icon: 'arrow', label: 'Arrow' },
    { type: 'rectangle', icon: 'square', label: 'Rectangle' },
    { type: 'ellipse', icon: 'circle', label: 'Ellipse' },
    { type: 'text', icon: 'text', label: 'Text' },
    { type: 'blur', icon: 'blur', label: 'Blur' },
    { type: 'crop', icon: 'crop', label: 'Crop' }
  ];

  // Capture screenshot
  export async function captureScreenshot(mode: 'fullscreen' | 'window' | 'region' = 'fullscreen') {
    screenshotState.update(s => ({ ...s, isCapturing: true, captureMode: mode }));

    try {
      let imageData: string;

      if (mode === 'region') {
        // Show region selector
        imageData = await invoke<string>('capture_region_screenshot');
      } else if (mode === 'window') {
        imageData = await invoke<string>('capture_window_screenshot');
      } else {
        imageData = await invoke<string>('capture_fullscreen_screenshot');
      }

      screenshotState.update(s => ({
        ...s,
        imageData,
        isCapturing: false
      }));

      visible = true;
      loadImageToCanvas(imageData);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      screenshotState.update(s => ({ ...s, isCapturing: false }));
    }
  }

  // Load image to canvas
  function loadImageToCanvas(dataUrl: string) {
    const img = new Image();
    img.onload = () => {
      if (!imageCanvas || !annotationCanvas) return;

      // Set canvas dimensions
      imageCanvas.width = img.width;
      imageCanvas.height = img.height;
      annotationCanvas.width = img.width;
      annotationCanvas.height = img.height;

      // Draw image
      imageCtx = imageCanvas.getContext('2d');
      annotationCtx = annotationCanvas.getContext('2d');

      if (imageCtx) {
        imageCtx.drawImage(img, 0, 0);
      }

      // Clear annotations
      annotations = [];
      undoStack = [];
      redoStack = [];
    };
    img.src = dataUrl;
  }

  // Drawing handlers
  function handleMouseDown(e: MouseEvent) {
    if ($annotationSettings.tool === 'select') return;
    
    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    
    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;
    isDrawing = true;
    currentPath = [{ x: startX, y: startY }];

    if ($annotationSettings.tool === 'text') {
      textPosition = { x: startX, y: startY };
      showTextInput = true;
      isDrawing = false;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing || !annotationCtx) return;

    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    // Clear and redraw all annotations
    redrawAnnotations();

    // Draw current shape preview
    const { tool, color, strokeWidth, opacity } = $annotationSettings;
    annotationCtx.strokeStyle = color;
    annotationCtx.fillStyle = color;
    annotationCtx.lineWidth = strokeWidth;
    annotationCtx.globalAlpha = tool === 'highlighter' ? 0.3 : opacity;
    annotationCtx.lineCap = 'round';
    annotationCtx.lineJoin = 'round';

    switch (tool) {
      case 'pen':
      case 'highlighter':
        currentPath.push({ x: currentX, y: currentY });
        drawPath(annotationCtx, currentPath);
        break;

      case 'arrow':
        drawArrow(annotationCtx, startX, startY, currentX, currentY);
        break;

      case 'rectangle':
        annotationCtx.strokeRect(
          startX, startY,
          currentX - startX, currentY - startY
        );
        break;

      case 'ellipse':
        drawEllipse(annotationCtx, startX, startY, currentX, currentY);
        break;

      case 'blur':
        // Preview blur region
        annotationCtx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        annotationCtx.fillRect(
          startX, startY,
          currentX - startX, currentY - startY
        );
        break;

      case 'crop':
        // Preview crop region
        annotationCtx.strokeStyle = '#fff';
        annotationCtx.setLineDash([5, 5]);
        annotationCtx.strokeRect(
          startX, startY,
          currentX - startX, currentY - startY
        );
        annotationCtx.setLineDash([]);
        break;
    }

    annotationCtx.globalAlpha = 1;
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isDrawing || !annotationCtx) return;

    const rect = annotationCanvas.getBoundingClientRect();
    const scaleX = annotationCanvas.width / rect.width;
    const scaleY = annotationCanvas.height / rect.height;
    
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;

    const { tool, color, strokeWidth, opacity } = $annotationSettings;

    // Save to undo stack
    undoStack.push([...annotations]);
    redoStack = [];

    // Create annotation
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      type: tool,
      data: {
        color,
        strokeWidth,
        opacity: tool === 'highlighter' ? 0.3 : opacity,
        startX,
        startY,
        endX,
        endY,
        path: tool === 'pen' || tool === 'highlighter' ? [...currentPath, { x: endX, y: endY }] : undefined
      }
    };

    // Handle special tools
    if (tool === 'blur') {
      applyBlur(startX, startY, endX - startX, endY - startY);
    } else if (tool === 'crop') {
      applyCrop(startX, startY, endX - startX, endY - startY);
    } else {
      annotations.push(annotation);
    }

    isDrawing = false;
    currentPath = [];
    redrawAnnotations();
  }

  // Drawing helpers
  function drawPath(ctx: CanvasRenderingContext2D, path: { x: number; y: number }[]) {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
  }

  function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  }

  function drawEllipse(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function redrawAnnotations() {
    if (!annotationCtx || !annotationCanvas) return;
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    for (const annotation of annotations) {
      const { data } = annotation;
      annotationCtx.strokeStyle = data.color;
      annotationCtx.fillStyle = data.color;
      annotationCtx.lineWidth = data.strokeWidth;
      annotationCtx.globalAlpha = data.opacity;
      annotationCtx.lineCap = 'round';
      annotationCtx.lineJoin = 'round';

      switch (annotation.type) {
        case 'pen':
        case 'highlighter':
          if (data.path) drawPath(annotationCtx, data.path);
          break;
        case 'arrow':
          drawArrow(annotationCtx, data.startX, data.startY, data.endX, data.endY);
          break;
        case 'rectangle':
          annotationCtx.strokeRect(
            data.startX, data.startY,
            data.endX - data.startX, data.endY - data.startY
          );
          break;
        case 'ellipse':
          drawEllipse(annotationCtx, data.startX, data.startY, data.endX, data.endY);
          break;
        case 'text':
          annotationCtx.font = `${data.fontSize}px sans-serif`;
          annotationCtx.fillText(data.text, data.startX, data.startY);
          break;
      }
    }

    annotationCtx.globalAlpha = 1;
  }

  // Apply blur effect
  function applyBlur(x: number, y: number, width: number, height: number) {
    if (!imageCtx || !imageCanvas) return;

    const imageData = imageCtx.getImageData(x, y, width, height);
    const blurred = gaussianBlur(imageData, 10);
    imageCtx.putImageData(blurred, x, y);
  }

  // Simple box blur
  function gaussianBlur(imageData: ImageData, radius: number): ImageData {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const result = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        result[idx] = r / count;
        result[idx + 1] = g / count;
        result[idx + 2] = b / count;
      }
    }

    return new ImageData(result, width, height);
  }

  // Apply crop
  function applyCrop(x: number, y: number, width: number, height: number) {
    if (!imageCtx || !imageCanvas || !annotationCanvas) return;

    const croppedData = imageCtx.getImageData(
      Math.min(x, x + width),
      Math.min(y, y + height),
      Math.abs(width),
      Math.abs(height)
    );

    imageCanvas.width = Math.abs(width);
    imageCanvas.height = Math.abs(height);
    annotationCanvas.width = Math.abs(width);
    annotationCanvas.height = Math.abs(height);

    imageCtx.putImageData(croppedData, 0, 0);
    annotations = [];
  }

  // Add text annotation
  function addTextAnnotation() {
    if (!textPosition || !textInput.trim()) return;

    undoStack.push([...annotations]);
    redoStack = [];

    annotations.push({
      id: crypto.randomUUID(),
      type: 'text',
      data: {
        color: $annotationSettings.color,
        fontSize: $annotationSettings.fontSize,
        startX: textPosition.x,
        startY: textPosition.y,
        text: textInput
      }
    });

    textInput = '';
    textPosition = null;
    showTextInput = false;
    redrawAnnotations();
  }

  // Undo/Redo
  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push([...annotations]);
    annotations = undoStack.pop() || [];
    redrawAnnotations();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push([...annotations]);
    annotations = redoStack.pop() || [];
    redrawAnnotations();
  }

  // Save/Copy
  async function saveScreenshot() {
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = imageCanvas.width;
    mergedCanvas.height = imageCanvas.height;
    const ctx = mergedCanvas.getContext('2d')!;

    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(annotationCanvas, 0, 0);

    const dataUrl = mergedCanvas.toDataURL('image/png');
    
    try {
      await invoke('save_screenshot', { dataUrl });
    } catch (error) {
      console.error('Failed to save screenshot:', error);
    }
  }

  async function copyToClipboard() {
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = imageCanvas.width;
    mergedCanvas.height = imageCanvas.height;
    const ctx = mergedCanvas.getContext('2d')!;

    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(annotationCanvas, 0, 0);

    try {
      const blob = await new Promise<Blob>((resolve) => {
        mergedCanvas.toBlob((b) => resolve(b!), 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  // Close editor
  function close() {
    visible = false;
    screenshotState.update(s => ({ ...s, imageData: null }));
    annotations = [];
    undoStack = [];
    redoStack = [];
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (!visible) return;

    if (e.key === 'Escape') {
      if (showTextInput) {
        showTextInput = false;
        textInput = '';
      } else {
        close();
      }
    } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      e.preventDefault();
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      saveScreenshot();
      e.preventDefault();
    } else if (e.key === 'c' && (e.metaKey || e.ctrlKey) && !showTextInput) {
      copyToClipboard();
      e.preventDefault();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if visible}
  <div class="screenshot-editor" class:fullscreen={isFullscreen}>
    <!-- Toolbar -->
    {#if showToolbar}
      <div class="toolbar">
        <div class="tool-group">
          {#each tools as tool}
            <button
              class="tool-btn"
              class:active={$annotationSettings.tool === tool.type}
              on:click={() => annotationSettings.update(s => ({ ...s, tool: tool.type }))}
              title={tool.label}
            >
              {#if tool.type === 'select'}
                <svg viewBox="0 0 24 24"><path d="M4 4l16 8-6 2-2 6z" fill="currentColor"/></svg>
              {:else if tool.type === 'pen'}
                <svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'highlighter'}
                <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="8" rx="1" fill="currentColor" opacity="0.4"/><path d="M8 6h8" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'arrow'}
                <svg viewBox="0 0 24 24"><path d="M5 19L19 5M19 5v8M19 5h-8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'rectangle'}
                <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'ellipse'}
                <svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'text'}
                <svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v14" fill="none" stroke="currentColor" stroke-width="2"/></svg>
              {:else if tool.type === 'blur'}
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/></svg>
              {:else if tool.type === 'crop'}
                <svg viewBox="0 0 24 24"><path d="M6 2v4H2v2h4v10h10v4h2v-4h4v-2H8V6h10v6h2V4H6z" fill="currentColor"/></svg>
              {/if}
            </button>
          {/each}
        </div>

        <div class="separator"/>

        <!-- Color picker -->
        <div class="color-picker-container">
          <button
            class="color-btn"
            style="background-color: {$annotationSettings.color}"
            on:click={() => showColorPicker = !showColorPicker}
          />
          {#if showColorPicker}
            <div class="color-picker">
              {#each colors as color}
                <button
                  class="color-swatch"
                  style="background-color: {color}"
                  class:active={$annotationSettings.color === color}
                  on:click={() => {
                    annotationSettings.update(s => ({ ...s, color }));
                    showColorPicker = false;
                  }}
                />
              {/each}
            </div>
          {/if}
        </div>

        <!-- Stroke width -->
        <input
          type="range"
          min="1"
          max="20"
          value={$annotationSettings.strokeWidth}
          on:input={(e) => annotationSettings.update(s => ({ ...s, strokeWidth: parseInt(e.currentTarget.value) }))}
          class="stroke-slider"
          title="Stroke width"
        />

        <div class="separator"/>

        <!-- Undo/Redo -->
        <button class="tool-btn" on:click={undo} disabled={undoStack.length === 0} title="Undo">
          <svg viewBox="0 0 24 24"><path d="M3 10h7v7" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(45 8 13)"/><path d="M9 4C5 4 2 7 2 11s3 7 7 7h9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
        <button class="tool-btn" on:click={redo} disabled={redoStack.length === 0} title="Redo">
          <svg viewBox="0 0 24 24"><path d="M21 10h-7v7" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-45 17 13)"/><path d="M15 4c4 0 7 3 7 7s-3 7-7 7H6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>

        <div class="spacer"/>

        <!-- Actions -->
        <button class="action-btn" on:click={copyToClipboard} title="Copy to clipboard">
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          Copy
        </button>
        <button class="action-btn primary" on:click={saveScreenshot} title="Save">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          Save
        </button>
        <button class="close-btn" on:click={close} title="Close">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>
      </div>
    {/if}

    <!-- Canvas Container -->
    <div
      class="canvas-container"
      bind:this={canvasContainer}
      on:mousedown={handleMouseDown}
      on:mousemove={handleMouseMove}
      on:mouseup={handleMouseUp}
      on:mouseleave={handleMouseUp}
    >
      <canvas bind:this={imageCanvas} class="image-canvas"/>
      <canvas bind:this={annotationCanvas} class="annotation-canvas"/>

      <!-- Text input overlay -->
      {#if showTextInput && textPosition}
        <div
          class="text-input-overlay"
          style="left: {textPosition.x}px; top: {textPosition.y}px"
        >
          <input
            type="text"
            bind:value={textInput}
            on:keydown={(e) => {
              if (e.key === 'Enter') addTextAnnotation();
              if (e.key === 'Escape') {
                showTextInput = false;
                textInput = '';
              }
            }}
            style="color: {$annotationSettings.color}; font-size: {$annotationSettings.fontSize}px"
            placeholder="Type text..."
            autofocus
          />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .screenshot-editor {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.95);
  }

  .screenshot-editor.fullscreen {
    background: #000;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--bg-secondary, #2d2d2d);
    border-bottom: 1px solid var(--border-color, #3d3d3d);
  }

  .tool-group {
    display: flex;
    gap: 4px;
  }

  .tool-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #999);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .tool-btn:hover {
    background: var(--bg-tertiary, #3d3d3d);
    color: var(--text-primary, #fff);
  }

  .tool-btn.active {
    background: var(--accent-color, #5865f2);
    color: white;
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tool-btn svg {
    width: 18px;
    height: 18px;
  }

  .separator {
    width: 1px;
    height: 24px;
    background: var(--border-color, #3d3d3d);
    margin: 0 4px;
  }

  .color-picker-container {
    position: relative;
  }

  .color-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid var(--border-color, #3d3d3d);
    cursor: pointer;
  }

  .color-picker {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    padding: 8px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 8px;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    z-index: 100;
  }

  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .color-swatch.active {
    border-color: white;
  }

  .stroke-slider {
    width: 80px;
    accent-color: var(--accent-color, #5865f2);
  }

  .spacer {
    flex: 1;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    background: var(--bg-tertiary, #3d3d3d);
    color: var(--text-primary, #fff);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-quaternary, #4d4d4d);
  }

  .action-btn.primary {
    background: var(--accent-color, #5865f2);
  }

  .action-btn.primary:hover {
    background: var(--accent-hover, #4752c4);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #999);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .canvas-container {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .image-canvas, .annotation-canvas {
    position: absolute;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .annotation-canvas {
    pointer-events: auto;
  }

  .text-input-overlay {
    position: absolute;
    z-index: 10;
  }

  .text-input-overlay input {
    background: transparent;
    border: none;
    outline: none;
    font-family: sans-serif;
    min-width: 100px;
  }

  .text-input-overlay input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
</style>
</script>
