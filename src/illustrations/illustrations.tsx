import type { PointerEvent, ReactNode } from 'react'
import { FLAG_DATA } from './flagData'
import { AnimalPage } from './svgs/AnimalPage'
import { Apple } from './svgs/Apple'
import { Blueberry } from './svgs/Blueberry'
import { FLAG_RASTER_CROP, FlagPage } from './svgs/FlagPage'
import { Grape } from './svgs/Grape'
import { IceBar } from './svgs/IceBar'
import { Lemon } from './svgs/Lemon'
import { Orange } from './svgs/Orange'
import { Peach } from './svgs/Peach'
import { RasterLineArt, type RasterPaintCommand } from './svgs/RasterLineArt'
import { SnackPage } from './svgs/SnackPage'
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
  subtitle: string
  illustrationIds: IllustrationId[]
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
    title: 'ガリガリくんのアイス',
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

const FLAG_ILLUSTRATIONS: IllustrationDef[] = FLAG_DATA.map((flag) => ({
  id: `flag-${flag.page}`,
  title: flag.country,
  subtitle: flag.code.toUpperCase(),
  thumbnailImage: `/lineart/flags/flag-${flag.page}.png`,
  referenceImage: `/lineart/flags-colored/flag-${flag.page}.png`,
  raster: true,
  rasterCrop: FLAG_RASTER_CROP,
  node: (props) => <FlagPage {...props} page={flag.page} title={flag.country} />,
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
  node: (props) => <SnackPage {...props} page={snack.page} title={snack.title} />,
}))

const ANIMAL_DATA = [
  { page: '01', title: 'いぬ', subtitle: 'Dog' },
  { page: '02', title: 'ねこ', subtitle: 'Cat' },
  { page: '03', title: 'うさぎ', subtitle: 'Rabbit' },
  { page: '04', title: 'ぞう', subtitle: 'Elephant' },
  { page: '05', title: 'ライオン', subtitle: 'Lion' },
  { page: '06', title: 'キリン', subtitle: 'Giraffe' },
  { page: '07', title: 'パンダ', subtitle: 'Panda' },
  { page: '08', title: 'ペンギン', subtitle: 'Penguin' },
  { page: '09', title: 'カメ', subtitle: 'Turtle' },
  { page: '10', title: 'イルカ', subtitle: 'Dolphin' },
  { page: '11', title: 'ちょう', subtitle: 'Butterfly' },
  { page: '12', title: 'カエル', subtitle: 'Frog' },
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
  referenceImage: `/lineart/animals-colored/animal-${animal.page}.png`,
  raster: true,
  node: (props) => <AnimalPage {...props} page={animal.page} title={animal.title} />,
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
  { page: '01', title: 'ちょう', subtitle: 'Butterfly' },
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
  { page: '01', title: 'フクロウ', subtitle: 'Owl' },
  { page: '02', title: 'ウミガメ', subtitle: 'Sea turtle' },
  { page: '03', title: 'カエル', subtitle: 'Frog' },
  { page: '04', title: 'カメレオン', subtitle: 'Chameleon' },
  { page: '05', title: 'オウム', subtitle: 'Parrot' },
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
  ...CLOTHES_ILLUSTRATIONS,
  ...HOME_THINGS_ILLUSTRATIONS,
  ...VEHICLE_ILLUSTRATIONS,
  ...DINOSAUR_ILLUSTRATIONS,
  ...PLANT_ILLUSTRATIONS,
  ...FOOD_CATEGORY_ILLUSTRATIONS,
  ...INSECT_ILLUSTRATIONS,
  ...TOOL_ILLUSTRATIONS,
  ...LIVING_THING_ILLUSTRATIONS,
  ...FISH_ILLUSTRATIONS,
  ...PATTERN_ILLUSTRATIONS,
]

export const ILLUSTRATION_CATEGORIES: IllustrationCategory[] = [
  {
    id: 'ringo-mikan-lemon',
    title: 'りんごみかんレモン',
    subtitle: '',
    illustrationIds: ['apple', 'orange', 'lemon', 'spinach', 'iceBar', 'blueberry', 'grape', 'peach'],
  },
  {
    id: 'animals',
    title: 'どうぶつ',
    subtitle: '',
    illustrationIds: ANIMAL_ILLUSTRATIONS.map((it) => it.id),
  },
  {
    id: 'snacks',
    title: 'おやつ・デザート',
    subtitle: '',
    illustrationIds: SNACK_ILLUSTRATIONS.map((it) => it.id),
  },
  {
    id: 'flags',
    title: '国旗',
    subtitle: '',
    illustrationIds: FLAG_ILLUSTRATIONS.map((it) => it.id),
  },
  { id: 'clothes', title: 'ようふく', subtitle: '', illustrationIds: CLOTHES_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'home-things', title: 'おうち', subtitle: '', illustrationIds: HOME_THINGS_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'plants', title: 'しょくぶつ', subtitle: '', illustrationIds: PLANT_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'insects', title: 'むし', subtitle: '', illustrationIds: INSECT_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'dinosaurs', title: 'きょうりゅう', subtitle: '', illustrationIds: DINOSAUR_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'living-things', title: 'いきもの', subtitle: '', illustrationIds: LIVING_THING_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'fish', title: 'さかな', subtitle: '', illustrationIds: FISH_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'patterns', title: 'もよう', subtitle: '', illustrationIds: PATTERN_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'vehicles', title: 'のりもの', subtitle: '', illustrationIds: VEHICLE_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'food', title: 'たべもの', subtitle: '', illustrationIds: FOOD_CATEGORY_ILLUSTRATIONS.map((it) => it.id) },
  { id: 'tools', title: 'どうぐ', subtitle: '', illustrationIds: TOOL_ILLUSTRATIONS.map((it) => it.id) },
]
