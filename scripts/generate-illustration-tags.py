#!/usr/bin/env python3
"""国旗の「ちいき」タグと、国際信号旗の「しゅるい」タグを作って、src/illustrations/illustrationTags.ts に書き出す。

使い方（リポジトリのルートで）:
  python3 scripts/generate-illustration-tags.py

やっていること:
  - 国旗 195枚: flagData.ts の国コード（ISO 3166-1 alpha-2）から、下の REGIONS の表でちいき（アジア／ヨーロッパ／アフリカ／アメリカ／オセアニア）を決める
  - 国際信号旗 40枚: signalFlagData.ts のタイトルから、もじ（A〜Z）／すうじ（0〜9）／そのほか（代表旗・回答旗）を決める
  - 表にない国コードがあると、エラーで止まる（新しい旗を足したら、REGIONS にも足す）

タグは「見せ方のしぼりこみ」だけに使う。カテゴリーID・イラストID・DB には影響しない。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FLAG_DATA = ROOT / 'src/illustrations/flagData.ts'
SIGNAL_DATA = ROOT / 'src/illustrations/signalFlagData.ts'
OUT = ROOT / 'src/illustrations/illustrationTags.ts'

# ちいきの分け方（ひとつの国は必ずどれか1つ）。
# 大陸をまたぐ国は、日本の学校の地図帳や国旗の本でよく使われる分け方にそろえている:
#   ロシア・キプロス → ヨーロッパ ／ トルコ・ジョージア・アルメニア・アゼルバイジャン・カザフスタン → アジア ／ エジプト → アフリカ
REGIONS = [
    ('asia', 'アジア', 'af am az bh bd bt bn kh cn ge in id ir iq il jp jo kz kp kr kw kg la lb my mv mn mm np om pk ps ph qa sa sg lk sy tj th tl tm tr ae uz vn ye'),
    ('europe', 'ヨーロッパ', 'al ad at by be ba bg hr cy cz dk ee fi fr de gr hu is ie it lv li lt lu mt md mc me nl mk no pl pt ro ru sm rs sk si es se ch ua gb va'),
    ('africa', 'アフリカ', 'dz ao bj bw bf bi cv cm cf td km cg cd ci dj eg gq er sz et ga gm gh gn gw ke ls lr ly mg mw ml mr mu ma mz na ne ng rw st sn sc sl so za ss sd tz tg tn ug zm zw'),
    ('americas', 'アメリカ', 'ag ar bs bb bz bo br ca cl co cr cu dm do ec sv gd gt gy ht hn jm mx ni pa py pe kn lc vc sr tt us uy ve'),
    ('oceania', 'オセアニア', 'au fj ki mh fm nr nz pw pg ws sb to tv vu'),
]
SIGNAL_KINDS = [
    ('letters', 'もじ'),
    ('numbers', 'すうじ'),
    ('others', 'そのほか'),
]


def main() -> int:
    code_to_region: dict[str, str] = {}
    for rid, _label, codes in REGIONS:
        for code in codes.split():
            if code in code_to_region:
                print(f'エラー: 国コード {code} が {code_to_region[code]} と {rid} の両方にある')
                return 1
            code_to_region[code] = rid

    flags = re.findall(r'"page":\s*"(\d+)",\s*"country":\s*"([^"]+)",\s*"code":\s*"([^"]+)"', FLAG_DATA.read_text(encoding='utf-8'))
    if not flags:
        print('エラー: flagData.ts から旗を読み取れなかった')
        return 1
    tags: list[tuple[str, str]] = []
    missing = []
    used = set()
    for page, country, code in flags:
        region = code_to_region.get(code)
        if not region:
            missing.append(f'flag-{page} {country} ({code})')
            continue
        used.add(code)
        tags.append((f'flag-{page}', region))
    if missing:
        print('エラー: ちいきが決まっていない旗があります。scripts/generate-illustration-tags.py の REGIONS に国コードを足してください:')
        for line in missing:
            print('  ' + line)
        return 1
    unused = sorted(set(code_to_region) - used)
    if unused:
        print(f'注意: REGIONS にあるが flagData.ts にない国コード: {" ".join(unused)}')

    signals = re.findall(r"page:\s*'(\d+)',\s*title:\s*'([^']+)'", SIGNAL_DATA.read_text(encoding='utf-8'))
    if not signals:
        print('エラー: signalFlagData.ts から旗を読み取れなかった')
        return 1
    for page, title in signals:
        head = title[0]
        kind = 'letters' if re.fullmatch(r'[A-Z]', head) else 'numbers' if re.fullmatch(r'[0-9]', head) else 'others'
        tags.append((f'signal-flag-{page}', kind))

    lines = [
        '// 自動生成ファイル: scripts/generate-illustration-tags.py で作成（手で編集しない）',
        '// イラストの「タグ」。カテゴリーの中をしぼりこむチップに使う（カテゴリーID・イラストID・DBには影響しない）。',
        '// 国旗 → ちいき、国際信号旗 → しゅるい。ユーザーが追加した旗にはタグがないので、「すべて」でだけ表示される。',
        '',
        'export type TagFacet = { id: string; label: string }',
        '',
        '// カテゴリーIDごとの、タグの選択肢（この順にチップが並ぶ）',
        'export const TAG_FACETS: Record<string, { ariaLabel: string; tags: TagFacet[] }> = {',
        "  flags: {",
        "    ariaLabel: 'ちいきでしぼりこむ',",
        '    tags: [' + ', '.join(f"{{ id: '{rid}', label: '{label}' }}" for rid, label, _ in REGIONS) + '],',
        '  },',
        "  'signal-flags': {",
        "    ariaLabel: 'しゅるいでしぼりこむ',",
        '    tags: [' + ', '.join(f"{{ id: '{kid}', label: '{label}' }}" for kid, label in SIGNAL_KINDS) + '],',
        '  },',
        '}',
        '',
        '// イラストIDごとのタグ',
        'export const ILLUSTRATION_TAGS: Record<string, string> = {',
    ]
    for illustration_id, tag in tags:
        lines.append(f"  '{illustration_id}': '{tag}',")
    lines += ['}', '']
    OUT.write_text('\n'.join(lines), encoding='utf-8')

    counts: dict[str, int] = {}
    for _, tag in tags:
        counts[tag] = counts.get(tag, 0) + 1
    print(f'{OUT.relative_to(ROOT)} を書き出しました（国旗 {len(flags)}枚・信号旗 {len(signals)}枚）')
    print('  ' + ' / '.join(f'{label} {counts.get(rid, 0)}' for rid, label, _ in REGIONS))
    print('  ' + ' / '.join(f'{label} {counts.get(kid, 0)}' for kid, label in SIGNAL_KINDS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
