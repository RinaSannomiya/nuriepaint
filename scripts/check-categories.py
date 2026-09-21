#!/usr/bin/env python3
"""カテゴリー・イラスト定義の整合性チェック（リポジトリのルートで実行）。

  python3 scripts/check-categories.py            # チェック
  python3 scripts/check-categories.py --counts   # 小カテゴリーごとの枚数も表示

確認すること:
  1. ILLUSTRATION_CATEGORIES のカテゴリーIDが、src/illustrations/categoryIds.ts（サーバーの入力チェック）に全部ある
     （逆に、categoryIds.ts にだけあるIDもないか）
  2. 線画・サムネイル・国旗の見本などの画像ファイルが public/ にある
  3. イラストIDの重複がない
  4. 同じ名前のイラストがない（あれば警告。別の絵なら修飾語をつけて区別する）
  5. すべてのイラストが、ちょうど1つの小カテゴリーに入っている（0個だとマイギャラリーで「その他」に落ち、2個だと二重に出る）
  6. すべての小カテゴリーが、ちょうど1つの大カテゴリー（CATEGORY_GROUPS）に入っている
  7. カテゴリー名に「・」を使っていない
問題があれば終了コード 1。
"""
import collections
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
errors, warnings = [], []

src = open('src/illustrations/illustrations.tsx', encoding='utf-8').read()

# 1) カテゴリーID
cats_start = src.index('export const ILLUSTRATION_CATEGORIES')
groups_start = src.index('export const CATEGORY_GROUPS')
cats_src = src[cats_start:groups_start]
groups_src = src[groups_start:]
starts = [(m.start(), m.group(1)) for m in re.finditer(r"\{\s*id:\s*'([^']+)'", cats_src)]
category_ids = [cid for _, cid in starts]
category_blocks = {}
category_titles = {}
for n, (pos, cid) in enumerate(starts):
    end = starts[n + 1][0] if n + 1 < len(starts) else len(cats_src)
    block = cats_src[pos:end]
    category_blocks[cid] = block
    tm = re.search(r"title:\s*'([^']*)'", block)
    category_titles[cid] = tm.group(1) if tm else ''
    fm = re.search(r"fullTitle:\s*'([^']*)'", block)
    if fm:
        category_titles[cid + ':full'] = fm.group(1)
server_src = open('src/illustrations/categoryIds.ts', encoding='utf-8').read()
server_ids = re.findall(r"^\s*'([^']+)',", server_src, re.M)
for cid in category_ids:
    if cid not in server_ids:
        errors.append(f'カテゴリー {cid} が categoryIds.ts にない（アップロード時にサーバーが拒否する）')
for cid in server_ids:
    if cid not in category_ids:
        errors.append(f'categoryIds.ts の {cid} が ILLUSTRATION_CATEGORIES にない')
if len(category_ids) != len(set(category_ids)):
    errors.append('ILLUSTRATION_CATEGORIES に同じカテゴリーIDが2回ある')
for key, title in category_titles.items():
    if '・' in title:
        errors.append(f'カテゴリー名に「・」がある: {key} = {title}')

# 2)(3)(4) イラスト
GROUPS = {
    'SNACK_DATA': ('snack-{p}', ['/lineart/snacks/thumbs/snack-{p}.png', '/lineart/snacks/snack-{p}.png']),
    'ANIMAL_DATA': ('animal-{p}', ['/lineart/animals/thumbs/animal-{p}.png', '/lineart/animals/animal-{p}.png']),
    'CLOTHES_DATA': ('clothes-{p}', ['/lineart/clothes/clothes-{p}.png']),
    'HOME_THINGS_DATA': ('home-{p}', ['/lineart/home-things/home-{p}.png']),
    'VEHICLE_DATA': ('vehicle-{p}', ['/lineart/vehicles/vehicle-{p}.png']),
    'DINOSAUR_DATA': ('dinosaur-{p}', ['/lineart/dinosaurs/dinosaur-{p}.png']),
    'PLANT_DATA': ('plant-{p}', ['/lineart/plants/plant-{p}.png']),
    'FOOD_DATA': ('food-{p}', ['/lineart/food/food-{p}.png']),
    'INSECT_DATA': ('insect-{p}', ['/lineart/insects/insect-{p}.png']),
    'TOOL_DATA': ('tool-{p}', ['/lineart/tools/tool-{p}.png']),
    'LIVING_THING_DATA': ('living-{p}', ['/lineart/living-things/living-{p}.png']),
    'FISH_DATA': ('fish-{p}', ['/lineart/fish/fish-{p}.png']),
    'PATTERN_DATA': ('pattern-{p}', ['/lineart/patterns/pattern-{p}.png']),
}
items = []  # (id, title)
for name, (id_fmt, paths) in GROUPS.items():
    m = re.search(r'const %s\s*(?::[^=]*)?=\s*\[(.*?)\n\]' % name, src, re.S)
    if not m:
        errors.append(f'{name} が見つからない')
        continue
    for page, title in re.findall(r"page:\s*'([^']*)',\s*title:\s*'([^']*)'", m.group(1)):
        items.append((id_fmt.format(p=page), title))
        for path in paths:
            if not os.path.exists('public' + path.format(p=page)):
                errors.append(f'画像がない: public{path.format(p=page)}')
for iid, title, source in re.findall(r"id:\s*'([\w-]+)',\s*title:\s*'([^']*)',\s*subtitle:\s*'[^']*',\s*source:\s*'([^']*)'", src):
    items.append((iid, title))
    if not os.path.exists('public' + source):
        errors.append(f'画像がない: public{source}')
for iid, title in re.findall(r"id:\s*'([A-Za-z]+)',\s*title:\s*'([^']*)',\s*subtitle:\s*'[^']*',\s*raster:", src):
    items.append((iid, title))

flag_src = open('src/illustrations/flagData.ts', encoding='utf-8').read()
for page, country in re.findall(r'"page":\s*"(\d+)",\s*"country":\s*"([^"]*)"', flag_src):
    items.append((f'flag-{page}', country))
    for d in ('flags', 'flags-colored'):
        if not os.path.exists(f'public/lineart/{d}/flag-{page}.png'):
            errors.append(f'画像がない: public/lineart/{d}/flag-{page}.png')
sig_src = open('src/illustrations/signalFlagData.ts', encoding='utf-8').read()
for page, title in re.findall(r"page:\s*'(\d+)',\s*title:\s*'([^']*)'", sig_src):
    items.append((f'signal-flag-{page}', title))
    for d in ('signal-flags', 'signal-flags-colored'):
        if not os.path.exists(f'public/lineart/{d}/signal-{page}.png'):
            errors.append(f'画像がない: public/lineart/{d}/signal-{page}.png')

ids = [i for i, _ in items]
for iid, n in collections.Counter(ids).items():
    if n > 1:
        errors.append(f'イラストID {iid} が {n} 回ある')
by_title = collections.defaultdict(list)
for iid, title in items:
    by_title[title].append(iid)
for title, lst in by_title.items():
    if len(lst) > 1:
        warnings.append(f'同じ名前「{title}」: {", ".join(lst)}')

# 5) 各小カテゴリーの中身を、TypeScript の式から作り直して確認する
PREFIX = {
    'ANIMAL': 'animal-', 'CLOTHES': 'clothes-', 'HOME_THINGS': 'home-', 'VEHICLE': 'vehicle-',
    'DINOSAUR': 'dinosaur-', 'PLANT': 'plant-', 'FOOD_CATEGORY': 'food-', 'INSECT': 'insect-',
    'TOOL': 'tool-', 'LIVING_THING': 'living-', 'BIRD': 'bird-', 'FISH': 'fish-', 'PATTERN': 'pattern-',
    'FLAG': 'flag-', 'SIGNAL_FLAG': 'signal-flag-',
}
ILL = {}
for key, prefix in PREFIX.items():
    ILL[key] = [i for i in ids if i.startswith(prefix) and not (key == 'FLAG' and i.startswith('signal-flag-'))]


def pick(*a):
    return list(a)


def rng(prefix, a, b):
    return [f'{prefix}{n:02d}' for n in range(a, b + 1)]


def without(lst, *ex):
    return [i for i in lst if i not in ex]


members = {}
for cid, block in category_blocks.items():
    expr = block[block.index('illustrationIds:') + len('illustrationIds:'):]
    expr = expr[:expr.rindex('}')].strip().rstrip(',')
    expr = re.sub(r'([A-Z_]+)_ILLUSTRATIONS\.map\(\(it\) => it\.id\)', r"ILL['\1']", expr)
    expr = expr.replace('range(', 'rng(').replace('...', '*')
    try:
        members[cid] = list(eval(expr, {'ILL': ILL, 'pick': pick, 'rng': rng, 'without': without}))
    except Exception as ex:  # noqa: BLE001
        errors.append(f'カテゴリー {cid} の中身を読み取れなかった: {ex}: {expr}')
        members[cid] = []

placed = collections.defaultdict(list)
for cid, lst in members.items():
    for iid in lst:
        placed[iid].append(cid)
id_set = set(ids)
for iid in ids:
    if len(placed[iid]) == 0:
        errors.append(f'イラスト {iid} がどの小カテゴリーにも入っていない')
    elif len(placed[iid]) > 1:
        errors.append(f'イラスト {iid} が複数の小カテゴリーに入っている: {placed[iid]}')
for iid in placed:
    if iid not in id_set:
        errors.append(f'カテゴリー {placed[iid]} に、存在しないイラストID {iid} がある')
for cid, lst in members.items():
    if len(lst) != len(set(lst)):
        errors.append(f'カテゴリー {cid} の中で同じイラストが2回ある')

# 6) 大カテゴリー
group_of = collections.defaultdict(list)
group_ids = []
for m in re.finditer(r"\{\s*id:\s*'(group-[^']+)',\s*title:\s*'([^']*)',\s*categoryIds:\s*\[(.*?)\]", groups_src, re.S):
    gid, gtitle, body = m.group(1), m.group(2), m.group(3)
    group_ids.append(gid)
    if '・' in gtitle:
        errors.append(f'大カテゴリー名に「・」がある: {gtitle}')
    for cid in re.findall(r"'([^']+)'", body):
        group_of[cid].append(gid)
if len(group_ids) != len(set(group_ids)):
    errors.append('CATEGORY_GROUPS に同じ大カテゴリーIDが2回ある')
for cid in category_ids:
    if len(group_of[cid]) != 1:
        errors.append(f'小カテゴリー {cid} が入っている大カテゴリーが {len(group_of[cid])} 個: {group_of[cid]}')
for cid in group_of:
    if cid not in category_ids:
        errors.append(f'CATEGORY_GROUPS に、存在しない小カテゴリーID {cid} がある')

non_empty = sum(1 for v in members.values() if v)
if '--counts' in sys.argv:
    for cid in category_ids:
        print(f'  {cid}: {len(members[cid])}')
print(f'大カテゴリー {len(group_ids)} 個 / 小カテゴリー {len(category_ids)} 個（イラストありは {non_empty} 個、空の枠は {len(category_ids) - non_empty} 個）')
print(f'カテゴリー {len(category_ids)} 個 / イラスト {len(items)} 枚を確認')
for w in warnings:
    print('警告:', w)
for e in errors:
    print('エラー:', e)
if errors:
    sys.exit(1)
print('OK')
