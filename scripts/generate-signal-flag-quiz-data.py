#!/usr/bin/env python3
"""国際信号旗クイズ用のパレット（正解色＋ダミー色）を、見本画像から自動生成する。

使い方（リポジトリのルートで）:
  python3 scripts/generate-signal-flag-quiz-data.py            # 生成して src/illustrations/signalFlagQuizData.ts に書き出す
  python3 scripts/generate-signal-flag-quiz-data.py --report   # 旗ごとの検証結果も表示する
  python3 scripts/generate-signal-flag-quiz-data.py --no-write # 検証だけして何も書き換えない

必要: Pillow, numpy, opencv-python (cv2)

国旗用の scripts/generate-flag-quiz-data.py の関数（領域の分割・正解色のまとめ方・ダミー色の選び方・
アプリと同じ採点の再現）をそのまま使う。信号旗の見本は線画とぴったり重なる「べた塗り＋黒線」の画像なので、
国旗のような見本の貼り直しは不要。
"""
import argparse
import importlib.util
import re
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('flagquiz', ROOT / 'scripts/generate-flag-quiz-data.py')
fq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fq)

LINE_DIR = ROOT / 'public/lineart/signal-flags'
REF_DIR = ROOT / 'public/lineart/signal-flags-colored'
DATA = ROOT / 'src/illustrations/signalFlagData.ts'
OUT = ROOT / 'src/illustrations/signalFlagQuizData.ts'
CROP = fq.CROP  # illustrations.tsx の FLAG_RASTER_CROP（国旗と同じ切り出し範囲）


def crop(img):
    x, y, w, h = CROP
    return img[y:y + h, x:x + w]


def with_distinct_dummies(page, swatches, n_real):
    """ダミー色を作り直す。信号旗は赤・青・黄など「はっきりした色」ばかりなので、
    正解色と同じ名前のダミー（例: 正解が青 #0000ff なのにダミーにも青 #29a2de）は、子どもが迷うので入れない。"""
    real = swatches[:n_real]
    answer_names = {n.rstrip('0123456789') for n, _ in real}
    answer_hexes = [h for _, h in real]
    n_dummy = min(max(2, 5 - n_real), max(0, 10 - n_real))
    pool = fq.DUMMY_POOL[:]
    fq.random.Random(int(page)).shuffle(pool)
    out = list(real)
    for name, hx in pool:
        if len(out) - n_real >= n_dummy:
            break
        if name in answer_names or fq.is_confusing_dummy(hx, answer_hexes):
            continue
        out.append((name, hx))
    return out


def process(page):
    line = crop(cv2.imread(str(LINE_DIR / f'signal-{page}.png'), cv2.IMREAD_GRAYSCALE))
    ref = crop(fq.load_rgb(REF_DIR / f'signal-{page}.png'))
    if line.shape[:2] != ref.shape[:2]:
        raise RuntimeError(f'{page}: 線画と見本のサイズが違います {line.shape} / {ref.shape}')
    labels, area, means = fq.components(line, ref)
    swatches, n_real = fq.build_palette(page, labels, area, means, ref)
    swatches = with_distinct_dummies(page, swatches, n_real)
    # パレットの色だけで領域を完璧に塗った場合の点数（アプリの採点と同じ計算）
    perfect = fq.paint(labels, area, ref, line, swatches, n_real)
    score, missing, passed = fq.evaluate(ref, perfect)
    # 何も塗らずに答え合わせしたとき
    blank = np.full_like(ref, 255)
    blank[line <= 128] = 0
    blank_score, _, blank_passed = fq.evaluate(ref, blank)
    return dict(swatches=swatches, n_real=n_real, score=score, missing=missing, passed=passed,
                blank_score=blank_score, blank_passed=blank_passed)


def all_pages():
    return re.findall(r"page:\s*'(\d+)'", DATA.read_text(encoding='utf-8'))


def write_ts(results):
    lines = [
        '// 自動生成ファイル: scripts/generate-signal-flag-quiz-data.py で作成（手で編集しない）',
        '// 国際信号旗クイズのパレット（正解色＋ダミー色）と合格ライン。キーは illustration の id。',
        '',
        "import type { FlagQuizData } from './flagQuizData'",
        '',
        'export const SIGNAL_FLAG_QUIZ_DATA: Record<string, FlagQuizData> = {',
    ]
    for page in sorted(results):
        r = results[page]
        sw = ', '.join(f"{{ name: '{n}', hex: '{h}' }}" for n, h in r['swatches'])
        lines.append(f"  'signal-flag-{page}': {{ passingScore: {fq.passing_for(r['score'])}, swatches: [{sw}] }},")
    lines += ['}', '']
    OUT.write_text('\n'.join(lines), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--no-write', action='store_true')
    args = ap.parse_args()
    results, bad = {}, []
    for page in all_pages():
        r = process(page)
        results[page] = r
        ok = r['passed'] and not r['blank_passed']
        if not ok:
            bad.append(page)
        if args.report:
            names = ' '.join(f"{n}{h}" for n, h in r['swatches'])
            print(f"{page} 満点={r['score']:3d}% 欠け={r['missing'] * 100:4.1f}% 未塗り={r['blank_score']:3d}%"
                  f"({'合格!' if r['blank_passed'] else '不合格'}) {names}{'' if ok else '  <-- 要確認'}", flush=True)
    if bad:
        print('要確認:', ' '.join(bad))
    if not args.no_write:
        write_ts(results)
        print(f'wrote {OUT.relative_to(ROOT)} ({len(results)} flags)')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
