/**
 * Xhape Geometry Parser
 * XAML文字列（特にGeometryタグ内のパスデータ）を解析して内部図形数据に復元する
 */
const Parser = {
    /**
     * XAML文字列を解析して図形リストを返す
     * @param {string} xaml 
     * @returns {Array} shapes
     */
    parse(xaml) {
        if (!xaml) return { shapes: [], key: null };

        // Geometry, StreamGeometry, PathGeometryタグを検索
        const tagMatch = xaml.match(/<(StreamGeometry|PathGeometry|Geometry)(?:\s+x:Key=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/\1>/i);
        
        let key = null;
        let content = "";
        let format = 'StreamGeometry';

        if (tagMatch) {
            key = tagMatch[2] || null;
            content = tagMatch[3].trim();
            format = tagMatch[1];
        } else {
            // <Path Data="..." /> 形式または <path d="..." /> 形式を検索
            const pathMatch = xaml.match(/<(Path|path)(?:\s+x:Key=["']([^"']+)["'])?[^>]*\s+(Data|d)=["']([^"']+)["'][^>]*\/?>/i);
            if (pathMatch) {
                key = pathMatch[2] || null;
                content = pathMatch[4].trim();
                const tagName = pathMatch[1];
                if (tagName === 'path') format = 'SVG';
                else if (tagName === 'Path') format = 'Path';
                else format = 'StreamGeometry';
            } else {
                content = xaml.trim();
            }
        }

        // M (MoveTo) で分割して各図形のパスデータを取得
        // 肯定先読みを使用して 'M' (または 'm') を残す
        const segments = content.split(/(?=[Mm])/).filter(s => s.trim());
        
        const shapes = segments.map(seg => this.parsePathSegment(seg.trim())).filter(s => s);
        return { shapes, key, format };
    },

    /**
     * 単一のパスセグメントを解析
     * @param {string} pathStr 
     */
    parsePathSegment(pathStr) {
        // トークン化 (コマンド文字と数値を分離)
        // M, L, A, Z など (大文字小文字両方対応)
        const tokens = pathStr.match(/[a-df-gi-z]|-?\d*\.?\d+/gi);
        if (!tokens || tokens.length === 0) return null;

        const points = [];
        let i = 0;
        
        while (i < tokens.length) {
            const token = tokens[i].toUpperCase();
            
            if (token === 'M' || token === 'L') {
                const x = parseFloat(tokens[i + 1]);
                const y = parseFloat(tokens[i + 2]);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ cmd: token, x, y });
                }
                i += 3;
            } else if (token === 'A') {
                // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
                const rx = parseFloat(tokens[i + 1]);
                const ry = parseFloat(tokens[i + 2]);
                const rot = parseFloat(tokens[i + 3]);
                const large = parseInt(tokens[i + 4]);
                const sweep = parseInt(tokens[i + 5]);
                const x = parseFloat(tokens[i + 6]);
                const y = parseFloat(tokens[i + 7]);
                
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ cmd: 'A', rx, ry, rot, large, sweep, x, y });
                }
                i += 8;
            } else if (token === 'Z') {
                points.push({ cmd: 'Z' });
                i += 1;
            } else if (!isNaN(parseFloat(tokens[i]))) {
                // 数値が続く場合は前回のコマンド(L)の継続とみなす(省略記法対応)
                const x = parseFloat(tokens[i]);
                const y = parseFloat(tokens[i + 1]);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ cmd: 'L', x, y });
                    i += 2;
                } else {
                    i++;
                }
            } else {
                // 未対応のコマンドなどはスキップして次に進む
                i++;
            }
        }

        if (points.length === 0 || points[0].cmd !== 'M') return null;

        const isClosed = points.some(p => p.cmd === 'Z');
        const hasArc = points.some(p => p.cmd === 'A');

        // 円の判定 (Generator.shapeToPathData の形式: M p0 A r,r ... A r,r ... Z)
        if (hasArc && isClosed && points.length >= 4) {
            const p0 = points[0];
            const a1 = points.find(p => p.cmd === 'A');
            if (a1) {
                const r = a1.rx;
                const cx = p0.x + r;
                const cy = p0.y;
                return { type: 'circle', cx, cy, r };
            }
        }

        // 四角形の判定 (M p0 L p1 L p2 L p3 Z)
        if (isClosed && points.filter(p => p.cmd !== 'Z').length === 4 && !hasArc) {
            const p0 = points[0];
            const p2 = points[2];
            return {
                type: 'rect',
                x: Math.min(p0.x, p2.x),
                y: Math.min(p0.y, p2.y),
                width: Math.abs(p2.x - p0.x),
                height: Math.abs(p2.y - p0.y),
                startX: p0.x, startY: p0.y // 描画時の開始点保持
            };
        }

        // 直線の判定 (M p0 L p1) ※Zなし
        if (!isClosed && points.length === 2 && !hasArc) {
            return {
                type: 'line',
                x1: points[0].x, y1: points[0].y,
                x2: points[1].x, y2: points[1].y
            };
        }

        // 円弧の判定 (M p0 A ...) ※Zなし且つAが1つ
        if (!isClosed && points.length === 2 && points[1].cmd === 'A') {
            const p0 = points[0];
            const a = points[1];
            const { cx, cy, rx, ry } = this.calculateArcCenter(p0.x, p0.y, a.rx, a.ry, a.rot, a.large, a.sweep, a.x, a.y);
            return {
                type: 'arc',
                x1: p0.x, y1: p0.y,
                x2: a.x, y2: a.y,
                cx, cy,
                rx, ry,
                rotation: a.rot,
                largeArcFlag: a.large,
                sweepFlag: a.sweep
            };
        }

        // それ以外は汎用パスとして扱う
        return {
            type: 'path',
            points: points.filter(p => p.x !== undefined).map(p => ({ x: p.x, y: p.y }))
        };
    },

    /**
     * 円弧のパラメータから中心点を計算する (SVG実装ノート準拠)
     */
    calculateArcCenter(x1, y1, rx, ry, angle, largeArcFlag, sweepFlag, x2, y2) {
        const phi = angle * Math.PI / 180;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        const dx = (x1 - x2) / 2;
        const dy = (y1 - y2) / 2;
        const x1p = cosPhi * dx + sinPhi * dy;
        const y1p = -sinPhi * dx + cosPhi * dy;

        let rx2 = rx * rx;
        let ry2 = ry * ry;
        const x1p2 = x1p * x1p;
        const y1p2 = y1p * y1p;
        
        const lambda = x1p2 / rx2 + y1p2 / ry2;
        if (lambda > 1) {
            const scale = Math.sqrt(lambda);
            rx *= scale;
            ry *= scale;
            rx2 = rx * rx;
            ry2 = ry * ry;
        }

        let sign = (largeArcFlag === sweepFlag) ? -1 : 1;
        let num = rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2;
        if (num < 0) num = 0;
        const coef = sign * Math.sqrt(num / (rx2 * y1p2 + ry2 * x1p2));
        const cxp = coef * (rx * y1p / ry);
        const cyp = coef * -(ry * x1p / rx);

        const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
        const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

        return { cx, cy, rx, ry };
    }
};
