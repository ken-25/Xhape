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

        if (tagMatch) {
            key = tagMatch[2] || null;
            content = tagMatch[3].trim();
        } else {
            // <Path Data="..." /> 形式を検索
            const pathMatch = xaml.match(/<Path(?:\s+x:Key=["']([^"']+)["'])?[^>]*\s+Data=["']([^"']+)["'][^>]*\/?>/i);
            if (pathMatch) {
                key = pathMatch[1] || null;
                content = pathMatch[2].trim();
            } else {
                content = xaml.trim();
            }
        }

        // M (MoveTo) で分割して各図形のパスデータを取得
        // 肯定先読みを使用して 'M' を残す
        const segments = content.split(/(?=M)/).filter(s => s.trim());
        
        const shapes = segments.map(seg => this.parsePathSegment(seg.trim())).filter(s => s);
        
        let format = 'StreamGeometry';
        if (tagMatch) format = tagMatch[1];
        else if (xaml.includes('<Path')) format = 'Path';

        return { shapes, key, format };
    },

    /**
     * 単一のパスセグメントを解析
     * @param {string} pathStr 
     */
    parsePathSegment(pathStr) {
        // トークン化 (M, L, A, Z などのコマンドと数値を分離)
        const tokens = pathStr.split(/[\s,]+/).filter(t => t);
        if (tokens.length === 0 || tokens[0] !== 'M') return null;

        const points = [];
        let i = 0;
        
        while (i < tokens.length) {
            const token = tokens[i];
            
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
            } else {
                // 数値が続く場合は前回のコマンド(L)の継続とみなす(省略記法対応)
                const x = parseFloat(tokens[i]);
                const y = parseFloat(tokens[i + 1]);
                if (!isNaN(x) && !isNaN(y)) {
                    points.push({ cmd: 'L', x, y });
                    i += 2;
                } else {
                    i++;
                }
            }
        }

        if (points.length === 0) return null;

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

        // それ以外は汎用パスとして扱う
        return {
            type: 'path',
            points: points.filter(p => p.x !== undefined).map(p => ({ x: p.x, y: p.y }))
        };
    }
};
