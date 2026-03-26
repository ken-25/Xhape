/**
 * Xhape Main Application (Controller)
 * Coordinating Editor (Logic) and CanvasView (UI).
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        canvasContainer: document.getElementById('canvas-container'),
        svg: document.getElementById('drawing-svg'),
        shapesLayer: document.getElementById('shapes-layer'),
        previewLayer: document.getElementById('preview-layer'),
        gridLayer: document.getElementById('grid-layer'),
        xamlInput: document.getElementById('xaml-input'),
        xamlKeyInput: document.getElementById('xaml-key'),
        widthInput: document.getElementById('canvas-width'),
        heightInput: document.getElementById('canvas-height'),
        gridSpacingInput: document.getElementById('grid-spacing'),
        canvasSizeLabel: document.getElementById('canvas-size-label'),
        rulerLeft: document.getElementById('ruler-left'),
        rulerBottom: document.getElementById('ruler-bottom'),
        toolBtns: document.querySelectorAll('.tool-btn:not(#snap-toggle)'),
        snapToggle: document.getElementById('snap-toggle'),
        clearBtn: document.getElementById('clear-btn'),
        copyBtn: document.getElementById('copy-btn'),
        xamlFormatInput: document.getElementById('xaml-format')
    };

    const state = Editor.state;

    // --- Initialization ---
    function init() {
        CanvasView.init(elements);
        updateAll();
        attachEventListeners();
    }

    let isInternalUpdate = false;

    function updateAll() {
        CanvasView.updateScaling(state.canvasSize, state.zoom);
        CanvasView.updateGrid(state.gridSpacing);
        CanvasView.render(state.shapes, state.selectedShapeIndex);
        syncEditorFromCanvas();
    }

    function syncEditorFromCanvas() {
        if (isInternalUpdate) return;
        isInternalUpdate = true;
        const xaml = Generator.generate(state.shapes, state.xamlKey, state.outputFormat);
        elements.xamlInput.value = xaml;
        isInternalUpdate = false;
    }

    function syncCanvasFromEditor() {
        if (isInternalUpdate) return;
        isInternalUpdate = true;
        const xaml = elements.xamlInput.value;
        const { shapes, key, format } = Parser.parse(xaml);
        state.shapes = shapes;
        if (key) {
            state.xamlKey = key;
            elements.xamlKeyInput.value = key;
        }
        if (format) {
            state.outputFormat = format;
            elements.xamlFormatInput.value = format;
        }
        CanvasView.render(state.shapes, state.selectedShapeIndex);
        isInternalUpdate = false;
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        // SVG Mouse Events
        elements.svg.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        elements.svg.addEventListener('dblclick', handleDblClick);

        // Zoom (Mouse Wheel)
        elements.canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            state.zoom = Math.max(0.1, Math.min(20, state.zoom + delta * zoomSpeed * state.zoom));
            CanvasView.updateScaling(state.canvasSize, state.zoom);
        }, { passive: false });

        // Tool Switching
        elements.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentTool = btn.dataset.tool;
                state.pathPoints = [];
                state.selectedShapeIndex = -1;
                CanvasView.clearPreview();
                if (state.currentTool === 'select') {
                    elements.svg.classList.add('select-mode');
                } else {
                    elements.svg.classList.remove('select-mode');
                }
                CanvasView.render(state.shapes, state.selectedShapeIndex);
            });
        });

        // XAML Input Sync
        elements.xamlInput.addEventListener('input', () => {
            syncCanvasFromEditor();
        });

        // Tab and Enter key support in textarea
        elements.xamlInput.addEventListener('keydown', (e) => {
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Tab key: Insert 4 spaces
            if (e.key === 'Tab') {
                e.preventDefault();
                const value = textarea.value;
                textarea.value = value.substring(0, start) + "    " + value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }

            // Enter key: Maintain indentation
            if (e.key === 'Enter') {
                const value = textarea.value;
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const currentLine = value.substring(lineStart, start);
                const indentMatch = currentLine.match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : "";
                
                // If it's a tag closure situation, we might want even smarter indent, 
                // but basic inheritance is already a huge win.
                if (indent.length > 0) {
                    e.preventDefault();
                    textarea.value = value.substring(0, start) + "\n" + indent + value.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
                    // Trigger input event to sync
                    textarea.dispatchEvent(new Event('input'));
                }
            }
        });

        // Auto-format on paste
        elements.xamlInput.addEventListener('paste', (e) => {
            // Briefly wait for paste to finish, then trigger sync/format
            setTimeout(() => {
                syncCanvasFromEditor();
                // After syncing canvas, sync back to editor to apply formatting
                syncEditorFromCanvas();
            }, 0);
        });

        // Key/Size Inputs
        elements.xamlKeyInput.addEventListener('input', (e) => {
            state.xamlKey = e.target.value;
            syncEditorFromCanvas();
        });

        elements.xamlFormatInput.addEventListener('change', (e) => {
            state.outputFormat = e.target.value;
            syncEditorFromCanvas();
        });

        const handleSizeChange = () => {
            state.canvasSize.width = parseInt(elements.widthInput.value) || 100;
            state.canvasSize.height = parseInt(elements.heightInput.value) || 100;
            elements.svg.setAttribute('viewBox', `0 0 ${state.canvasSize.width} ${state.canvasSize.height}`);
            elements.canvasSizeLabel.textContent = `${state.canvasSize.width} x ${state.canvasSize.height}`;
            CanvasView.updateScaling(state.canvasSize, state.zoom);
            CanvasView.updateGrid(state.gridSpacing);
        };

        elements.widthInput.addEventListener('input', handleSizeChange);
        elements.heightInput.addEventListener('input', handleSizeChange);
        elements.gridSpacingInput.addEventListener('input', (e) => {
            state.gridSpacing = parseInt(e.target.value) || 10;
            CanvasView.updateGrid(state.gridSpacing);
            CanvasView.updateRulers(state.canvasSize, state.zoom, state.gridSpacing);
        });

        // Sync Rulers on Scroll
        elements.canvasContainer.addEventListener('scroll', () => {
            CanvasView.updateRulers(state.canvasSize, state.zoom, state.gridSpacing);
        });

        // Action Buttons
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', () => {
                Editor.clearAll();
                CanvasView.render(state.shapes, state.selectedShapeIndex);
                syncEditorFromCanvas();
            });
        }

        if (elements.snapToggle) {
            elements.snapToggle.addEventListener('click', () => {
                state.isSnapEnabled = !state.isSnapEnabled;
                elements.snapToggle.classList.toggle('active', state.isSnapEnabled);
            });
        }

        elements.copyBtn.addEventListener('click', () => {
            const code = elements.xamlInput.value;
            navigator.clipboard.writeText(code).then(() => {
                const originalText = elements.copyBtn.innerHTML;
                elements.copyBtn.innerHTML = 'Copied!';
                setTimeout(() => { elements.copyBtn.innerHTML = originalText; }, 2000);
            });
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch (e.key.toLowerCase()) {
                case 'l': selectTool('line'); break;
                case 'r': selectTool('rect'); break;
                case 'c': selectTool('circle'); break;
                case 'p': selectTool('path'); break;
                case 's': selectTool('select'); break;
                case 'g': if (elements.snapToggle) elements.snapToggle.click(); break;
                case 'escape': 
                    state.isDrawing = false; 
                    state.isDragging = false;
                    state.selectedShapeIndex = -1;
                    state.pathPoints = [];
                    CanvasView.clearPreview(); 
                    CanvasView.render(state.shapes, state.selectedShapeIndex);
                    break;
                case 'delete':
                case 'backspace':
                    if (Editor.deleteSelected()) {
                        CanvasView.render(state.shapes, state.selectedShapeIndex);
                        syncEditorFromCanvas();
                    }
                    break;
            }
        });

        window.addEventListener('resize', () => {
            CanvasView.updateRulers(state.canvasSize, state.zoom, state.gridSpacing);
        });
    }

    function selectTool(toolName) {
        const btn = Array.from(elements.toolBtns).find(b => b.dataset.tool === toolName);
        if (btn) btn.click();
    }

    // --- Interaction Handlers ---
    function getMousePos(e) {
        const CTM = elements.svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        const pos = {
            x: (e.clientX - CTM.e) / CTM.a,
            y: (e.clientY - CTM.f) / CTM.d
        };
        return Editor.snapToGrid(pos);
    }

    function handleMouseDown(e) {
        if (e.button !== 0) return;
        const pos = getMousePos(e);

        if (state.currentTool === 'select') {
            const handle = e.target.closest('.handle');
            if (handle) {
                state.isDragging = true;
                state.dragMode = 'resize';
                state.handleIndex = parseInt(handle.dataset.index);
                state.dragStartPos = pos;
                state.initialShapeState = JSON.parse(JSON.stringify(state.shapes[state.selectedShapeIndex]));
                return;
            }

            const shapeEl = e.target.closest('#shapes-layer > *');
            if (shapeEl) {
                state.selectedShapeIndex = parseInt(shapeEl.dataset.index);
                state.isDragging = true;
                state.dragMode = 'move';
                state.dragStartPos = pos;
                state.initialShapeState = JSON.parse(JSON.stringify(state.shapes[state.selectedShapeIndex]));
                CanvasView.render(state.shapes, state.selectedShapeIndex);
                return;
            }

            state.selectedShapeIndex = -1;
            CanvasView.render(state.shapes, state.selectedShapeIndex);
            return;
        }

        if (state.currentTool === 'path') {
            if (e.detail > 1) return;
            let snappedPos = { ...pos };
            if (e.shiftKey && state.pathPoints.length > 0) {
                const last = state.pathPoints[state.pathPoints.length - 1];
                if (Math.abs(pos.x - last.x) > Math.abs(pos.y - last.y)) snappedPos.y = last.y;
                else snappedPos.x = last.x;
            }
            state.pathPoints.push(snappedPos);
            CanvasView.renderPreview(state.currentTool, state.currentShape, state.pathPoints);
            return;
        }

        state.isDrawing = true;
        state.currentShape = {
            type: state.currentTool,
            startX: pos.x, startY: pos.y,
            x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
            x: pos.x, y: pos.y, width: 0, height: 0,
            cx: pos.x, cy: pos.y, r: 0
        };
    }

    function handleMouseMove(e) {
        const pos = getMousePos(e);

        if (state.isDragging && state.currentTool === 'select') {
            const dx = pos.x - state.dragStartPos.x;
            const dy = pos.y - state.dragStartPos.y;
            const shape = state.shapes[state.selectedShapeIndex];
            const initial = state.initialShapeState;

            if (state.dragMode === 'move') {
                if (shape.type === 'line') {
                    shape.x1 = initial.x1 + dx; shape.y1 = initial.y1 + dy;
                    shape.x2 = initial.x2 + dx; shape.y2 = initial.y2 + dy;
                } else if (shape.type === 'rect') {
                    shape.x = initial.x + dx; shape.y = initial.y + dy;
                } else if (shape.type === 'circle') {
                    shape.cx = initial.cx + dx; shape.cy = initial.cy + dy;
                } else if (shape.type === 'path') {
                    shape.points = initial.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                }
            } else if (state.dragMode === 'resize') {
                let snappedPos = { ...pos };
                if (e.shiftKey) {
                    if (shape.type === 'line') {
                        const base = (state.handleIndex === 0) ? { x: initial.x2, y: initial.y2 } : { x: initial.x1, y: initial.y1 };
                        if (Math.abs(pos.x - base.x) > Math.abs(pos.y - base.y)) snappedPos.y = base.y; else snappedPos.x = base.x;
                    } else if (shape.type === 'path') {
                        const base = initial.points[state.handleIndex - 1] || initial.points[state.handleIndex + 1];
                        if (base && Math.abs(pos.x - base.x) > Math.abs(pos.y - base.y)) snappedPos.y = base.y; else if (base) snappedPos.x = base.x;
                    }
                }
                Editor.updateShapeResize(shape, initial, snappedPos, state.handleIndex);
            }
            CanvasView.render(state.shapes, state.selectedShapeIndex);
            syncEditorFromCanvas();
            return;
        }

        if (state.currentTool === 'path' && state.pathPoints.length > 0) {
            let mPos = { ...pos };
            if (e.shiftKey) {
                const last = state.pathPoints[state.pathPoints.length - 1];
                if (Math.abs(pos.x - last.x) > Math.abs(pos.y - last.y)) mPos.y = last.y; else mPos.x = last.x;
            }
            CanvasView.renderPreview(state.currentTool, state.currentShape, state.pathPoints, mPos);
            return;
        }

        if (!state.isDrawing) return;
        const s = state.currentShape;
        let mPos = { ...pos };
        if (e.shiftKey && s.type === 'line') {
            if (Math.abs(pos.x - s.startX) > Math.abs(pos.y - s.startY)) mPos.y = s.startY; else mPos.x = s.startX;
        }

        switch (s.type) {
            case 'line': s.x2 = mPos.x; s.y2 = mPos.y; break;
            case 'rect':
                s.x = Math.min(mPos.x, s.startX); s.y = Math.min(mPos.y, s.startY);
                s.width = Math.abs(mPos.x - s.startX); s.height = Math.abs(mPos.y - s.startY);
                break;
            case 'circle': s.r = Math.sqrt(Math.pow(mPos.x - s.cx, 2) + Math.pow(mPos.y - s.cy, 2)); break;
        }
        CanvasView.renderPreview(state.currentTool, state.currentShape, state.pathPoints);
    }

    function handleMouseUp() {
        if (state.isDragging) { state.isDragging = false; state.dragMode = null; return; }
        if (!state.isDrawing) return;
        state.isDrawing = false;
        const s = state.currentShape;
        if ((s.type === 'rect' && s.width < 1) || (s.type === 'circle' && s.r < 1) || 
            (s.type === 'line' && Math.abs(s.x1 - s.x2) < 1 && Math.abs(s.y1 - s.y2) < 1)) return;

        state.shapes.push({ ...state.currentShape });
        state.currentShape = null;
        CanvasView.clearPreview();
        CanvasView.render(state.shapes, state.selectedShapeIndex);
        syncEditorFromCanvas();
    }

    function handleDblClick() {
        if (state.currentTool === 'path' && state.pathPoints.length > 1) {
            state.shapes.push({ type: 'path', points: [...state.pathPoints] });
            state.pathPoints = [];
            CanvasView.clearPreview();
            CanvasView.render(state.shapes, state.selectedShapeIndex);
            syncEditorFromCanvas();
        }
    }

    init();
});
