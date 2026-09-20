#!/usr/bin/env python3
"""国旗クイズ用のパレット（正解色＋ダミー色）を、見本画像から自動生成する。

使い方（リポジトリのルートで）:
  python3 scripts/generate-flag-quiz-data.py            # 先行対象のみ
  python3 scripts/generate-flag-quiz-data.py --all      # 全旗
  python3 scripts/generate-flag-quiz-data.py --ids 192,102  # 指定した旗だけ

必要: Pillow, numpy, opencv-python (cv2)

やっていること:
  1. 線画(public/lineart/flags)を「塗れる領域」に分割し、各領域の見本色(public/lineart/flags-colored)を集計
  2. 近い色をまとめて「正解色」にし、白は常に含める
  3. アプリの配色に近い「ダミー色」を、正解色と紛らわしくないものから足す
  4. App.tsx の evaluateRasterQuiz と同じ計算で「パレットの色だけで完璧に塗った場合」の点数を出し、
     合格ラインに届かない旗を検出する（--report で一覧表示）
"""
import argparse
import json
import random
import re
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LINE_DIR = ROOT / 'public/lineart/flags'
REF_DIR = ROOT / 'public/lineart/flags-colored'
OUT = ROOT / 'src/illustrations/flagQuizData.ts'
FLAG_DATA = ROOT / 'src/illustrations/flagData.ts'

CROP = (96, 36, 1562, 1168)  # illustrations.tsx の FLAG_RASTER_CROP
NO_CROP_PAGES = {'116', '077', '118'}  # ネパール・スイス・バチカンは縦横比が違う画像なので crop なし（illustrations.tsx と揃える）
HAND_WRITTEN = {'001', '002', '003'}  # App.tsx に手書きのパレットがある旗（生成対象外）
PHASE1 = ['192', '102', '141', '017', '015', '005', '043', '132', '195', '186']
DEFAULT_PASSING = 88
MERGE_DIST = 40  # これ以内の色は同じ色として扱う
MIN_CLUSTER_AREA = 0.0025  # 全体の0.25%未満の色は正解色に含めない
MAX_ANSWERS = 7
ALIGN_MIN_CLUSTER_AREA = 0.005  # 見本を作り直す旗は、紋章の細かい色を減らす
ALIGN_MAX_ANSWERS = 6
# 小さな色（星・紋章の葉など）の拾い上げ。面積が小さくてパレットから漏れた色を、正解色に追加する
RESCUE_MIN_REGION = 30  # 拾う領域の最小面積(px)
RESCUE_MIN_BLACK = 20  # 黒い領域は、線ではない「面」の黒い画素がこれ以上あるものだけ拾う（文字など）
RESCUE_MIN_TOTAL = 120  # 同じ色の領域の合計面積(px)がこれ未満なら拾わない（にじみ・ノイズ対策）
RESCUE_DIST = 70  # 既存の正解色からこれ以上離れている色だけ拾う（採点の許容距離 78 に合わせる）
RESCUE_MAX_ANSWERS = 14  # 拾った分も含めた正解色（白を除く）の上限。10色を超えたらダミー色は付けない（パレットは折り返して表示される）

# 見本画像と線画の形が違いすぎて自動で色を決められない旗: 領域の位置(キャンバス内の割合)と色を手で指定する
# (fx, fy, 色) … その点を含む「塗れる領域」をその色にする
OVERRIDES = {
    '056': [  # クウェート（見本の黒い台形が線画より細く、位置がずれる）
        (0.17, 0.50, '#000000'), (0.58, 0.17, '#007a3d'), (0.68, 0.50, '#ffffff'), (0.58, 0.83, '#ce1126'),
    ],
    '095': [  # タンザニア（見本の斜めの帯の幅が線画と違う）
        (0.27, 0.25, '#1eb53a'), (0.42, 0.38, '#fcd116'), (0.50, 0.50, '#000000'),
        (0.58, 0.62, '#fcd116'), (0.73, 0.75, '#00a3dd'),
    ],
}

DUMMY_POOL = [
    ('赤', '#ef6950'), ('青', '#29a2de'), ('黄', '#feb61c'), ('緑', '#1cb5a5'),
    ('オレンジ', '#ff883e'), ('紫', '#af52de'), ('ピンク', '#ff7ab8'),
    ('茶色', '#9b6330'), ('水色', '#5bc8f2'),
]


# ---- App.tsx と同じ判定 -------------------------------------------------
def near_white(a):
    return (a[..., 0] > 240) & (a[..., 1] > 240) & (a[..., 2] > 236)


def near_black(a):
    return (a[..., 0] < 35) & (a[..., 1] < 35) & (a[..., 2] < 35)


def likely_line(a):
    nb = near_black(a)
    nonblack = (~nb).astype(np.float32)
    cnt = cv2.filter2D(nonblack, -1, np.ones((5, 5), np.float32), borderType=cv2.BORDER_CONSTANT)
    return nb & (cnt >= 8)


def evaluate(expected, actual, passing=DEFAULT_PASSING):
    """App.tsx evaluateRasterQuiz の再現。戻り値 (score, missing_ratio, passed)。"""
    content = ~near_white(expected)
    ys, xs = np.where(content)
    if len(ys) == 0:
        return 0, 0.0, False
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    exp_line = likely_line(expected)
    act_line = likely_line(actual)
    skip = exp_line | (act_line & ~near_black(expected))
    sl = (slice(top, bottom + 1, 2), slice(left, right + 1, 2))
    E, A, S = expected[sl].astype(int), actual[sl].astype(int), skip[sl]
    dist = np.sqrt(((E - A) ** 2).sum(-1))
    valid = ~S
    matched = valid & (dist <= 78)
    missing = valid & ~matched & ~near_white(E) & near_white(A)
    total = int(valid.sum())
    if total == 0:
        return 0, 0.0, False
    score = round(matched.sum() / total * 100)
    return score, missing.sum() / total, bool(score >= passing and missing.sum() < total * 0.08)


# ---- 読み込み ----------------------------------------------------------
def load_rgb(path):
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def crop_for(page):
    return None if page in NO_CROP_PAGES else CROP


def canvas_lineart(page):
    """アプリのキャンバス（線画を crop で切り出したもの）と同じ範囲の線画。白=塗れる場所。"""
    gray = cv2.imread(str(LINE_DIR / f'flag-{page}.png'), cv2.IMREAD_GRAYSCALE)
    crop = crop_for(page)
    if crop:
        x, y, w, h = crop
        gray = gray[y:y + h, x:x + w]
    return gray


def frame_box(page):
    """線画の外枠（黒い線が存在する範囲）を、画像全体の座標で返す。(x0, y0, x1, y1) x1,y1 は含まない"""
    gray = cv2.imread(str(LINE_DIR / f'flag-{page}.png'), cv2.IMREAD_GRAYSCALE)
    ys, xs = np.where(gray < 128)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def content_box(ref):
    """見本画像の中で、白以外が写っている範囲（余白を除いた国旗部分）。"""
    mask = ~near_white(ref)
    cols = np.where(mask.mean(axis=0) > 0.004)[0]
    rows = np.where(mask.mean(axis=1) > 0.004)[0]
    return int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1


def aligned_full(page):
    """見本が国旗だけの別サイズ画像のとき、線画の外枠に合わせて1754x1240の白地に貼り直した全体画像。"""
    ref = load_rgb(REF_DIR / f'flag-{page}.png')
    lx0, ly0, lx1, ly1 = frame_box(page)
    rx0, ry0, rx1, ry1 = content_box(ref)
    part = ref[ry0:ry1, rx0:rx1]
    tw, th = lx1 - lx0, ly1 - ly0
    interp = cv2.INTER_AREA if part.shape[1] >= tw else cv2.INTER_CUBIC
    line = cv2.imread(str(LINE_DIR / f'flag-{page}.png'), cv2.IMREAD_GRAYSCALE)
    out = np.full((*line.shape, 3), 255, np.uint8)
    out[ly0:ly1, lx0:lx1] = cv2.resize(part, (tw, th), interpolation=interp)
    return out


def map_reference(page, canvas_size, mode):
    """アプリが見本画像をキャンバスに描く処理の再現。
    mode='app'   : 現状のアプリと同じ（線画と同じ crop を見本にも適用）
    mode='align' : 見本を線画の外枠に合わせて貼り直した画像に対して、同じ crop を適用
    """
    W, H = canvas_size
    ref = aligned_full(page) if mode == 'align' else load_rgb(REF_DIR / f'flag-{page}.png')
    crop = crop_for(page)
    if not crop:
        return cv2.resize(ref, (W, H), interpolation=cv2.INTER_AREA)
    x, y, w, h = crop
    rh, rw = ref.shape[:2]
    sw, sh = min(w, rw - x), min(h, rh - y)  # ブラウザは元画像の外側を切り捨てる
    if sw <= 0 or sh <= 0:
        return np.zeros((H, W, 3), np.uint8)
    part = ref[y:y + sh, x:x + sw]
    dw, dh = round(W * sw / w), round(H * sh / h)
    out = np.zeros((H, W, 3), np.uint8)  # 描かれない部分は透明(=黒扱い)
    out[:dh, :dw] = cv2.resize(part, (dw, dh), interpolation=cv2.INTER_AREA)
    return out


# ---- 色の名前 -----------------------------------------------------------
def rgb_to_hsl(rgb):
    r, g, b = [v / 255 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    d = mx - mn
    if d == 0:
        return 0, 0, l * 100
    s = d / (1 - abs(2 * l - 1))
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return (round(h * 60) % 360), s * 100, l * 100


def color_name(rgb):
    h, s, l = rgb_to_hsl(rgb)
    if l > 92:
        return '白'
    if l < 14:
        return '黒'
    if s < 14:
        return '灰色'
    if h >= 345 or h < 12:
        return 'ピンク' if l > 72 else ('えんじ' if l < 30 else '赤')
    if h < 40:
        return '茶色' if l < 38 else 'オレンジ'
    if h < 68:
        return '茶色' if l < 38 else '黄'
    if h < 90:
        return '黄緑'
    if h < 165:
        return '緑'
    if h < 200:
        return '水色' if l > 55 else '青緑'
    if h < 255:
        return '水色' if l > 68 else ('紺' if l < 27 else '青')
    if h < 295:
        return '紫'
    return 'ピンク'


def is_confusing_dummy(candidate_hex, answer_hexes):
    c = hex_to_rgb(candidate_hex)
    ch, cs, cl = rgb_to_hsl(c)
    for ah in answer_hexes:
        a = hex_to_rgb(ah)
        if np.linalg.norm(np.array(c) - np.array(a)) < 96:
            return True
        h, s, l = rgb_to_hsl(a)
        hue = min(abs(ch - h), 360 - abs(ch - h))
        if hue < 24 and abs(cl - l) < 18 and abs(cs - s) < 28:
            return True
    return False


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in rgb)


# ---- パレット生成 -------------------------------------------------------
def components(line_gray, ref):
    """線画の白い領域ごとに、見本の平均色・面積・純度を求める。"""
    white = (line_gray > 128).astype(np.uint8)
    n, labels = cv2.connectedComponents(white, connectivity=4)
    interior = cv2.erode(white, np.ones((7, 7), np.uint8))
    lab_all = labels.ravel()
    lab_in = np.where(interior.ravel() > 0, lab_all, 0)
    area = np.bincount(lab_all, minlength=n).astype(float)
    area_in = np.bincount(lab_in, minlength=n).astype(float)
    means = np.zeros((n, 3))
    for c in range(3):
        ch = ref[..., c].ravel().astype(float)
        s_in = np.bincount(lab_in, weights=ch, minlength=n)
        s_all = np.bincount(lab_all, weights=ch, minlength=n)
        means[:, c] = np.where(area_in > 0, s_in / np.maximum(area_in, 1), s_all / np.maximum(area, 1))
    return labels, area, means


def rescue_small_colors(labels, area, ref, answers, exclude=(), limit=RESCUE_MAX_ANSWERS):
    """塗れる領域のうち、見本の色が既存の正解色と大きく違うのに、面積が小さくて正解色から漏れたものを拾う。
    領域ごとに「全画素の中央値」を代表色にする（小さな領域は7x7の侵食で中身が消えるため、べた塗り部分では判定できない）。"""
    n = len(area)
    lab = labels.ravel()
    flat = ref.reshape(-1, 3)
    order = np.argsort(lab, kind='stable')
    sl = lab[order]
    starts = np.searchsorted(sl, np.arange(n))
    ends = np.searchsorted(sl, np.arange(n), side='right')
    known = [np.array(a, float) for a in answers] + [np.array([255.0, 255.0, 255.0])]
    # 黒は「線」と「面（文字など）」を区別する。線（細い黒）は採点で無視されるので、面として黒い画素だけ数える
    solid_black = (near_black(ref) & ~likely_line(ref)).ravel()
    black_px = np.bincount(lab, weights=solid_black.astype(float), minlength=n)
    found = []  # (代表色, 面積)
    for i in range(1, n):
        if area[i] < RESCUE_MIN_REGION:
            continue
        px = flat[order[starts[i]:ends[i]]].astype(float)
        med = np.median(px, axis=0)
        if float((np.linalg.norm(px - med, axis=1) < 30).mean()) < 0.7:
            continue  # 色が混ざった領域（位置ずれ・にじみ）
        a = area[i]
        if near_white(np.array([[med]], np.uint8))[0, 0]:
            continue  # 白は別扱い
        if max(med) < 40:
            if black_px[i] < RESCUE_MIN_BLACK:
                continue  # 線（細い黒）や、線と線の細いすきま
            med, a = np.zeros(3), black_px[i]
        if min(np.linalg.norm(k - med) for k in known) <= RESCUE_DIST:
            continue
        found.append((med, a))
    clusters = []
    for med, a in sorted(found, key=lambda t: -t[1]):
        for c in clusters:
            if np.linalg.norm(c[0] - med) <= MERGE_DIST:
                c[1] += a
                break
        else:
            clusters.append([med.copy(), a])
    added = []
    for med, a in sorted(clusters, key=lambda c: -c[1]):
        rgb = tuple(np.clip(np.round(med), 0, 255).astype(int))
        if a < RESCUE_MIN_TOTAL or rgb_to_hex(rgb) in exclude:
            continue
        if len(answers) + len(added) >= limit:
            break
        if any(np.linalg.norm(np.array(rgb, float) - np.array(x, float)) <= RESCUE_DIST for x in added):
            continue
        added.append(rgb)
    return added


def build_palette(page, labels, area, means, ref, min_area=MIN_CLUSTER_AREA, max_answers=MAX_ANSWERS, exclude=(), rescue=False, info=None):
    total = float(labels.size)
    order = [i for i in np.argsort(-area) if i != 0 and area[i] > 0]
    clusters = []  # [weighted_sum(3), area, rep, members]
    for i in order:
        col = means[i]
        for cl in clusters:
            if np.linalg.norm(col - cl[2]) <= MERGE_DIST:
                cl[0] += col * area[i]
                cl[1] += area[i]
                cl[2] = cl[0] / cl[1]
                cl[3].append(i)
                break
        else:
            clusters.append([col * area[i], area[i], col.copy(), [i]])
    # 代表色は平均ではなく「べた塗り部分の中央値」にする（線やにじみ・位置ずれで濁らないように）
    cluster_of = np.full(len(area), -1, np.int32)
    for k, cl in enumerate(clusters):
        cluster_of[cl[3]] = k
    inter = cv2.erode((labels > 0).astype(np.uint8), np.ones((7, 7), np.uint8)).ravel() > 0
    cid = cluster_of[labels.ravel()]
    flat = ref.reshape(-1, 3).astype(float)
    for k, cl in enumerate(clusters):
        px = flat[inter & (cid == k)]
        if len(px):
            px = px[np.linalg.norm(px - cl[2], axis=1) < 45]
        if len(px) > 50:
            cl[2] = np.median(px, axis=0)
        pure = float((np.linalg.norm(px - cl[2], axis=1) < 30).mean()) if len(px) else 0.0
        cl.append(pure)
    answers = []
    for wsum, a, rep, _members, pure in sorted(clusters, key=lambda c: -c[1]):
        rgb = tuple(np.clip(np.round(rep), 0, 255).astype(int))
        if pure < 0.6 and len(clusters) > 2:
            continue  # 位置ずれ・にじみで混ざった色（べた塗りの部分が少ない）は正解色にしない
        if a / total < min_area or rgb_to_hex(rgb) in exclude:
            continue
        if near_white(np.array([[rgb]], dtype=np.uint8))[0, 0]:
            continue  # 白は別扱い
        answers.append(rgb)
    answers = [(0, 0, 0) if max(rgb) < 12 else rgb for rgb in answers][:max_answers]
    if page in OVERRIDES:
        answers = []
        for _fx, _fy, hx in OVERRIDES[page]:
            rgb = hex_to_rgb(hx)
            if rgb != (255, 255, 255) and rgb not in answers:
                answers.append(rgb)
    n_main = len(answers)
    if rescue and page not in OVERRIDES:
        answers += rescue_small_colors(labels, area, ref, answers, exclude=exclude)
    if info is not None:
        info['n_main'] = n_main  # answers[:n_main] が従来の方法で決めた色、それ以降が拾い上げた小さな色

    swatches = [('白', '#ffffff')]
    used = {'白'}
    for rgb in answers:
        name = color_name(rgb)
        base, k = name, 2
        while name in used:
            name = f'{base}{k}'
            k += 1
        used.add(name)
        swatches.append((name, rgb_to_hex(rgb)))

    n_real = len(swatches)
    n_dummy = max(2, 5 - len(swatches))
    n_dummy = min(n_dummy, max(0, 10 - len(swatches)))
    pool = DUMMY_POOL[:]
    random.Random(int(page)).shuffle(pool)
    answer_hexes = [h for _, h in swatches]
    added = 0
    for name, hx in pool:
        if added >= n_dummy:
            break
        if is_confusing_dummy(hx, answer_hexes):
            continue
        swatches.append((name if name not in used else name + '2', hx))
        used.add(name)
        added += 1
    return swatches, n_real


def vote_colors(labels, area, ref, pal):
    """各領域について、見本の画素が「パレットのどの色にいちばん近いか」の多数決で塗る色を決める。"""
    K = len(pal)
    n = len(area)
    flat = ref.reshape(-1, 3).astype(np.int32)
    idx = np.zeros(flat.shape[0], np.int32)
    step = 400000
    for i in range(0, flat.shape[0], step):
        d = ((flat[i:i + step, None, :] - pal[None, :, :].astype(np.int32)) ** 2).sum(-1)
        idx[i:i + step] = d.argmin(1)
    lab = labels.ravel()
    inter = cv2.erode((labels > 0).astype(np.uint8), np.ones((7, 7), np.uint8)).ravel() > 0
    # 境界付近の画素は見本の線・にじみを拾いやすいので、内側の画素の票を重くする
    counts = np.bincount(lab * K + idx, minlength=n * K).reshape(n, K).astype(float)
    counts += 1000 * np.bincount((lab * K + idx)[inter], minlength=n * K).reshape(n, K)
    return counts.argmax(1)


def resolve_points(labels, origin, size, points):
    """手で指定した点(キャンバス内の割合)を含む領域 -> 色 の対応を作る。線の上に当たったら近くの領域を使う。"""
    ox, oy = origin
    w, h = size
    fixed = {}
    for fx, fy, hx in points:
        x, y = int(ox + fx * w), int(oy + fy * h)
        win = labels[max(0, y - 20):y + 21, max(0, x - 20):x + 21]
        cy_, cx_ = min(y, 20), min(x, 20)
        if labels[y, x] > 0:
            label = labels[y, x]
        else:
            ys, xs = np.where(win > 0)
            if len(ys) == 0:
                raise RuntimeError(f'override point ({fx},{fy}) not on any region')
            j = np.argmin((ys - cy_) ** 2 + (xs - cx_) ** 2)
            label = win[ys[j], xs[j]]
        fixed[int(label)] = hex_to_rgb(hx)
    return fixed


def paint(labels, area, ref, line_gray, swatches, n_real, fixed=None):
    """パレットの色だけで各領域を塗ったキャンバス（線は黒）。"""
    pal = np.array([hex_to_rgb(h) for _, h in swatches[:n_real]], np.uint8)
    choice = vote_colors(labels, area, ref, pal)
    lut = pal[choice]
    for label, rgb in (fixed or {}).items():
        lut[label] = rgb
    lut[0] = 0
    actual = lut[labels]
    actual[line_gray <= 128] = 0
    return actual


def process(page):
    line = canvas_lineart(page)
    H, W = line.shape
    modes = ('align',) if page in OVERRIDES else ('app', 'align')
    best = None
    for mode in modes:
        ref = map_reference(page, (W, H), mode)
        labels, area, means = components(line, ref)
        kw = dict(min_area=ALIGN_MIN_CLUSTER_AREA, max_answers=ALIGN_MAX_ANSWERS) if mode == 'align' else {}
        fixed = resolve_points(labels, (0, 0), (W, H), OVERRIDES[page]) if page in OVERRIDES else None
        exclude = set()
        for _ in range(2):
            info = {}
            swatches, n_real = build_palette(page, labels, area, means, ref, exclude=exclude, rescue=True, info=info, **kw)
            actual = paint(labels, area, ref, line, swatches, n_real, fixed)
            # 実際に塗られなかった正解色（にじみ・位置ずれで生まれた色）はパレットから外して作り直す
            # （拾い上げた小さな色は、面積が小さいのが当たり前なので「20画素以上塗られていれば」使われたとみなす）
            flat_actual = actual.reshape(-1, 3).astype(int)
            unused = set()
            for k, (_, h) in enumerate(swatches[1:n_real]):
                n_px = int((np.abs(flat_actual - np.array(hex_to_rgb(h))).sum(1) == 0).sum())
                if n_px < (0.0005 * len(flat_actual) if k < info['n_main'] else 20):
                    unused.add(h)
            if not unused:
                break
            exclude |= unused
        score, miss, passed = evaluate(ref, actual)
        if mode == 'app':
            app_score = score
        if best is None or score > best['score'] + 1:
            best = dict(mode=mode, swatches=swatches, n_real=n_real, n_main=info['n_main'], score=score, missing=miss, passed=passed)
        if mode == 'app' and score >= 90:
            break
    best['app_score'] = app_score if 'app_score' in dir() else 0
    if best['mode'] == 'align':
        # 見本は線画どおりに作り直すので、パレットの色で塗れば必ず満点になる。score は元の写真との一致度（確認用）
        best['fidelity'] = best['score']
        best['score'] = 100
        best['passed'] = True
    return best


def regenerate_reference(page, swatches, n_real):
    """見本画像を、線画の領域どおりに塗った画像として作り直す（1754x1240、線画と完全に重なる）。
    国旗だけの別サイズ画像・位置がずれた見本を、線画に合わせて貼り直してから領域ごとに色を決める。"""
    line = cv2.imread(str(LINE_DIR / f'flag-{page}.png'), cv2.IMREAD_GRAYSCALE)
    ref = aligned_full(page)
    labels, area, _ = components(line, ref)
    fixed = None
    if page in OVERRIDES:
        cx, cy, cw, ch = crop_for(page) or (0, 0, line.shape[1], line.shape[0])
        fixed = resolve_points(labels, (cx, cy), (cw, ch), OVERRIDES[page])
    return paint(labels, area, ref, line, swatches, n_real, fixed), ref


def make_sheet(pages_info, path):
    """確認用: 各旗について 元の見本 | 作り直した見本 を並べた画像。"""
    cells = []
    for page, orig, regen in pages_info:
        pair = []
        for img in (orig, regen):
            small = cv2.resize(img, (330, 233), interpolation=cv2.INTER_AREA)
            small = np.ascontiguousarray(small)
            cv2.putText(small, page, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)
            pair.append(small)
        cells.append(np.hstack(pair))
    if len(cells) % 2:
        cells.append(np.full_like(cells[0], 200))
    rows = [np.hstack([cells[i], cells[i + 1]]) for i in range(0, len(cells), 2)]
    cv2.imwrite(str(path), cv2.cvtColor(np.vstack(rows), cv2.COLOR_RGB2BGR))


# ---- 出力 ---------------------------------------------------------------
def all_pages():
    src = FLAG_DATA.read_text(encoding='utf-8')
    return re.findall(r'"page":\s*"(\d+)"', src)


def passing_for(score):
    # 完璧に塗っても96%に届かない旗（細かい模様が多い旗）は、合格ラインを少し下げる（下限75）
    return DEFAULT_PASSING if score >= 96 else max(75, score - 8)


def write_ts(results):
    lines = [
        '// 自動生成ファイル: scripts/generate-flag-quiz-data.py で作成（手で編集しない）',
        '// 国旗クイズのパレット（正解色＋ダミー色）と合格ライン。キーは illustration の id。',
        '',
        'export type FlagQuizData = {',
        '  passingScore: number',
        '  swatches: { name: string; hex: string }[]',
        '}',
        '',
        'export const FLAG_QUIZ_DATA: Record<string, FlagQuizData> = {',
    ]
    for page in sorted(results):
        r = results[page]
        sw = ', '.join(f"{{ name: '{n}', hex: '{h}' }}" for n, h in r['swatches'])
        lines.append(f"  'flag-{page}': {{ passingScore: {passing_for(r['score'])}, swatches: [{sw}] }},")
    lines.append('}')
    lines.append('')
    OUT.write_text('\n'.join(lines), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--ids', default='')
    ap.add_argument('--report', action='store_true')
    ap.add_argument('--no-write', action='store_true')
    ap.add_argument('--write-aligned', action='store_true', help='見本が線画と合っていない旗の見本画像を、線画どおりに塗り直して上書き保存する')
    ap.add_argument('--preview', default='', help='確認用の並べ画像の保存先（貼り直しが必要な旗のみ）')
    args = ap.parse_args()
    if args.ids:
        pages = [p.zfill(3) for p in args.ids.split(',')]
    elif args.all:
        pages = [p for p in all_pages() if p not in HAND_WRITTEN]
    else:
        pages = PHASE1
    results, full = {}, set()
    for i, page in enumerate(pages, 1):
        r = process(page)
        results[page] = r
        if r['mode'] == 'align':
            full.add(page)
        if args.report:
            flag = '' if r['passed'] else '  <-- 要確認'
            names = ' '.join(f"{n}{h}" for n, h in r['swatches'])
            extra = f"（元写真との一致度={r['fidelity']}%）" if 'fidelity' in r else ''
            print(f"{page} 満点想定={r['score']:3d}% 欠け={r['missing']*100:4.1f}% 見本={r['mode']:5s}(現行方式={r['app_score']}%){extra} {names}{flag}", flush=True)
    if full:
        print('見本画像の貼り直しが必要な旗:', ' '.join(sorted(full)))
    if args.write_aligned or args.preview:
        info = []
        for page in sorted(full):
            r = results[page]
            regen, orig = regenerate_reference(page, r['swatches'], r['n_real'])
            orig_raw = load_rgb(REF_DIR / f'flag-{page}.png')
            info.append((page, orig_raw if orig_raw.shape[:2] == orig.shape[:2] else cv2.resize(orig_raw, (orig.shape[1], orig.shape[0])), regen))
            if args.write_aligned:
                cv2.imwrite(str(REF_DIR / f'flag-{page}.png'), cv2.cvtColor(regen, cv2.COLOR_RGB2BGR))
                print(f'  作り直して保存: public/lineart/flags-colored/flag-{page}.png')
        if args.preview and info:
            Path(args.preview).parent.mkdir(parents=True, exist_ok=True)
            for i in range(0, len(info), 6):
                make_sheet(info[i:i + 6], Path(args.preview).with_name(Path(args.preview).stem + f'-{i // 6 + 1}.png'))
    if not args.no_write:
        write_ts(results)
        print(f'wrote {OUT.relative_to(ROOT)} ({len(results)} flags)')


if __name__ == '__main__':
    sys.exit(main())
