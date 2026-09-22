import type { PointerEvent, ReactNode } from 'react'
import { FLAG_DATA } from './flagData'
import { SIGNAL_FLAG_DATA } from './signalFlagData'
import { ROAD_SIGN_DATA } from './roadSignData'
import { Apple } from './svgs/Apple'
import { Blueberry } from './svgs/Blueberry'
import { Grape } from './svgs/Grape'
import { IceBar } from './svgs/IceBar'
import { Lemon } from './svgs/Lemon'
import { Orange } from './svgs/Orange'
import { Peach } from './svgs/Peach'
import { RasterLineArt, type RasterPaintCommand } from './svgs/RasterLineArt'
import { Spinach } from './svgs/Spinach'

export type IllustrationId = string

export type IllustrationDef = {
  id: IllustrationId
  title: string
  subtitle: string
  thumbnailImage?: string
  autoTrimThumbnail?: boolean
  referenceImage?: string
  raster?: boolean
  rasterCrop?: { x: number; y: number; width: number; height: number }
  node: (props: {
    fills: Record<string, string>
    onPaint: (regionId: string, ev: PointerEvent<SVGElement>) => void
    color?: string
    command?: RasterPaintCommand | null
    onTwoFingerTap?: () => void
    eyedropper?: boolean
    brush?: boolean
    onPickColor?: (color: string) => void
    restoreImage?: { url: string; seq: number } | null
  }) => ReactNode
}

export type IllustrationCategory = {
  id: string
  title: string
  /** 単独で出すと意味がわかりにくい名前（アジア、そのほか など）のときだけ、一覧用の名前を入れる */
  fullTitle?: string
  subtitle: string
  illustrationIds: IllustrationId[]
}

/** 大カテゴリー。小カテゴリー（IllustrationCategory）を id でまとめる */
export type CategoryGroup = {
  id: string
  title: string
  categoryIds: string[]
}

const FOOD_ILLUSTRATIONS: IllustrationDef[] = [
  {
    id: 'apple',
    title: 'りんご',
    subtitle: 'Apple',
    raster: true,
    node: (props) => <Apple {...props} />,
  },
  {
    id: 'orange',
    title: 'みかん',
    subtitle: 'Orange',
    raster: true,
    node: (props) => <Orange {...props} />,
  },
  {
    id: 'lemon',
    title: 'レモン',
    subtitle: 'Lemon',
    raster: true,
    node: (props) => <Lemon {...props} />,
  },
  {
    id: 'spinach',
    title: 'ほうれんそう',
    subtitle: 'Spinach',
    raster: true,
    node: (props) => <Spinach {...props} />,
  },
  {
    id: 'iceBar',
    title: 'アイスバー',
    subtitle: 'Ice bar',
    raster: true,
    node: (props) => <IceBar {...props} />,
  },
  {
    id: 'blueberry',
    title: 'ブルーベリー',
    subtitle: 'Blueberry',
    raster: true,
    node: (props) => <Blueberry {...props} />,
  },
  {
    id: 'grape',
    title: 'ぶどう',
    subtitle: 'Grape',
    raster: true,
    node: (props) => <Grape {...props} />,
  },
  {
    id: 'peach',
    title: 'もも',
    subtitle: 'Peach',
    raster: true,
    node: (props) => <Peach {...props} />,
  },
]

const FLAG_RASTER_CROP = { x: 96, y: 36, width: 1562, height: 1168 }
// 縦横比が他と違う画像（ネパール・スイス・バチカン）は切り出さず全体を使う
const FLAG_NO_CROP_PAGES = new Set(['116', '077', '118'])

const FLAG_ILLUSTRATIONS: IllustrationDef[] = FLAG_DATA.map((flag) => {
  const noCrop = FLAG_NO_CROP_PAGES.has(flag.page)
  return {
    id: `flag-${flag.page}`,
    title: flag.country,
    subtitle: flag.code.toUpperCase(),
    thumbnailImage: `/lineart/flags/flag-${flag.page}.png`,
    referenceImage: `/lineart/flags-colored/flag-${flag.page}.png`,
    raster: true,
    rasterCrop: noCrop ? undefined : FLAG_RASTER_CROP,
    node: (props) => (
      <RasterLineArt
        {...props}
        title={flag.country}
        source={`/lineart/flags/flag-${flag.page}.png`}
        crop={noCrop ? undefined : FLAG_RASTER_CROP}
      />
    ),
  }
})

// 国際信号旗。線画の大きさ・位置は国旗と同じなので、同じ切り出し範囲（FLAG_RASTER_CROP）を使う
const SIGNAL_FLAG_ILLUSTRATIONS: IllustrationDef[] = SIGNAL_FLAG_DATA.map((flag) => ({
  id: `signal-flag-${flag.page}`,
  title: flag.title,
  subtitle: flag.subtitle,
  thumbnailImage: `/lineart/signal-flags/signal-${flag.page}.png`,
  referenceImage: `/lineart/signal-flags-colored/signal-${flag.page}.png`,
  raster: true,
  rasterCrop: FLAG_RASTER_CROP,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={flag.title}
      source={`/lineart/signal-flags/signal-${flag.page}.png`}
      crop={FLAG_RASTER_CROP}
    />
  ),
}))

// 道路標識（警戒標識・規制標識）。線画・見本の大きさ・位置は国旗と同じなので、同じ切り出し範囲を使う
const ROAD_SIGN_ILLUSTRATIONS: IllustrationDef[] = ROAD_SIGN_DATA.map((sign) => ({
  id: `road-sign-${sign.page}`,
  title: sign.title,
  subtitle: sign.subtitle,
  thumbnailImage: `/lineart/road-signs/road-sign-${sign.page}.png`,
  referenceImage: `/lineart/road-signs-colored/road-sign-${sign.page}.png`,
  raster: true,
  rasterCrop: FLAG_RASTER_CROP,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={sign.title}
      source={`/lineart/road-signs/road-sign-${sign.page}.png`}
      crop={FLAG_RASTER_CROP}
    />
  ),
}))

const SNACK_DATA = [
  { page: '01', title: 'ドーナツ', subtitle: 'Donut' },
  { page: '02', title: 'カップケーキ', subtitle: 'Cupcake' },
  { page: '03', title: 'ソフトクリーム', subtitle: 'Soft serve' },
  { page: '04', title: 'クッキー', subtitle: 'Cookie' },
  { page: '05', title: 'マカロン', subtitle: 'Macaron' },
  { page: '06', title: 'プリン', subtitle: 'Pudding' },
  { page: '07', title: 'たい焼き', subtitle: 'Taiyaki' },
  { page: '08', title: 'どら焼き', subtitle: 'Dorayaki' },
  { page: '09', title: 'ショートケーキ', subtitle: 'Cake slice' },
  { page: '10', title: 'ワッフル', subtitle: 'Waffle' },
  { page: '11', title: 'クレープ', subtitle: 'Crepe' },
  { page: '12', title: 'マフィン', subtitle: 'Muffin' },
  { page: '13', title: 'プレッツェル', subtitle: 'Pretzel' },
  { page: '14', title: 'ポップコーン', subtitle: 'Popcorn' },
  { page: '15', title: 'キャンディ', subtitle: 'Lollipop' },
  { page: '16', title: 'チョコレート', subtitle: 'Chocolate' },
  { page: '18', title: 'だんご', subtitle: 'Dango' },
  { page: '19', title: 'メロンパン', subtitle: 'Melon pan' },
  { page: '21', title: 'いちごのホールケーキ', subtitle: 'Strawberry cake' },
  { page: '22', title: 'チョコのホールケーキ', subtitle: 'Chocolate cake' },
  { page: '23', title: 'フルーツタルト', subtitle: 'Fruit tart' },
  { page: '24', title: 'チーズケーキ', subtitle: 'Cheesecake' },
  { page: '25', title: 'スプリンクルケーキ', subtitle: 'Sprinkle cake' },
  { page: '26', title: 'いちごパフェ', subtitle: 'Strawberry parfait' },
  { page: '27', title: 'チョコパフェ', subtitle: 'Chocolate parfait' },
  { page: '28', title: 'フルーツパフェ', subtitle: 'Fruit parfait' },
  { page: '29', title: '抹茶パフェ', subtitle: 'Matcha parfait' },
  { page: '30', title: 'アイスクリームパフェ', subtitle: 'Ice cream parfait' },
]

const SNACK_ILLUSTRATIONS: IllustrationDef[] = SNACK_DATA.map((snack) => ({
  id: `snack-${snack.page}`,
  title: snack.title,
  subtitle: snack.subtitle,
  thumbnailImage: `/lineart/snacks/thumbs/snack-${snack.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={snack.title}
      source={`/lineart/snacks/snack-${snack.page}.png`}
    />
  ),
}))

const ANIMAL_DATA = [
  { page: '01', title: 'いぬ', subtitle: 'Dog' },
  { page: '02', title: 'ねこ', subtitle: 'Cat' },
  { page: '03', title: 'うさぎ', subtitle: 'Rabbit' },
  { page: '04', title: 'ぞう', subtitle: 'Elephant' },
  { page: '05', title: 'ライオン', subtitle: 'Lion' },
  { page: '06', title: 'キリン', subtitle: 'Giraffe' },
  { page: '07', title: 'パンダ', subtitle: 'Panda' },
  { page: '08', title: 'にっこりペンギン', subtitle: 'Smiling penguin' },
  { page: '09', title: 'おおきなこうらのウミガメ', subtitle: 'Sea turtle (large shell)' },
  { page: '10', title: 'イルカ', subtitle: 'Dolphin' },
  { page: '11', title: 'もようがおおきいちょう', subtitle: 'Butterfly (bold pattern)' },
  { page: '12', title: 'はすのはっぱのカエル', subtitle: 'Frog on a lily pad' },
  { page: '13', title: 'うま', subtitle: 'Horse' },
  { page: '14', title: 'うし', subtitle: 'Cow' },
  { page: '15', title: 'ひつじ', subtitle: 'Sheep' },
  { page: '16', title: 'トラ', subtitle: 'Tiger' },
  { page: '17', title: 'きつね', subtitle: 'Fox' },
  { page: '18', title: 'くま', subtitle: 'Bear' },
  { page: '19', title: 'コアラ', subtitle: 'Koala' },
  { page: '20', title: 'さる', subtitle: 'Monkey' },
]

const ANIMAL_ILLUSTRATIONS: IllustrationDef[] = ANIMAL_DATA.map((animal) => ({
  id: `animal-${animal.page}`,
  title: animal.title,
  subtitle: animal.subtitle,
  thumbnailImage: `/lineart/animals/thumbs/animal-${animal.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={animal.title}
      source={`/lineart/animals/animal-${animal.page}.png`}
    />
  ),
}))

const CLOTHES_DATA = [
  { page: '01', title: 'フラワーワンピース', subtitle: 'Flower dress' },
  { page: '02', title: 'プリンセスドレス', subtitle: 'Princess dress' },
  { page: '03', title: 'はっぱのドレス', subtitle: 'Leaf dress' },
  { page: '04', title: 'みずたまドレス', subtitle: 'Polka dot dress' },
  { page: '05', title: '舞踏会ドレス', subtitle: 'Ball gown' },
  { page: '06', title: '花のサンドレス', subtitle: 'Floral sundress' },
  { page: '07', title: 'チェックのワンピース', subtitle: 'Checked pinafore' },
  { page: '08', title: 'イブニングドレス', subtitle: 'Evening dress' },
  { page: '09', title: 'フリルのドレス', subtitle: 'Ruffled dress' },
  { page: '10', title: 'ニットワンピース', subtitle: 'Sweater dress' },
  { page: '11', title: 'ゆかた風ローブ', subtitle: 'Yukata robe' },
  { page: '12', title: 'レトロみずたまドレス', subtitle: 'Vintage polka dots' },
  { page: '13', title: 'ぼたんのチャイナドレス', subtitle: 'Peony qipao' },
  { page: '14', title: '星のジャンパースカート', subtitle: 'Star jumper dress' },
]

const CLOTHES_ILLUSTRATIONS: IllustrationDef[] = CLOTHES_DATA.map((item) => ({
  id: `clothes-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/clothes/clothes-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/clothes/clothes-${item.page}.png`}
    />
  ),
}))

const HOME_THINGS_DATA = [
  { page: '01', title: 'お花の家', subtitle: 'Flower house' },
  { page: '02', title: '大きなおうち', subtitle: 'Big house' },
  { page: '03', title: 'きのこの家', subtitle: 'Mushroom house' },
  { page: '04', title: '和風のおうち', subtitle: 'Japanese house' },
  { page: '05', title: '小さなおうち', subtitle: 'Small house' },
]

const HOME_THINGS_ILLUSTRATIONS: IllustrationDef[] = HOME_THINGS_DATA.map((item) => ({
  id: `home-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/home-things/home-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/home-things/home-${item.page}.png`}
    />
  ),
}))

const VEHICLE_DATA = [
  { page: '01', title: 'くるま', subtitle: 'Car' },
  { page: '02', title: 'バス', subtitle: 'Bus' },
  { page: '03', title: '電車', subtitle: 'Train' },
  { page: '04', title: '飛行機', subtitle: 'Airplane' },
  { page: '05', title: '船', subtitle: 'Ship' },
]

const VEHICLE_ILLUSTRATIONS: IllustrationDef[] = VEHICLE_DATA.map((item) => ({
  id: `vehicle-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/vehicles/vehicle-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/vehicles/vehicle-${item.page}.png`}
    />
  ),
}))

const DINOSAUR_DATA = [
  { page: '01', title: 'ティラノサウルス', subtitle: 'Tyrannosaurus' },
  { page: '02', title: 'トリケラトプス', subtitle: 'Triceratops' },
  { page: '03', title: 'ステゴサウルス', subtitle: 'Stegosaurus' },
  { page: '04', title: 'ブラキオサウルス', subtitle: 'Brachiosaurus' },
  { page: '05', title: 'パラサウロロフス', subtitle: 'Parasaurolophus' },
  { page: '06', title: 'アンキロサウルス', subtitle: 'Ankylosaurus' },
  { page: '07', title: 'ヴェロキラプトル', subtitle: 'Velociraptor' },
  { page: '08', title: 'スピノサウルス', subtitle: 'Spinosaurus' },
  { page: '09', title: 'パキケファロサウルス', subtitle: 'Pachycephalosaurus' },
  { page: '10', title: 'アパトサウルス', subtitle: 'Apatosaurus' },
]

const DINOSAUR_ILLUSTRATIONS: IllustrationDef[] = DINOSAUR_DATA.map((item) => ({
  id: `dinosaur-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/dinosaurs/dinosaur-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/dinosaurs/dinosaur-${item.page}.png`}
    />
  ),
}))

const PLANT_DATA = [
  { page: '01', title: 'ひまわり', subtitle: 'Sunflower' },
  { page: '02', title: 'バラ', subtitle: 'Rose' },
  { page: '03', title: 'モンステラ', subtitle: 'Monstera' },
  { page: '04', title: 'サボテン', subtitle: 'Cactus' },
  { page: '05', title: 'ラン', subtitle: 'Orchid' },
]

const PLANT_ILLUSTRATIONS: IllustrationDef[] = PLANT_DATA.map((item) => ({
  id: `plant-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/plants/plant-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/plants/plant-${item.page}.png`}
    />
  ),
}))

const FOOD_DATA = [
  { page: '01', title: 'チャーハン', subtitle: 'Fried rice' },
  { page: '02', title: 'ハンバーガー', subtitle: 'Hamburger' },
  { page: '03', title: 'ラーメン', subtitle: 'Ramen' },
  { page: '04', title: 'ピザ', subtitle: 'Pizza' },
  { page: '05', title: 'おべんとう', subtitle: 'Bento' },
]

const FOOD_CATEGORY_ILLUSTRATIONS: IllustrationDef[] = FOOD_DATA.map((item) => ({
  id: `food-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/food/food-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/food/food-${item.page}.png`}
    />
  ),
}))

const INSECT_DATA = [
  { page: '01', title: 'もようがこまかいちょう', subtitle: 'Butterfly (fine pattern)' },
  { page: '02', title: 'てんとうむし', subtitle: 'Ladybug' },
  { page: '03', title: 'トンボ', subtitle: 'Dragonfly' },
  { page: '04', title: 'カブトムシ', subtitle: 'Rhinoceros beetle' },
  { page: '05', title: 'カマキリ', subtitle: 'Mantis' },
]

const INSECT_ILLUSTRATIONS: IllustrationDef[] = INSECT_DATA.map((item) => ({
  id: `insect-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/insects/insect-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/insects/insect-${item.page}.png`}
    />
  ),
}))

const TOOL_DATA = [
  { page: '01', title: 'かなづち', subtitle: 'Hammer' },
  { page: '02', title: 'レンチ', subtitle: 'Wrench' },
  { page: '03', title: 'ドライバー', subtitle: 'Screwdriver' },
  { page: '04', title: 'はさみ', subtitle: 'Scissors' },
  { page: '05', title: 'のこぎり', subtitle: 'Saw' },
]

const TOOL_ILLUSTRATIONS: IllustrationDef[] = TOOL_DATA.map((item) => ({
  id: `tool-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/tools/tool-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/tools/tool-${item.page}.png`}
    />
  ),
}))

const LIVING_THING_DATA = [
  { page: '02', title: 'こまかいうろこのウミガメ', subtitle: 'Sea turtle (fine scales)' },
  { page: '03', title: 'もようのあるカエル', subtitle: 'Patterned frog' },
  { page: '04', title: 'カメレオン', subtitle: 'Chameleon' },
]

const LIVING_THING_ILLUSTRATIONS: IllustrationDef[] = LIVING_THING_DATA.map((item) => ({
  id: `living-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/living-things/living-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/living-things/living-${item.page}.png`}
    />
  ),
}))

const BIRD_DATA = [
  { id: 'bird-owl', title: 'フクロウ', subtitle: 'Owl', source: '/lineart/living-things/living-01.png' },
  { id: 'bird-parrot', title: 'オウム', subtitle: 'Parrot', source: '/lineart/living-things/living-05.png' },
  { id: 'bird-01', title: 'クジャク', subtitle: 'Peacock', source: '/lineart/birds/bird-01.png' },
  { id: 'bird-02', title: 'よこむきペンギン', subtitle: 'Penguin (side view)', source: '/lineart/birds/bird-02.png' },
  { id: 'bird-03', title: 'フラミンゴ', subtitle: 'Flamingo', source: '/lineart/birds/bird-03.png' },
  { id: 'bird-04', title: 'ワシ', subtitle: 'Eagle', source: '/lineart/birds/bird-04.png' },
  { id: 'bird-05', title: 'ハクチョウ', subtitle: 'Swan', source: '/lineart/birds/bird-05.png' },
  { id: 'bird-06', title: 'オオハシ', subtitle: 'Toucan', source: '/lineart/birds/bird-06.png' },
  { id: 'bird-07', title: 'ニワトリ', subtitle: 'Rooster', source: '/lineart/birds/bird-07.png' },
  { id: 'bird-08', title: 'ハチドリ', subtitle: 'Hummingbird', source: '/lineart/birds/bird-08.png' },
]

const BIRD_ILLUSTRATIONS: IllustrationDef[] = BIRD_DATA.map((item) => ({
  id: item.id,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: item.source,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={item.source}
    />
  ),
}))

const FISH_DATA = [
  { page: '01', title: 'サメ', subtitle: 'Shark' },
  { page: '02', title: 'クマノミ', subtitle: 'Clownfish' },
  { page: '03', title: 'エンゼルフィッシュ', subtitle: 'Angelfish' },
  { page: '04', title: 'タツノオトシゴ', subtitle: 'Seahorse' },
  { page: '05', title: 'さかな', subtitle: 'Fish' },
]

const FISH_ILLUSTRATIONS: IllustrationDef[] = FISH_DATA.map((item) => ({
  id: `fish-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/fish/fish-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/fish/fish-${item.page}.png`}
    />
  ),
}))

const PATTERN_DATA = [
  { page: '01', title: 'ギリシャ雷文', subtitle: 'Greek key' },
  { page: '02', title: 'ケルト結び', subtitle: 'Celtic knot' },
  { page: '03', title: '幾何学文様', subtitle: 'Geometry' },
  { page: '04', title: 'ペイズリー', subtitle: 'Paisley' },
  { page: '05', title: 'タラベラ花柄', subtitle: 'Talavera' },
  { page: '06', title: '青海波', subtitle: 'Seigaiha' },
  { page: '07', title: '麻の葉', subtitle: 'Asanoha' },
  { page: '08', title: '七宝つなぎ', subtitle: 'Shippo' },
]

const PATTERN_ILLUSTRATIONS: IllustrationDef[] = PATTERN_DATA.map((item) => ({
  id: `pattern-${item.page}`,
  title: item.title,
  subtitle: item.subtitle,
  thumbnailImage: `/lineart/patterns/pattern-${item.page}.png`,
  raster: true,
  node: (props) => (
    <RasterLineArt
      {...props}
      title={item.title}
      source={`/lineart/patterns/pattern-${item.page}.png`}
      allowEdgeFill
    />
  ),
}))

export const ILLUSTRATIONS: IllustrationDef[] = [
  ...FOOD_ILLUSTRATIONS,
  ...ANIMAL_ILLUSTRATIONS,
  ...SNACK_ILLUSTRATIONS,
  ...FLAG_ILLUSTRATIONS,
  ...SIGNAL_FLAG_ILLUSTRATIONS,
  ...ROAD_SIGN_ILLUSTRATIONS,
  ...CLOTHES_ILLUSTRATIONS,
  ...HOME_THINGS_ILLUSTRATIONS,
  ...VEHICLE_ILLUSTRATIONS,
  ...DINOSAUR_ILLUSTRATIONS,
  ...PLANT_ILLUSTRATIONS,
  ...FOOD_CATEGORY_ILLUSTRATIONS,
  ...INSECT_ILLUSTRATIONS,
  ...TOOL_ILLUSTRATIONS,
  ...LIVING_THING_ILLUSTRATIONS,
  ...BIRD_ILLUSTRATIONS,
  ...FISH_ILLUSTRATIONS,
  ...PATTERN_ILLUSTRATIONS,
]

// ── かくしページ ─────────────────────────────────────────────
// 「りんご・みかん・レモン・ほうれんそう・ガリガリくんのアイス・ブルーベリー・ぶどう・もも」の、はじめの8枚の並び。
// 一覧（ILLUSTRATION_CATEGORIES）には入れていないので、ふつうは表に出ない。
// https://nuriepaint.com/ringo-mikan-lemon を開いたときだけ、あそぶの一覧の先頭に出る（App.tsx の readSecretMode）。
// イラストのIDは ILLUSTRATIONS のものをそのまま使う（マイギャラリーの保存作品やクイズ成績は、ふつうのカテゴリー側と同じものを指す）。
export const SECRET_PATH = '/ringo-mikan-lemon'
export const SECRET_FIRST_CATEGORY: IllustrationCategory = {
  id: 'secret-first-eight',
  title: 'はじまりのフルーツ・やさい',
  subtitle: 'はじめの8まい',
  illustrationIds: ['apple', 'orange', 'lemon', 'spinach', 'iceBar', 'blueberry', 'grape', 'peach'],
}
// かくしページの中だけ、むかしの名前で表示するイラスト
export const SECRET_TITLE_OVERRIDES: Record<string, string> = {
  iceBar: 'ガリガリくんのアイス',
}

// ── カテゴリー（枠）─────────────────────────────────────────
// 大カテゴリー（CATEGORY_GROUPS）の下に小カテゴリー（ILLUSTRATION_CATEGORIES）が並ぶ、2階層。
// ・1つのイラストは、かならず1つの小カテゴリーにだけ入れる（マイギャラリーで二重に出ないように）。
// ・小カテゴリーのIDは DB（uploaded_linearts など）に保存されるので、いちど決めたら変えない。
//   新しいIDは src/illustrations/categoryIds.ts にも足す（scripts/check-categories.py で確認できる）。
// ・イラストが0枚の小カテゴリーは「これから増やす枠」。画面には出さない（App.tsx 側で空のカテゴリーを隠す）。
// ・名前に「・」は使わない。
// ・fullTitle は、他の場所に1枚だけ出したときに意味がわかりにくい名前（アジア、そのほか など）用。
const pick = (...ids: IllustrationId[]): IllustrationId[] => ids
const range = (prefix: string, from: number, to: number): IllustrationId[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`)
const without = (ids: IllustrationId[], ...excluded: IllustrationId[]): IllustrationId[] =>
  ids.filter((id) => !excluded.includes(id))

export const ILLUSTRATION_CATEGORIES: IllustrationCategory[] = [
  // いきもの
  {
    id: 'animals',
    title: 'どうぶつ',
    subtitle: '',
    illustrationIds: without(
      ANIMAL_ILLUSTRATIONS.map((it) => it.id),
      'animal-08',
      'animal-09',
      'animal-10',
      'animal-11',
      'animal-12',
    ),
  },
  {
    id: 'birds',
    title: 'とり',
    subtitle: '',
    illustrationIds: [...BIRD_ILLUSTRATIONS.map((it) => it.id), 'animal-08'],
  },
  {
    id: 'fish',
    title: 'うみのいきもの',
    subtitle: '',
    illustrationIds: [...FISH_ILLUSTRATIONS.map((it) => it.id), 'animal-10', 'animal-09', 'living-02'],
  },
  {
    id: 'insects',
    title: 'むし',
    subtitle: '',
    illustrationIds: [...INSECT_ILLUSTRATIONS.map((it) => it.id), 'animal-11'],
  },
  {
    id: 'living-things',
    title: 'はちゅうるい',
    subtitle: '',
    illustrationIds: pick('living-04'),
  },
  { id: 'amphibians', title: 'りょうせいるい', subtitle: '', illustrationIds: pick('animal-12', 'living-03') },
  { id: 'dinosaurs', title: 'きょうりゅう', subtitle: '', illustrationIds: DINOSAUR_ILLUSTRATIONS.map((it) => it.id) },

  // しぜん
  { id: 'plants', title: 'しょくぶつ', subtitle: '', illustrationIds: PLANT_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'weather', title: 'てんき', subtitle: '', illustrationIds: [] },
  { id: 'space', title: 'うちゅう', subtitle: '', illustrationIds: [] },

  // たべもの
  {
    id: 'ringo-mikan-lemon',
    title: 'フルーツ',
    subtitle: '',
    illustrationIds: pick('apple', 'orange', 'lemon', 'blueberry', 'grape', 'peach'),
  },
  { id: 'vegetables', title: 'やさい', subtitle: '', illustrationIds: pick('spinach') },
  {
    id: 'sweets',
    title: 'スイーツ',
    subtitle: '',
    // アイスバーはソフトクリーム（snack-03）のとなりに並べる
    illustrationIds: pick('snack-02', 'snack-03', 'iceBar', 'snack-05', 'snack-06', 'snack-09', 'snack-10', 'snack-11', ...range('snack-', 21, 30)),
  },
  {
    id: 'snacks',
    title: 'おやつ',
    subtitle: '',
    illustrationIds: pick('snack-01', 'snack-04', 'snack-07', 'snack-08', ...range('snack-', 12, 16), 'snack-18', 'snack-19'),
  },
  { id: 'food', title: 'ごはん', subtitle: '', illustrationIds: FOOD_CATEGORY_ILLUSTRATIONS.map((it) => it.id) },

  // のりもの
  { id: 'vehicles', title: 'くるま', subtitle: '', illustrationIds: pick('vehicle-01', 'vehicle-02') },
  { id: 'trains', title: 'でんしゃ', subtitle: '', illustrationIds: pick('vehicle-03') },
  { id: 'airplanes', title: 'ひこうき', subtitle: '', illustrationIds: pick('vehicle-04') },
  { id: 'ships', title: 'ふね', subtitle: '', illustrationIds: pick('vehicle-05') },

  // くらし
  { id: 'home-things', title: 'おうち', subtitle: '', illustrationIds: HOME_THINGS_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'rooms', title: 'へや', subtitle: '', illustrationIds: [] },
  { id: 'tools', title: 'どうぐ', subtitle: '', illustrationIds: TOOL_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'toys', title: 'おもちゃ', subtitle: '', illustrationIds: [] },

  // おしゃれ
  {
    id: 'clothes',
    title: 'ドレス',
    subtitle: '',
    illustrationIds: without(
      CLOTHES_ILLUSTRATIONS.map((it) => it.id),
      'clothes-11',
      'clothes-13',
    ),
  },
  { id: 'casual-wear', title: 'いつものふく', subtitle: '', illustrationIds: [] },
  { id: 'world-costumes', title: 'せかいのいしょう', subtitle: '', illustrationIds: pick('clothes-11', 'clothes-13') },
  { id: 'accessories', title: 'こもの', subtitle: '', illustrationIds: [] },

  // もよう（地域は日本以外でリリースするときの翻訳を考えて、地域名でわけている）
  { id: 'patterns-asia', title: 'アジア', fullTitle: 'アジアのもよう', subtitle: '', illustrationIds: pick('pattern-06', 'pattern-07', 'pattern-08', 'pattern-04') },
  { id: 'patterns-europe', title: 'ヨーロッパ', fullTitle: 'ヨーロッパのもよう', subtitle: '', illustrationIds: pick('pattern-01', 'pattern-02') },
  { id: 'patterns-africa', title: 'アフリカ', fullTitle: 'アフリカのもよう', subtitle: '', illustrationIds: [] },
  { id: 'patterns-america', title: 'アメリカ', fullTitle: 'アメリカのもよう', subtitle: '', illustrationIds: pick('pattern-05') },
  { id: 'patterns-oceania', title: 'オセアニア', fullTitle: 'オセアニアのもよう', subtitle: '', illustrationIds: [] },
  { id: 'patterns', title: 'そのほか', fullTitle: 'そのほかのもよう', subtitle: '', illustrationIds: pick('pattern-03') },

  // シンボル（国旗の地域・国際信号旗のしゅるいは、あとで「タグ」でしぼりこむ）
  { id: 'flags', title: '国旗', subtitle: '', illustrationIds: FLAG_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'signal-flags', title: '国際信号旗', subtitle: '', illustrationIds: SIGNAL_FLAG_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'road-signs', title: '道路標識', subtitle: '', illustrationIds: ROAD_SIGN_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'safety-marks', title: 'あんぜんマーク', subtitle: '', illustrationIds: [] },

  // きせつ（ぎょうじもここ）
  { id: 'spring', title: 'はる', subtitle: '', illustrationIds: [] },
  { id: 'summer', title: 'なつ', subtitle: '', illustrationIds: [] },
  { id: 'autumn', title: 'あき', subtitle: '', illustrationIds: [] },
  { id: 'winter', title: 'ふゆ', subtitle: '', illustrationIds: [] },

  // ファンタジー
  { id: 'fairies', title: 'ようせい', subtitle: '', illustrationIds: [] },
  { id: 'princesses', title: 'プリンセス', subtitle: '', illustrationIds: [] },
  { id: 'monsters', title: 'モンスター', subtitle: '', illustrationIds: [] },
]

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'group-creatures',
    title: 'いきもの',
    categoryIds: ['animals', 'birds', 'fish', 'insects', 'living-things', 'amphibians', 'dinosaurs'],
  },
  { id: 'group-nature', title: 'しぜん', categoryIds: ['plants', 'weather', 'space'] },
  {
    id: 'group-food',
    title: 'たべもの',
    categoryIds: ['ringo-mikan-lemon', 'vegetables', 'sweets', 'snacks', 'food'],
  },
  { id: 'group-vehicles', title: 'のりもの', categoryIds: ['vehicles', 'trains', 'airplanes', 'ships'] },
  { id: 'group-living', title: 'くらし', categoryIds: ['home-things', 'rooms', 'tools', 'toys'] },
  {
    id: 'group-fashion',
    title: 'おしゃれ',
    categoryIds: ['clothes', 'casual-wear', 'world-costumes', 'accessories'],
  },
  {
    id: 'group-patterns',
    title: 'もよう',
    categoryIds: [
      'patterns-asia',
      'patterns-europe',
      'patterns-africa',
      'patterns-america',
      'patterns-oceania',
      'patterns',
    ],
  },
  {
    id: 'group-symbols',
    title: 'シンボル',
    categoryIds: ['flags', 'signal-flags', 'road-signs', 'safety-marks'],
  },
  { id: 'group-seasons', title: 'きせつ', categoryIds: ['spring', 'summer', 'autumn', 'winter'] },
  { id: 'group-fantasy', title: 'ファンタジー', categoryIds: ['fairies', 'princesses', 'monsters'] },
]

/** 小カテゴリーIDから、それが入っている大カテゴリーを引く */
export function findCategoryGroup(categoryId: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((group) => group.categoryIds.includes(categoryId))
}

/** 「アジア」「そのほか」のように単独ではわかりにくい名前は、一覧などでは fullTitle を使う */
export function categoryDisplayTitle(category: { title: string; fullTitle?: string }): string {
  return category.fullTitle ?? category.title
}
