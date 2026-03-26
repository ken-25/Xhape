/**
 * SVG図形データをXAML Geometry文字列に変換する
 */
const Generator = {
    /**
     * 図形リストからXAMLコードを生成する
     * @param {Array} shapes 図形リスト
     * @param {string} key x:Keyの値
     * @returns {string} XAML文字列
     */
    generate(shapes, key = "Symbol.Custom") {
        const pathData = shapes
            .map(shape => this.shapeToPathData(shape))
            .filter(data => data) // nullを除外
            .join("\n    ");

        return `<Geometry x:Key="${key}">
    ${pathData}
</Geometry>`;
    },

    /**
     * 個別の図形をSVGパスデータ形式に変換
     * @param {Object} shape 
     * @returns {string}
     */
    shapeToPathData(shape) {
        switch (shape.type) {
            case 'line':
                return `M ${this.fmt(shape.x1)},${this.fmt(shape.y1)} L ${this.fmt(shape.x2)},${this.fmt(shape.y2)}`;
            
            case 'rect':
                const x2 = shape.x + shape.width;
                const y2 = shape.y + shape.height;
                return `M ${this.fmt(shape.x)},${this.fmt(shape.y)} L ${this.fmt(x2)},${this.fmt(shape.y)} L ${this.fmt(x2)},${this.fmt(y2)} L ${this.fmt(shape.x)},${this.fmt(y2)} Z`;
            
            case 'circle':
                // 円を2つの円弧(A)コマンドで表現 (WPF/XAML互換)
                const r = shape.r;
                if (r <= 0) return null;
                const cx = shape.cx;
                const cy = shape.cy;
                return `M ${this.fmt(cx - r)},${this.fmt(cy)} A ${this.fmt(r)},${this.fmt(r)} 0 1 1 ${this.fmt(cx + r)},${this.fmt(cy)} A ${this.fmt(r)},${this.fmt(r)} 0 1 1 ${this.fmt(cx - r)},${this.fmt(cy)} Z`;
            
            case 'path':
                if (shape.points.length < 2) return null;
                const points = shape.points.map(p => `${this.fmt(p.x)},${this.fmt(p.y)}`);
                return `M ${points[0]} L ${points.slice(1).join(" ")}`;

            default:
                return "";
        }
    },

    /**
     * 数値を丸める (小数点2位まで)
     */
    fmt(num) {
        return Math.round(num * 100) / 100;
    }
};
