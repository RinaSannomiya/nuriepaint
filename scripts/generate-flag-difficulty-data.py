#!/usr/bin/env python3
"""国旗・国際信号旗の「ぬりえテスト」の難易度用データ（色の種類の数・細かさのランク）を自動生成する。

使い方（リポジトリのルートで）:
  python3 scripts/generate-flag-difficulty-data.py

必要: Pillow, numpy, opencv-python (cv2)
前提: src/illustrations/flagQuizData.ts / signalFlagQuizData.ts が最新であること
      （先に generate-flag-quiz-data.py / generate-signal-flag-quiz-data.py を実行する）

出力: src/illustrations/flagDifficultyData.ts
  colors … パレットで選ぶ必要がある色の種類の数（ダミー色は除く。白は、白い領域が旗の 0.3% 以上ある旗だけ数える）
  fine   … 細かさのランク。線画の「小さい塗れる領域」（面積 1500px 未満。キャンバス約 40px 四方未満）の数で決める
           S: 100 以上（紋章など）／A: 20〜99（星や小さな図柄が多い）／null: それ未満
"""
import importlib.util
import re
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/illustrations/flagDifficultyData.ts'

SMALL_REGION_PX = 1500  # これより小さい塗れる領域を「小さい領域」と数える（1562x1168 のキャンバス上）
FINE_S = 100
FINE_A = 20
WHITE_MIN_FRAC = 0.003  # 旗の面積のこれ以上が白い領域なら「白も使う旗」

# App.tsx に手書きのパレットがある旗（flagQuizData.ts にない）の、白以外の正解色の数
HAND_WRITTEN_NONWHITE = {'001': 2, '002': 2, '003': 3}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


gen = load_module('flagquiz', ROOT / 'scripts/generate-flag-quiz-data.py')
DUMMY_HEX = {h.lower() for _, h in gen.DUMMY_POOL}


def read_swatches(ts_path, prefix):
    src = ts_path.read_text(encoding='utf-8')
    quiz = {}
    for m in re.finditer(r"'" + prefix + r"-(\d+)': \{ passingScore: \d+, swatches: \[(.*?)\] \}", src):
        quiz[m.group(1)] = re.findall(r"\{ name: '([^']*)', hex: '(#[0-9a-fA-F]{6})' \}", m.group(2))
    return quiz


def nonwhite_real_colors(swatches):
    """swatches から、白とダミー色を除いた「正解色」の数。"""
    return len([1 for name, hx in swatches if name != '白' and hx.lower() not in DUMMY_HEX])


def measure(line, ref):
    """線画と見本から (小さい領域の数, 白を使うか) を求める。旗の外側（キャンバスの縁につながる領域）は除く。"""
    labels, area, means = gen.components(line, ref)
    n = len(area)
    border = set(np.unique(np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])).tolist())
    regs = [i for i in range(1, n) if area[i] >= 1 and i not in border]
    flag_area = sum(area[i] for i in regs)
    white_area = sum(area[i] for i in regs if gen.near_white(np.array([[means[i]]], np.uint8))[0, 0])
    small = sum(1 for i in regs if area[i] < SMALL_REGION_PX)
    return small, white_area / max(flag_area, 1) >= WHITE_MIN_FRAC


def fine_rank(small):
    if small >= FINE_S:
        return 'S'
    if small >= FINE_A:
        return 'A'
    return None


def main():
    results = {}  # id -> (colors, fine)

    flag_quiz = read_swatches(ROOT / 'src/illustrations/flagQuizData.ts', 'flag')
    pages = sorted(set(flag_quiz) | set(HAND_WRITTEN_NONWHITE))
    for page in pages:
        line = gen.canvas_lineart(page)
        h, w = line.shape
        ref = gen.map_reference(page, (w, h), 'app')
        small, has_white = measure(line, ref)
        nonwhite = HAND_WRITTEN_NONWHITE[page] if page in HAND_WRITTEN_NONWHITE else nonwhite_real_colors(flag_quiz[page])
        results[f'flag-{page}'] = (nonwhite + (1 if has_white else 0), fine_rank(small))

    signal_quiz = read_swatches(ROOT / 'src/illustrations/signalFlagQuizData.ts', 'signal-flag')
    line_dir = ROOT / 'public/lineart/signal-flags'
    ref_dir = ROOT / 'public/lineart/signal-flags-colored'
    x, y, cw, ch = gen.CROP
    for page in sorted(signal_quiz):
        line = cv2.imread(str(line_dir / f'signal-{page}.png'), cv2.IMREAD_GRAYSCALE)[y:y + ch, x:x + cw]
        ref = cv2.cvtColor(cv2.imread(str(ref_dir / f'signal-{page}.png')), cv2.COLOR_BGR2RGB)[y:y + ch, x:x + cw]
        small, has_white = measure(line, ref)
        results[f'signal-flag-{page}'] = (nonwhite_real_colors(signal_quiz[page]) + (1 if has_white else 0), fine_rank(small))

    lines = [
        '// 自動生成ファイル: scripts/generate-flag-difficulty-data.py で作成（手で編集しない）',
        '// 国旗・国際信号旗の「ぬりえテスト」の難易度用データ。キーは illustration の id。',
        '// colors: パレットで選ぶ色の種類の数（ダミー色は除く）／ fine: 細かさのランク（S=紋章など、A=星や小さな図柄が多い）',
        '',
        "export type FlagDifficultyInfo = { colors: number; fine: 'S' | 'A' | null }",
        '',
        'export const FLAG_DIFFICULTY_DATA: Record<string, FlagDifficultyInfo> = {',
    ]
    for key in sorted(results):
        colors, fine = results[key]
        lines.append(f"  '{key}': {{ colors: {colors}, fine: {'null' if fine is None else repr(fine)} }},")
    lines += ['}', '']
    OUT.write_text('\n'.join(lines), encoding='utf-8')

    flags = {k: v for k, v in results.items() if k.startswith('flag-')}
    sigs = {k: v for k, v in results.items() if k.startswith('signal-')}
    for label, group in (('国旗', flags), ('国際信号旗', sigs)):
        colors = {}
        for c, _ in group.values():
            colors[c] = colors.get(c, 0) + 1
        ranks = {r: sum(1 for _, f in group.values() if f == r) for r in ('S', 'A')}
        print(f'{label}: {len(group)}枚 色の数の分布={dict(sorted(colors.items()))} S={ranks["S"]} A={ranks["A"]}')
    print(f'-> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
