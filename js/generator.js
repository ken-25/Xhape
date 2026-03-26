/**
 * SVG図形データをXAML Geometry文字列に変換する
 */
const Generator = {
    /**
     * 図形リストからXAMLコードを生成する
     * @param {Array} shapes 図形リスト
     * @param {string} key x:Keyの値
     * @param {string} format 出力フォーマット ('StreamGeometry', 'PathGeometry', 'Geometry', 'Path')
     * @returns {string} XAML文字列
     */
    generate(shapes, key = "Symbol.Custom", format = "StreamGeometry", separator = ' ', isCompact = true) {
        const pathData = shapes
            .map(shape => this.shapeToPathData(shape, separator, isCompact))
            .filter(data => data) // nullを除外
            .join("\n    "); // 各図形を新しい行にする（インデント付き）

        switch (format) {
            case 'StreamGeometry':
                return `<StreamGeometry x:Key="${key}">\n    ${pathData}\n</StreamGeometry>`;
            case 'PathGeometry':
                return `<PathGeometry x:Key="${key}">\n    ${pathData}\n</PathGeometry>`;
            case 'Path':
                // Path要素の場合は属性の中にデータを入れるため、単一行または属性ごとの改行を検討
                // ここでは読みやすさのため属性を改行する形式にする
                return `<Path\n    x:Key="${key}"\n    Data="${pathData.replace(/\n    /g, ' ')}"\n    Fill="Black" />`;
            case 'SVG':
                // SVG形式
                return `<path d="${pathData.replace(/\n    /g, ' ')}" />`;
            case 'Geometry':
            default:
                return `<Geometry x:Key="${key}">\n    ${pathData}\n</Geometry>`;
        }
    },

    /**
     * 個別の図形をSVGパスデータ形式に変換
     * @param {Object} shape 
     * @returns {string}
     */
    shapeToPathData(shape, separator = ' ', isCompact = true) {
        const s = separator;
        const c = isCompact ? '' : ' ';
        
        switch (shape.type) {
            case 'line':
                return `M${c}${this.fmt(shape.x1)}${s}${this.fmt(shape.y1)} L${c}${this.fmt(shape.x2)}${s}${this.fmt(shape.y2)}`;
            
            case 'rect':
                const x2 = shape.x + shape.width;
                const y2 = shape.y + shape.height;
                return `M${c}${this.fmt(shape.x)}${s}${this.fmt(shape.y)} L${c}${this.fmt(x2)}${s}${this.fmt(shape.y)} L${c}${this.fmt(x2)}${s}${this.fmt(y2)} L${c}${this.fmt(shape.x)}${s}${this.fmt(y2)} Z`;
            
            case 'circle':
                // 円を2つの円弧(A)コマンドで表現 (WPF/XAML互換)
                const r = shape.r;
                if (r <= 0) return null;
                const cx = shape.cx;
                const cy = shape.cy;
                return `M${c}${this.fmt(cx - r)}${s}${this.fmt(cy)} A${c}${this.fmt(r)}${s}${this.fmt(r)} 0 1 1 ${this.fmt(cx + r)}${s}${this.fmt(cy)} A${c}${this.fmt(r)}${s}${this.fmt(r)} 0 1 1 ${this.fmt(cx - r)}${s}${this.fmt(cy)} Z`;
            
            case 'path':
                if (shape.points.length < 2) return null;
                const points = shape.points.map(p => `${this.fmt(p.x)}${s}${this.fmt(p.y)}`);
                return `M${c}${points[0]} L${c}${points.slice(1).join(" ")}`;
            
            case 'arc':
                return `M${c}${this.fmt(shape.x1)}${s}${this.fmt(shape.y1)} A${c}${this.fmt(shape.rx)}${s}${this.fmt(shape.ry)} ${shape.rotation} ${shape.largeArcFlag} ${shape.sweepFlag} ${this.fmt(shape.x2)}${s}${this.fmt(shape.y2)}`;

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
