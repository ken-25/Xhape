/**
 * Editor Logic Module
 * handles state and business logic for shapes and tools.
 */
window.Editor = {
    state: {
        currentTool: 'line',
        isDrawing: false,
        shapes: [],
        currentShape: null,
        canvasSize: { width: 100, height: 100 },
        zoom: 5,
        gridSpacing: 10,
        xamlKey: 'Symbol.Custom',
        pathPoints: [],
        selectedShapeIndex: -1,
        isDragging: false,
        dragMode: null, // 'move' or 'resize'
        handleIndex: -1,
        dragStartPos: { x: 0, y: 0 },
        initialShapeState: null,
        isSnapEnabled: true,
        outputFormat: 'StreamGeometry', // 'StreamGeometry', 'PathGeometry', 'Geometry', 'Path', 'SVG'
        coordinateSeparator: ' ', // ' ' or ','
        isCompact: true
    },

    /**
     * Snap coordinate to grid
     */
    snapToGrid(pos) {
        if (!this.state.isSnapEnabled) return pos;
        const step = this.state.gridSpacing;
        return {
            x: Math.round(pos.x / step) * step,
            y: Math.round(pos.y / step) * step
        };
    },

    /**
     * Update shape when resizing
     */
    updateShapeResize(shape, initial, pos, handleIndex) {
        if (shape.type === 'line') {
            if (handleIndex === 0) { shape.x1 = pos.x; shape.y1 = pos.y; }
            else { shape.x2 = pos.x; shape.y2 = pos.y; }
        } else if (shape.type === 'rect') {
            const x2 = initial.x + initial.width;
            const y2 = initial.y + initial.height;
            if (handleIndex === 0) { // TL
                shape.x = Math.min(pos.x, x2 - 1);
                shape.y = Math.min(pos.y, y2 - 1);
                shape.width = x2 - shape.x;
                shape.height = y2 - shape.y;
            } else if (handleIndex === 1) { // TR
                shape.y = Math.min(pos.y, y2 - 1);
                shape.width = Math.max(1, pos.x - initial.x);
                shape.height = y2 - shape.y;
            } else if (handleIndex === 2) { // BR
                shape.width = Math.max(1, pos.x - initial.x);
                shape.height = Math.max(1, pos.y - initial.y);
            } else if (handleIndex === 3) { // BL
                shape.x = Math.min(pos.x, x2 - 1);
                shape.width = x2 - shape.x;
                shape.height = Math.max(1, pos.y - initial.y);
            }
        } else if (shape.type === 'circle') {
            shape.r = Math.max(1, Math.sqrt(Math.pow(pos.x - shape.cx, 2) + Math.pow(pos.y - shape.cy, 2)));
        } else if (shape.type === 'path') {
            shape.points[handleIndex].x = pos.x;
            shape.points[handleIndex].y = pos.y;
        } else if (shape.type === 'arc') {
            const getAngle = (px, py) => Math.atan2(py - shape.cy, px - shape.cx);
            
            if (handleIndex === 0) { // Start Handle
                const ang = getAngle(pos.x, pos.y);
                shape.x1 = shape.cx + shape.rx * Math.cos(ang);
                shape.y1 = shape.cy + shape.rx * Math.sin(ang);
                
                // Update largeArcFlag based on sweep
                const ang2 = getAngle(shape.x2, shape.y2);
                let diff = ang2 - ang;
                if (shape.sweepFlag === 1) { // CW
                    while (diff < 0) diff += 2 * Math.PI;
                    while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
                    shape.largeArcFlag = diff > Math.PI ? 1 : 0;
                } else { // CCW
                    while (diff > 0) diff -= 2 * Math.PI;
                    while (diff < -2 * Math.PI) diff += 2 * Math.PI;
                    shape.largeArcFlag = diff < -Math.PI ? 1 : 0;
                }
            } else if (handleIndex === 1) { // End Handle
                const ang = getAngle(pos.x, pos.y);
                shape.x2 = shape.cx + shape.rx * Math.cos(ang);
                shape.y2 = shape.cy + shape.rx * Math.sin(ang);
                
                // Update largeArcFlag based on sweep
                const ang1 = getAngle(shape.x1, shape.y1);
                let diff = ang - ang1;
                if (shape.sweepFlag === 1) { // CW
                    while (diff < 0) diff += 2 * Math.PI;
                    while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
                    shape.largeArcFlag = diff > Math.PI ? 1 : 0;
                } else { // CCW
                    while (diff > 0) diff -= 2 * Math.PI;
                    while (diff < -2 * Math.PI) diff += 2 * Math.PI;
                    shape.largeArcFlag = diff < -Math.PI ? 1 : 0;
                }
            } else if (handleIndex === 2) { // Radius Handle
                const dist = Math.sqrt(Math.pow(pos.x - shape.cx, 2) + Math.pow(pos.y - shape.cy, 2));
                const oldRx = shape.rx;
                shape.rx = shape.ry = Math.max(1, dist);
                
                if (oldRx > 0) {
                    const ratio = shape.rx / oldRx;
                    shape.x1 = shape.cx + (shape.x1 - shape.cx) * ratio;
                    shape.y1 = shape.cy + (shape.y1 - shape.cy) * ratio;
                    shape.x2 = shape.cx + (shape.x2 - shape.cx) * ratio;
                    shape.y2 = shape.cy + (shape.y2 - shape.cy) * ratio;
                }
            }
        }
    },

    /**
     * Clear all shapes
     */
    clearAll() {
        this.state.shapes = [];
        this.state.pathPoints = [];
        this.state.selectedShapeIndex = -1;
    },

    /**
     * Delete selected shape
     */
    deleteSelected() {
        if (this.state.selectedShapeIndex !== -1) {
            this.state.shapes.splice(this.state.selectedShapeIndex, 1);
            this.state.selectedShapeIndex = -1;
            return true;
        }
        return false;
    }
};
