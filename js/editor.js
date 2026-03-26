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
        outputFormat: 'StreamGeometry' // 'StreamGeometry', 'PathGeometry', 'Geometry', 'Path'
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
