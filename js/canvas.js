/**
 * Canvas View Module
 * handles SVG rendering, rulers, and grid display.
 */
window.CanvasView = {
    elements: {},

    /**
     * Initialize DOM references
     */
    init(elements) {
        this.elements = elements;
    },

    /**
     * Render all shapes to the shapes layer
     */
    render(shapes, selectedIndex) {
        const layer = this.elements.shapesLayer;
        layer.innerHTML = '';
        shapes.forEach((s, index) => {
            let el;
            if (s.type === 'line') {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                el.setAttribute('x1', s.x1); el.setAttribute('y1', s.y1);
                el.setAttribute('x2', s.x2); el.setAttribute('y2', s.y2);
            } else if (s.type === 'rect') {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                el.setAttribute('x', s.x); el.setAttribute('y', s.y);
                el.setAttribute('width', s.width); el.setAttribute('height', s.height);
            } else if (s.type === 'circle') {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                el.setAttribute('cx', s.cx); el.setAttribute('cy', s.cy);
                el.setAttribute('r', s.r);
            } else if (s.type === 'path') {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${s.points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                el.setAttribute('d', d);
            } else if (s.type === 'arc') {
                el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${s.x1},${s.y1} A ${s.rx},${s.ry} ${s.rotation} ${s.largeArcFlag} ${s.sweepFlag} ${s.x2},${s.y2}`;
                el.setAttribute('d', d);
            }

            if (el) {
                el.dataset.index = index;
                if (index === selectedIndex) {
                    el.classList.add('selected-highlight');
                }
                layer.appendChild(el);
            }
        });

        if (selectedIndex !== -1) {
            this.renderHandles(shapes[selectedIndex]);
        }
    },

    /**
     * Render handles for selection
     */
    renderHandles(shape) {
        const handles = [];
        if (shape.type === 'line') {
            handles.push({ x: shape.x1, y: shape.y1, index: 0 });
            handles.push({ x: shape.x2, y: shape.y2, index: 1 });
        } else if (shape.type === 'rect') {
            handles.push({ x: shape.x, y: shape.y, index: 0 }); // TL
            handles.push({ x: shape.x + shape.width, y: shape.y, index: 1 }); // TR
            handles.push({ x: shape.x + shape.width, y: shape.y + shape.height, index: 2 }); // BR
            handles.push({ x: shape.x, y: shape.y + shape.height, index: 3 }); // BL
        } else if (shape.type === 'circle') {
            handles.push({ x: shape.cx + shape.r, y: shape.cy, index: 0 }); // Right point
        } else if (shape.type === 'path') {
            shape.points.forEach((p, i) => {
                handles.push({ x: p.x, y: p.y, index: i });
            });
        } else if (shape.type === 'arc') {
            handles.push({ x: shape.x1, y: shape.y1, index: 0 });
            handles.push({ x: shape.x2, y: shape.y2, index: 1 });
            
            // スイープ中央ハンドルの計算
            const ang1 = Math.atan2(shape.y1 - shape.cy, shape.x1 - shape.cx);
            const ang2 = Math.atan2(shape.y2 - shape.cy, shape.x2 - shape.cx);
            let diff = ang2 - ang1;
            
            if (shape.sweepFlag === 1) { // CW
                if (diff < 0) diff += 2 * Math.PI;
                if (shape.largeArcFlag === 1 && diff < Math.PI) diff += 2 * Math.PI;
                if (shape.largeArcFlag === 0 && diff > Math.PI) diff -= 2 * Math.PI;
            } else { // CCW
                if (diff > 0) diff -= 2 * Math.PI;
                if (shape.largeArcFlag === 1 && diff > -Math.PI) diff -= 2 * Math.PI;
                if (shape.largeArcFlag === 0 && diff < -Math.PI) diff += 2 * Math.PI;
            }
            
            const midAng = ang1 + diff / 2;
            handles.push({ 
                x: shape.cx + shape.rx * Math.cos(midAng), 
                y: shape.cy + shape.ry * Math.sin(midAng), 
                index: 2 
            });

            // 中心位置のガイドを描画 (+)
            const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const s = 1.0;
            cross.setAttribute('d', `M ${shape.cx - s},${shape.cy} L ${shape.cx + s},${shape.cy} M ${shape.cx},${shape.cy - s} L ${shape.cx},${shape.cy + s}`);
            cross.setAttribute('stroke', 'var(--accent-color)');
            cross.setAttribute('stroke-width', '0.5');
            cross.style.pointerEvents = 'none';
            this.elements.shapesLayer.appendChild(cross);
        }

        handles.forEach(h => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', h.x);
            circle.setAttribute('cy', h.y);
            circle.setAttribute('r', 1.5);
            circle.classList.add('handle');
            circle.dataset.index = h.index;
            this.elements.shapesLayer.appendChild(circle);
        });
    },

    /**
     * Render drawing preview
     */
    renderPreview(currentTool, currentShape, pathPoints, mousePos = null) {
        const layer = this.elements.previewLayer;
        layer.innerHTML = '';
        
        if (currentTool === 'path') {
            if (pathPoints.length === 0) return;
            const points = [...pathPoints];
            if (mousePos) points.push(mousePos);
            
            const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            layer.appendChild(path);
            return;
        }

        if (currentTool === 'arc') {
            if (pathPoints.length === 1 && mousePos) {
                const cx = pathPoints[0].x;
                const cy = pathPoints[0].y;
                const r = Math.sqrt(Math.pow(mousePos.x - cx, 2) + Math.pow(mousePos.y - cy, 2));
                // 仮想的な円を表示
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', cy);
                circle.setAttribute('r', r);
                circle.classList.add('virtual-guide'); // CSSでdashedにする
                layer.appendChild(circle);
                
                // 半径の直線
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', cx); line.setAttribute('y1', cy);
                line.setAttribute('x2', mousePos.x); line.setAttribute('y2', mousePos.y);
                layer.appendChild(line);
            } else if (pathPoints.length === 2 && mousePos) {
                const cx = pathPoints[0].x;
                const cy = pathPoints[0].y;
                const x1 = pathPoints[1].x;
                const y1 = pathPoints[1].y;
                const rx = Math.sqrt(Math.pow(x1 - cx, 2) + Math.pow(y1 - cy, 2));
                
                const ang1 = Math.atan2(y1 - cy, x1 - cx);
                const ang2 = Math.atan2(mousePos.y - cy, mousePos.x - cx);
                let diff = ang2 - ang1;
                while (diff < 0) diff += 2 * Math.PI;
                while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
                const large = diff > Math.PI ? 1 : 0;
                
                const x2 = cx + rx * Math.cos(ang2);
                const y2 = cy + rx * Math.sin(ang2);
                
                const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const d = `M ${x1},${y1} A ${rx},${rx} 0 ${large} 1 ${x2},${y2}`;
                el.setAttribute('d', d);
                layer.appendChild(el);
            }
            return;
        }

        if (!currentShape) return;
        const s = currentShape;
        let el;

        if (s.type === 'line') {
            el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            el.setAttribute('x1', s.x1); el.setAttribute('y1', s.y1);
            el.setAttribute('x2', s.x2); el.setAttribute('y2', s.y2);
        } else if (s.type === 'rect') {
            el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            el.setAttribute('x', s.x); el.setAttribute('y', s.y);
            el.setAttribute('width', s.width); el.setAttribute('height', s.height);
        } else if (s.type === 'circle') {
            el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            el.setAttribute('cx', s.cx); el.setAttribute('cy', s.cy);
            el.setAttribute('r', s.r);
        } else if (s.type === 'arc') {
            el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = `M ${s.x1},${s.y1} A ${s.rx},${s.ry} ${s.rotation} ${s.largeArcFlag} ${s.sweepFlag} ${s.x2},${s.y2}`;
            el.setAttribute('d', d);
        }

        if (el) layer.appendChild(el);
    },

    clearPreview() {
        this.elements.previewLayer.innerHTML = '';
    },

    /**
     * Update zoom and scaling
     */
    updateScaling(canvasSize, zoom) {
        this.elements.svg.style.width = `${canvasSize.width * zoom}px`;
        this.elements.svg.style.height = `${canvasSize.height * zoom}px`;
        this.updateRulers(canvasSize, zoom, 10); // Spacing will be passed from state
    },

    /**
     * Update Grid pattern
     */
    updateGrid(spacing) {
        const pattern = document.getElementById('grid-pattern');
        const circle = pattern?.querySelector('circle');
        if (pattern && circle) {
            const half = spacing / 2;
            pattern.setAttribute('width', spacing);
            pattern.setAttribute('height', spacing);
            pattern.setAttribute('x', -half);
            pattern.setAttribute('y', -half);
            circle.setAttribute('cx', half);
            circle.setAttribute('cy', half);
        }
    },

    /**
     * Update Rulers based on scroll and zoom
     */
    updateRulers(canvasSize, zoom, spacing) {
        const { width, height } = canvasSize;
        const step = spacing;
        
        const container = this.elements.canvasContainer;
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        
        const containerRect = container.getBoundingClientRect();
        const svgRect = this.elements.svg.getBoundingClientRect();
        
        const offsetX = svgRect.left - containerRect.left + scrollLeft;
        const offsetY = svgRect.top - containerRect.top + scrollTop;

        // Update Left Ruler (Y axis)
        const rulerL = this.elements.rulerLeft;
        rulerL.innerHTML = '';
        for (let y = 0; y <= height; y += step) {
            const yPos = y * zoom + offsetY - scrollTop;
            if (yPos < -20 || yPos > containerRect.height + 20) continue;

            const tick = document.createElement('div');
            tick.className = 'tick' + (y % (step * 5) === 0 ? ' major' : '');
            tick.style.top = `${yPos}px`;
            rulerL.appendChild(tick);

            if (y % (step * 5) === 0) {
                const label = document.createElement('div');
                label.className = 'label';
                label.style.top = `${yPos}px`;
                label.textContent = y;
                rulerL.appendChild(label);
            }
        }

        // Update Bottom Ruler (X axis)
        const rulerB = this.elements.rulerBottom;
        rulerB.innerHTML = '';
        for (let x = 0; x <= width; x += step) {
            const xPos = x * zoom + offsetX - scrollLeft;
            if (xPos < -20 || xPos > containerRect.width + 20) continue;

            const tick = document.createElement('div');
            tick.className = 'tick' + (x % (step * 5) === 0 ? ' major' : '');
            tick.style.left = `${xPos}px`;
            rulerB.appendChild(tick);

            if (x % (step * 5) === 0) {
                const label = document.createElement('div');
                label.className = 'label';
                label.style.left = `${xPos}px`;
                label.textContent = x;
                rulerB.appendChild(label);
            }
        }
    }
};
