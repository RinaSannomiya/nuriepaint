import './App.css'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type MouseEvent } from 'react'
import { DEFAULT_SWATCHES, Palette } from './components/Palette'
import { IllustrationThumb } from './components/IllustrationThumb'
import { Sidebar } from './components/Sidebar'
import { CheckBadge } from './components/CheckBadge'
import { AchievementBadge, type Achievement } from './components/AchievementBadge'
import { CategoryDropdown } from './components/CategoryDropdown'
import { CategoryChips } from './components/CategoryChips'
import { GroupedLineartView } from './components/GroupedLineartView'
import { ChallengeSidebar } from './components/ChallengeSidebar'
import { DrumRoll } from './components/DrumRoll'
import { isWhiteColor } from './lib/color'
import { Stage } from './components/Stage'
import {
  CATEGORY_GROUPS,
  ILLUSTRATIONS,
  ILLUSTRATION_CATEGORIES,
  SECRET_FIRST_CATEGORY,
  SECRET_PATH,
  SECRET_TITLE_OVERRIDES,
  categoryDisplayTitle,
  findCategoryGroup,
  type IllustrationCategory,
  type IllustrationDef,
} from './illustrations/illustrations'
import { FLAG_QUIZ_DATA } from './illustrations/flagQuizData'
import { SIGNAL_FLAG_QUIZ_DATA } from './illustrations/signalFlagQuizData'
import { ROAD_SIGN_QUIZ_DATA } from './illustrations/roadSignQuizData'
import { FLAG_DIFFICULTY_DATA } from './illustrations/flagDifficultyData'
import { ILLUSTRATION_TAGS, TAG_FACETS } from './illustrations/illustrationTags'
import { RasterLineArt, type RasterPaintCommand } from './illustrations/svgs/RasterLineArt'
import { generateDefaultName } from './lib/defaultName'

// アカウント画面から開く、クイズの正解／ぬった（マイギャラリーに保存ずみ）を一覧するページの名前。名前を変えるときはここだけ直す。
const RECORD_PAGE_TITLE = 'ぬりえの記録'

// 大カテゴリーの画面で、小カテゴリーを「チップ」として出す最低枚数。これより少ない枠のぬりえは「すべて」にだけ出る。
const CATEGORY_CHIP_MIN_COUNT = 3

type FillMap = Record<string, string>
type HistoryState = {
  fillsByIllustration: Record<string, FillMap>
  undoByIllustration: Record<string, FillMap[]>
  redoByIllustration: Record<string, FillMap[]>
}
type AuthUser = {
  id: string
  email: string
  name?: string | null
  image?: string | null
}
type UserProfile = {
  motifId: string
  iconColor: string
  imageUrl: string
  updatedAt?: string
}
type SavedColoring = {
  id: string
  title: string
  illustrationId: string
  imageUrl: string
  isPublic?: boolean
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}
type PublicColoring = {
  id: string
  title: string
  illustrationId: string
  authorName?: string | null
  authorImage?: string | null
  authorProfile?: UserProfile | null
  imageUrl: string
  downloadUrl: string
  publishedAt?: string | null
  updatedAt: string
}
type UploadedLineArt = {
  id: string
  title: string
  imageUrl: string
  categoryId: string
  isLearning?: boolean
  referenceImageUrl?: string | null
  isPublic?: boolean
  publishedAt?: string | null
  createdAt: string
}
type PublicLineArt = {
  id: string
  title: string
  authorName?: string | null
  imageUrl: string
  categoryId: string
  isLearning?: boolean
  referenceImageUrl?: string | null
  added?: boolean
  publishedAt?: string | null
  createdAt: string
}
type ImagePreview = {
  title: string
  subtitle?: string
  imageUrl: string
  reportKind?: '作品' | 'ぬりえ'
  reportId?: string
  illustrationId?: string
  continueItem?: SavedColoring
}
type LibraryLineArt = {
  id: string
  lineartId: string
  title: string
  authorName?: string | null
  imageUrl: string
  categoryId: string
  isLearning?: boolean
  referenceImageUrl?: string | null
  createdAt: string
}
type ColorControlMode = 'rgb' | 'cmy' | 'hsl'
type GalleryGroupMode = 'all' | 'category'
type GallerySortBasis = 'created' | 'playlist'
type SortDirection = 'asc' | 'desc'
type PaletteSwatch = { name: string; hex: string }
type PaletteSettingsPayload = {
  swatches: PaletteSwatch[] | null
  updatedAt: string | null
}
type ProfileMotif = {
  id: string
  label: string
  imageUrl: string
}
type ViewSnapshot = {
  selected: string | null
  selectedCategoryId: string | null
  categoryReturnPage: 'play' | 'learn' | 'home'
  showPlayCatalog: boolean
  showQuizCatalog: boolean
  showCreatePage: boolean
  showSpreadPage: boolean
  showGalleryPage: boolean
  showSavedPage?: boolean
  quizSelectionArmed: boolean
  quizMode: boolean
}
type QuizConfig = {
  swatches: PaletteSwatch[]
  passingScore: number
}
type QuizResult = {
  title: string
  score: number
  total: number
  matched: number
  missing: number
  passed: boolean
}
type QuizAttempt = QuizResult & {
  id: string
  illustrationId: string
  categoryId: string
  createdAt: string
}
type RecordRow = {
  id: string
  title: string
  saved: boolean
  learned: boolean
  learnedAt: string | null
}
type RecordCategory = {
  id: string
  title: string
  rows: RecordRow[]
  savedCount: number
  learnedCount: number
}
// 大カテゴリー単位の記録。children は、その中の小カテゴリー（ぬりえがあるものだけ）
type RecordGroup = RecordCategory & { children: RecordCategory[] }
// マイギャラリー「カテゴリー別」の1区分。大カテゴリー（categories に、その中の小カテゴリー）か、「すべて」「その他」
type GallerySection = {
  id: string
  title: string
  items: SavedColoring[]
  categories?: { id: string; title: string; items: SavedColoring[] }[]
}

// チャレンジモード: カテゴリーのぬりえ一覧画面で、出題数と難易度を決めて、そのカテゴリーからランダムに出題する
type ChallengeDifficulty = 'easy' | 'normal' | 'hard'
type QuizChallenge = {
  categoryId: string
  difficulty: ChallengeDifficulty
  poolIds: string[]
  ids: string[]
  index: number
  results: boolean[]
  lastScore: number
  phase: 'answering' | 'answered' | 'finished'
}
// 出題数のよく使う候補（ドラムロールの下にボタンで並べる。「全問」はカテゴリーの問題数）
const CHALLENGE_PRESET_COUNTS = [5, 10, 20]
// 難易度ごとの出題（データは scripts/generate-flag-difficulty-data.py が作る flagDifficultyData.ts。色の種類の数と、細かさのランク S/A）
//   かんたん: 色が3色以下で、細かさのランクが S・A ではない旗
//   ふつう: 細かさが S 以外のすべて
//   むずかしい: 出題数の 10% を S（紋章など細かい旗）にして、残りは色の多い旗（5色以上）から。足りなければ4色→3色…の順に補う
// データのないぬりえ（学習用など）は「ふつう」にだけ出す（かんたん・むずかしいは選べない）
const CHALLENGE_HARD_FINE_RATIO = 0.1
const CHALLENGE_DIFFICULTIES: { id: ChallengeDifficulty; label: string }[] = [
  { id: 'easy', label: 'かんたん' },
  { id: 'normal', label: 'ふつう' },
  { id: 'hard', label: 'むずかしい' },
]

const QUIZ_CATEGORY_IDS = new Set(['flags', 'signal-flags', 'road-signs'])
const PROFILE_MOTIFS: ProfileMotif[] = [
  { id: 'boy', label: 'おとこのこ', imageUrl: '/profile-motifs/boy.png' },
  { id: 'girl', label: 'おんなのこ', imageUrl: '/profile-motifs/girl.png' },
  { id: 'apple', label: 'りんご', imageUrl: '/profile-motifs/apple.png' },
  { id: 'dinosaur', label: 'きょうりゅう', imageUrl: '/profile-motifs/dinosaur.png' },
  { id: 'teddy', label: 'ぬいぐるみ', imageUrl: '/profile-motifs/teddy.png' },
  { id: 'dots', label: 'みずたま', imageUrl: '/profile-motifs/dots.png' },
  { id: 'checker', label: 'いちまつ', imageUrl: '/profile-motifs/checker.png' },
]
const PROFILE_ICON_COLORS = ['#EF6950', '#FEB61C', '#29A2DE', '#1CB5A5', '#FDEB6A', '#AF52DE', '#FF8AC2']
const QUIZ_CONFIGS: Record<string, QuizConfig> = {
  // 国旗のクイズ用パレットは見本画像から自動生成（scripts/generate-flag-quiz-data.py）。手書きの定義は下で上書きされる
  ...FLAG_QUIZ_DATA,
  // 国際信号旗のクイズ用パレットも見本画像から自動生成（scripts/generate-signal-flag-quiz-data.py）
  ...SIGNAL_FLAG_QUIZ_DATA,
  // 道路標識のクイズ用パレットも見本画像から自動生成（scripts/generate-road-sign-quiz-data.py）
  ...ROAD_SIGN_QUIZ_DATA,
  'flag-001': {
    passingScore: 88,
    swatches: [
      { name: '青', hex: '#02529c' },
      { name: '赤', hex: '#dc1e35' },
      { name: '白', hex: '#ffffff' },
      { name: '黄', hex: '#feb61c' },
      { name: '緑', hex: '#1cb5a5' },
    ],
  },
  'flag-002': {
    passingScore: 88,
    swatches: [
      { name: '緑', hex: '#169b62' },
      { name: '白', hex: '#ffffff' },
      { name: 'オレンジ', hex: '#ff883e' },
      { name: '青', hex: '#29a2de' },
      { name: '赤', hex: '#ef6950' },
    ],
  },
  'flag-003': {
    passingScore: 88,
    swatches: [
      { name: '青', hex: '#00b5e2' },
      { name: '赤', hex: '#ef3340' },
      { name: '緑', hex: '#509e2f' },
      { name: '白', hex: '#ffffff' },
      { name: '黄', hex: '#feb61c' },
      { name: '紫', hex: '#af52de' },
    ],
  },
}
const LEARNING_QUIZ_FALLBACK_SWATCHES: PaletteSwatch[] = [
  { name: '白', hex: '#ffffff' },
  { name: '赤', hex: '#ef6950' },
  { name: '青', hex: '#29a2de' },
  { name: '黄', hex: '#feb61c' },
  { name: '緑', hex: '#1cb5a5' },
  { name: '黒', hex: '#222222' },
]
// クイズのパレットの基本の色数。正解色が少なくても、ダミー色でこの数まで補う（正解色がこれより多ければ増える）
const QUIZ_PALETTE_SIZE = 10
// ダミー色の候補。色相がばらけるように用意してあり、正解色に近い色は fillQuizSwatchesWithDummies が自動で除く
const QUIZ_DUMMY_SWATCHES: PaletteSwatch[] = [
  { name: '赤', hex: '#ef6950' },
  { name: 'オレンジ', hex: '#ff883e' },
  { name: '黄', hex: '#feb61c' },
  { name: '薄黄', hex: '#fdeb6a' },
  { name: '黄緑', hex: '#9bd24a' },
  { name: '緑', hex: '#3fae49' },
  { name: '深緑', hex: '#2e6b34' },
  { name: '青緑', hex: '#1cb5a5' },
  { name: '水色', hex: '#5bc8f2' },
  { name: '青', hex: '#29a2de' },
  { name: '紺', hex: '#23408e' },
  { name: '紫', hex: '#af52de' },
  { name: '薄紫', hex: '#c9a7f0' },
  { name: 'ピンク', hex: '#ff7ab8' },
  { name: '薄ピンク', hex: '#ffb8cf' },
  { name: 'えんじ', hex: '#8c2f39' },
  { name: '茶色', hex: '#9b6330' },
  { name: 'ベージュ', hex: '#e6c9a0' },
  { name: '灰色', hex: '#9aa0a6' },
  { name: '黒', hex: '#222222' },
]

function App() {
  const homeScrollRef = useRef<HTMLElement | null>(null)
  const savedPageReturnRef = useRef<ViewSnapshot | null>(null)
  const recordPageReturnRef = useRef<ViewSnapshot | null>(null)
  const authIconEditorRef = useRef<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [gallerySidebarScrollToken, setGallerySidebarScrollToken] = useState(0)
  // かくしページ（/ringo-mikan-lemon）で開いたときだけ、はじめの8枚のカテゴリーを最初から開く
  const [secretMode] = useState(readSecretMode)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() => (readSecretMode() ? SECRET_FIRST_CATEGORY.id : null))
  const [showPlayCatalog, setShowPlayCatalog] = useState(false)
  const [showQuizCatalog, setShowQuizCatalog] = useState(false)
  const [categoryReturnPage, setCategoryReturnPage] = useState<'play' | 'learn' | 'home'>(() => (readSecretMode() ? 'play' : 'home'))
  const [showCreatePage, setShowCreatePage] = useState(false)
  const [showSpreadPage, setShowSpreadPage] = useState(false)
  const [showGalleryPage, setShowGalleryPage] = useState(false)
  const [showSavedPage, setShowSavedPage] = useState(false)
  const [showRecordPage, setShowRecordPage] = useState(false)
  const [recordTab, setRecordTab] = useState<'learn' | 'play' | 'badge'>('learn')
  const [recordLearnCategoryId, setRecordLearnCategoryId] = useState<string | null>(null)
  const [recordPlayCategoryId, setRecordPlayCategoryId] = useState<string | null>(null)
  // 国旗の「ちいき」など、小カテゴリーの中をしぼりこむタグ（categoryId のカテゴリーを見ているときだけ有効）
  const [categoryTag, setCategoryTag] = useState<{ categoryId: string; tag: string } | null>(null)
  const [recordTag, setRecordTag] = useState<{ categoryId: string; tag: string } | null>(null)
  const [color, setColor] = useState('#EF6950')
  const [paletteDraftColor, setPaletteDraftColor] = useState(DEFAULT_SWATCHES[0].hex)
  const [selectedSwatchIndex, setSelectedSwatchIndex] = useState(0)
  const [customSwatches, setCustomSwatches] = useState<PaletteSwatch[]>(() => {
    const saved = window.localStorage.getItem('nurie-paint-swatches')
    if (!saved) return normalizePaletteSwatches(null)
    try {
      return normalizePaletteSwatches(JSON.parse(saved))
    } catch {
      return normalizePaletteSwatches(null)
    }
  })
  const [paletteSettingsReady, setPaletteSettingsReady] = useState(false)
  const [artZoom, setArtZoom] = useState(1)
  const [eyedropper, setEyedropper] = useState(false)
  const [brush, setBrush] = useState(false)
  const [restoreImage, setRestoreImage] = useState<{ url: string; seq: number } | null>(null)
  const [rasterCommand, setRasterCommand] = useState<RasterPaintCommand | null>(null)
  const [quizMode, setQuizMode] = useState(false)
  const [quizSelectionArmed, setQuizSelectionArmed] = useState(false)
  const [dynamicQuizConfigs, setDynamicQuizConfigs] = useState<Record<string, QuizConfig>>({})
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([])
  const [challengeCount, setChallengeCount] = useState(10)
  const [challengeDifficulty, setChallengeDifficulty] = useState<ChallengeDifficulty>('normal')
  const [challengeSetupOpen, setChallengeSetupOpen] = useState(false)
  const [challengeResetOpen, setChallengeResetOpen] = useState(false)
  const [challengeState, setChallengeState] = useState<QuizChallenge | null>(null)
  const [challengeQuitOpen, setChallengeQuitOpen] = useState(false)
  const challengeBusyRef = useRef(false)
  const challengeArmedRef = useRef(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  // 認証メールのリンクから戻ってきたときは、最初から該当の画面を開く
  const [verifyRedirect] = useState(readVerifyRedirect)
  const [authOpen, setAuthOpen] = useState(verifyRedirect !== null)
  const [authMode, setAuthMode] = useState<AuthMode>(verifyRedirect?.mode ?? 'signin')
  const [verifyError] = useState<string | null>(verifyRedirect?.error ?? null)
  const [verifyResendBusy, setVerifyResendBusy] = useState(false)
  const [authSentFromSignin, setAuthSentFromSignin] = useState(false)
  // パスワード再設定メールのリンクから戻ってきたときの、再設定用の合言葉（トークン）
  const [resetToken] = useState<string | null>(verifyRedirect?.token ?? null)
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState('')
  const [resetMailBusy, setResetMailBusy] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(true)
  const [authName, setAuthName] = useState('')
  // アカウント作成中に名前が空のままのとき、名前欄の下に出すメッセージ
  const [authNameError, setAuthNameError] = useState('')
  const authNameInputRef = useRef<HTMLInputElement | null>(null)
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null)
  const [accountProfileEditing, setAccountProfileEditing] = useState(false)
  // ポップアップの枠外クリックで閉じる用: 枠外で「押し始めた」ときだけ閉じる（入力欄の文字選択ドラッグが枠外で終わっても閉じないように）
  const backdropPressRef = useRef(false)
  const [accountEmailEditing, setAccountEmailEditing] = useState(false)
  const [accountEmailValue, setAccountEmailValue] = useState('')
  const [accountEmailMessage, setAccountEmailMessage] = useState('')
  const [accountPasswordOpen, setAccountPasswordOpen] = useState(false)
  const [accountPasswordMessage, setAccountPasswordMessage] = useState('')
  const [accountPasswordSent, setAccountPasswordSent] = useState(false)
  const [accountDeleteConfirmOpen, setAccountDeleteConfirmOpen] = useState(false)
  const [authMotifId, setAuthMotifId] = useState(PROFILE_MOTIFS[0].id)
  const [authIconColor, setAuthIconColor] = useState(PROFILE_ICON_COLORS[0])
  const [authIconCommand, setAuthIconCommand] = useState<RasterPaintCommand | null>(null)
  const [authIconEyedropper, setAuthIconEyedropper] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupConsent, setSignupConsent] = useState(false)
  const [status, setStatus] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryFilterIllustrationId, setGalleryFilterIllustrationId] = useState<string | null>(null)
  const [myLineartCategoryFilter, setMyLineartCategoryFilter] = useState<string | null>(null)
  const [publicLineartCategoryFilter, setPublicLineartCategoryFilter] = useState<string | null>(null)
  const [galleryGroupMode, setGalleryGroupMode] = useState<GalleryGroupMode>('all')
  const [gallerySortBasis, setGallerySortBasis] = useState<GallerySortBasis>('created')
  const [gallerySortDirection, setGallerySortDirection] = useState<SortDirection>('desc')
  const [galleryPublishFilter, setGalleryPublishFilter] = useState<'all' | 'public' | 'private'>('all')
  const [activeGalleryCategoryId, setActiveGalleryCategoryId] = useState<string | null>(null)
  const [savedColorings, setSavedColorings] = useState<SavedColoring[]>([])
  const [publicColorings, setPublicColorings] = useState<PublicColoring[]>([])
  const [publicLinearts, setPublicLinearts] = useState<PublicLineArt[]>([])
  const [libraryLinearts, setLibraryLinearts] = useState<LibraryLineArt[]>([])
  const [uploadedLinearts, setUploadedLinearts] = useState<UploadedLineArt[]>([])
  const [lineartTitle, setLineartTitle] = useState('')
  const [lineartFile, setLineartFile] = useState<File | null>(null)
  const [lineartAddCategoryById, setLineartAddCategoryById] = useState<Record<string, string>>({})
  const [lineartCategoryId, setLineartCategoryId] = useState(ILLUSTRATION_CATEGORIES[0]?.id ?? '')
  const [lineartIsLearning, setLineartIsLearning] = useState(false)
  const [lineartReferenceFile, setLineartReferenceFile] = useState<File | null>(null)
  const [uploadPreviewOpen, setUploadPreviewOpen] = useState(false)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [uploadPreviewRefUrl, setUploadPreviewRefUrl] = useState<string | null>(null)
  const [uploadPreviewShowRef, setUploadPreviewShowRef] = useState(false)
  const [uploadPreviewColor, setUploadPreviewColor] = useState('#EF6950')
  const [uploadPreviewCommand, setUploadPreviewCommand] = useState<RasterPaintCommand | null>(null)
  const [uploadPreviewBrush, setUploadPreviewBrush] = useState(false)
  const [uploadPreviewEyedropper, setUploadPreviewEyedropper] = useState(false)
  const [uploadAgreeCopyright, setUploadAgreeCopyright] = useState(false)
  const [uploadAgreePrivacy, setUploadAgreePrivacy] = useState(false)
  const [uploadAgreeDecency, setUploadAgreeDecency] = useState(false)
  // セーフティーロック（オンのあいだ、ぬりえのアップロード時にパスワードが必要）
  const [safetyLockEnabled, setSafetyLockEnabled] = useState(false)
  const [safetyLockBusy, setSafetyLockBusy] = useState(false)
  const [safetyLockOffOpen, setSafetyLockOffOpen] = useState(false)
  const [safetyLockOffPassword, setSafetyLockOffPassword] = useState('')
  const [safetyLockMessage, setSafetyLockMessage] = useState('')
  const [uploadPasswordOpen, setUploadPasswordOpen] = useState(false)
  const [uploadPassword, setUploadPassword] = useState('')
  const [uploadPasswordBusy, setUploadPasswordBusy] = useState(false)
  const [uploadPasswordError, setUploadPasswordError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SavedColoring | null>(null)
  const [lineartDeleteTarget, setLineartDeleteTarget] = useState<UploadedLineArt | null>(null)
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteEditorOpen, setPaletteEditorOpen] = useState(false)
  const [showColorSliders, setShowColorSliders] = useState(true)
  const [showColorSwatches, setShowColorSwatches] = useState(true)
  const [colorControlMode, setColorControlMode] = useState<ColorControlMode>('rgb')
  const [state, setState] = useState<HistoryState>(() => ({
      fillsByIllustration: {
        apple: {},
        orange: {},
        lemon: {},
        spinach: {},
        iceBar: {},
        blueberry: {},
        grape: {},
        peach: {},
      },
      undoByIllustration: {
        apple: [],
        orange: [],
        lemon: [],
        spinach: [],
        iceBar: [],
        blueberry: [],
        grape: [],
        peach: [],
      },
      redoByIllustration: {
        apple: [],
        orange: [],
        lemon: [],
        spinach: [],
        iceBar: [],
        blueberry: [],
        grape: [],
        peach: [],
      },
  }))

  const libraryIllustrations = useMemo<IllustrationDef[]>(() => {
    return libraryLinearts.map((lineart) => ({
      id: `library-${lineart.id}`,
      title: lineart.title,
      subtitle: lineart.authorName ? `${lineart.authorName} さんのぬりえ` : '追加したぬりえ',
      thumbnailImage: lineart.imageUrl,
      autoTrimThumbnail: true,
      referenceImage: lineart.referenceImageUrl ?? undefined,
      raster: true,
      node: (props) => (
        <RasterLineArt
          title={lineart.title}
          source={lineart.imageUrl}
          color={props.color}
          command={props.command}
          eyedropper={props.eyedropper}
          onPickColor={props.onPickColor}
          restoreImage={props.restoreImage}
        />
      ),
    }))
  }, [libraryLinearts])

  const allIllustrations = useMemo(() => {
    // かくしページの中だけ、むかしの名前（ガリガリくんのアイス）で表示する
    const builtIn = secretMode
      ? ILLUSTRATIONS.map((it) => (SECRET_TITLE_OVERRIDES[it.id] ? { ...it, title: SECRET_TITLE_OVERRIDES[it.id] } : it))
      : ILLUSTRATIONS
    return [...builtIn, ...libraryIllustrations]
  }, [libraryIllustrations, secretMode])
  const libraryByIllustrationId = useMemo(() => {
    return new Map(libraryLinearts.map((lineart) => [`library-${lineart.id}`, lineart]))
  }, [libraryLinearts])
  const playCategories = useMemo(() => {
    return mergeLibraryLineartsIntoCategories(ILLUSTRATION_CATEGORIES, libraryLinearts)
  }, [libraryLinearts])
  const learnCategories = useMemo(() => {
    return buildLearnCategories(ILLUSTRATION_CATEGORIES, libraryLinearts)
  }, [libraryLinearts])
  // 大カテゴリーごとに、中の小カテゴリー（ユーザーが追加したぬりえを含む）とイラストIDをまとめたもの
  const playGroups = useMemo(() => {
    return CATEGORY_GROUPS.map((group) => {
      const categories = group.categoryIds
        .map((id) => playCategories.find((category) => category.id === id))
        .filter((category): category is IllustrationCategory => Boolean(category))
      return { group, categories, illustrationIds: categories.flatMap((category) => category.illustrationIds) }
    })
  }, [playCategories])
  const fallbackQuizConfigs = useMemo(() => {
    return Object.fromEntries(
      libraryIllustrations
        .filter((it) => Boolean(it.referenceImage))
        .map((it) => [
          it.id,
          {
            passingScore: 88,
            swatches: LEARNING_QUIZ_FALLBACK_SWATCHES,
          } satisfies QuizConfig,
        ]),
    )
  }, [libraryIllustrations])
  const quizConfigs = useMemo(() => {
    const merged: Record<string, QuizConfig> = { ...QUIZ_CONFIGS, ...fallbackQuizConfigs, ...dynamicQuizConfigs }
    // どのクイズも、パレットは基本 QUIZ_PALETTE_SIZE 色（正解色が少ないときはダミー色で補う）
    return Object.fromEntries(
      Object.entries(merged).map(([id, config]) => [
        id,
        { ...config, swatches: fillQuizSwatchesWithDummies(config.swatches, `${id}:dummy-fill`) } satisfies QuizConfig,
      ]),
    ) as Record<string, QuizConfig>
  }, [dynamicQuizConfigs, fallbackQuizConfigs])

  const selectedDef = useMemo(() => {
    if (!selected) return null
    return allIllustrations.find((it) => it.id === selected) ?? null
  }, [allIllustrations, selected])

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    if (secretMode && selectedCategoryId === SECRET_FIRST_CATEGORY.id) return SECRET_FIRST_CATEGORY
    // 大カテゴリーの「すべて」（IDは group- で始まる）。中の小カテゴリーのぬりえを順に並べる
    if (isGroupCategoryId(selectedCategoryId)) {
      const entry = playGroups.find((it) => it.group.id === selectedCategoryId)
      return entry ? { id: entry.group.id, title: entry.group.title, subtitle: '', illustrationIds: entry.illustrationIds } : null
    }
    const categories = categoryReturnPage === 'learn' ? learnCategories : playCategories
    return categories.find((category) => category.id === selectedCategoryId) ?? null
  }, [categoryReturnPage, learnCategories, playCategories, playGroups, secretMode, selectedCategoryId])
  // 大カテゴリーの「すべて」を開いているか（ぬりえテスト・チャレンジは小カテゴリーごとなので、ここでは出さない）
  const viewingGroupAll = Boolean(selectedCategory && selectedCategoryId && isGroupCategoryId(selectedCategoryId))
  // いま開いているカテゴリーが属する大カテゴリーと、そこに並べるチップ（すべて＋3枚以上の小カテゴリー）
  const categoryChipBar = useMemo(() => {
    if (!selectedCategory || !selectedCategoryId || categoryReturnPage === 'learn') return null
    if (secretMode && selectedCategoryId === SECRET_FIRST_CATEGORY.id) return null
    const groupId = isGroupCategoryId(selectedCategoryId) ? selectedCategoryId : findCategoryGroup(selectedCategoryId)?.id
    const entry = playGroups.find((it) => it.group.id === groupId)
    if (!entry) return null
    const chips = entry.categories.filter((category) => category.illustrationIds.length >= CATEGORY_CHIP_MIN_COUNT || category.id === selectedCategoryId)
    // 小カテゴリーのチップが1つもない大カテゴリーは、チップの行を出さない（「すべて」だけになるため）。
    // チップが1つだけで、その中身が「すべて」と同じ（大カテゴリーのぬりえがすべてその小カテゴリーにある）ときも、出しても切り替わらないので出さない
    if (chips.length === 0) return null
    if (chips.length === 1 && chips[0].illustrationIds.length === entry.illustrationIds.length) return null
    return { groupId: entry.group.id, chips }
  }, [categoryReturnPage, playGroups, secretMode, selectedCategory, selectedCategoryId])

  // 国旗のちいき・国際信号旗のしゅるいなど、小カテゴリーの中をしぼりこむタグ。中に2種類以上のタグがあるカテゴリーだけチップを出す
  // （大カテゴリーの「すべて」では出さない。ユーザーが追加したぬりえにはタグがないので、しぼりこむと出なくなる）
  const categoryTagBar = useMemo(() => {
    if (!selectedCategory || viewingGroupAll) return null
    const facet = TAG_FACETS[selectedCategory.id]
    if (!facet) return null
    const tags = facet.tags.filter((tag) => selectedCategory.illustrationIds.some((id) => ILLUSTRATION_TAGS[id] === tag.id))
    return tags.length >= 2 ? { ariaLabel: facet.ariaLabel, tags } : null
  }, [selectedCategory, viewingGroupAll])
  const selectedTag = categoryTagBar && categoryTag && categoryTag.categoryId === selectedCategory?.id ? categoryTag.tag : null
  const selectedTagLabel = selectedTag ? categoryTagBar?.tags.find((tag) => tag.id === selectedTag)?.label ?? null : null

  const categoryIllustrations = useMemo(() => {
    if (!selectedCategory) return []
    return selectedCategory.illustrationIds
      .filter((id) => !selectedTag || ILLUSTRATION_TAGS[id] === selectedTag)
      .map((id) => allIllustrations.find((it) => it.id === id))
      .filter((it): it is IllustrationDef => Boolean(it))
  }, [allIllustrations, selectedCategory, selectedTag])
  const selectedCategoryHasQuiz = useMemo(() => {
    if (viewingGroupAll) return false
    return Boolean(selectedCategory?.illustrationIds.some((id) => quizConfigs[id]))
  }, [quizConfigs, selectedCategory, viewingGroupAll])
  const displayedCategoryIllustrations = useMemo(() => {
    if (!quizSelectionArmed) return categoryIllustrations
    return categoryIllustrations.filter((it) => Boolean(quizConfigs[it.id]) || Boolean(it.referenceImage))
  }, [categoryIllustrations, quizConfigs, quizSelectionArmed])

  const quizCategories = useMemo(() => learnCategories, [learnCategories])
  // あそぶ／ホームのカテゴリー一覧は「大カテゴリー」のカード。まなぶは、これまで通り小カテゴリー（国旗など）のカードを、大カテゴリーの見出しの下に並べる。
  // イラストが0枚の枠・大カテゴリーは出さない
  const catalogItems = useMemo(() => {
    const items: CatalogItem[] = []
    let index = 0
    if (showQuizCatalog) {
      let lastGroupId: string | null = null
      for (const category of quizCategories) {
        if (category.illustrationIds.length === 0) continue
        const group = findCategoryGroup(category.id)
        if (group && group.id !== lastGroupId) items.push({ type: 'group', id: group.id, title: group.title })
        lastGroupId = group?.id ?? null
        items.push({ type: 'category', category, index })
        index += 1
      }
      return items
    }
    if (secretMode) {
      items.push({ type: 'category', category: SECRET_FIRST_CATEGORY, index })
      index += 1
    }
    for (const entry of playGroups) {
      if (entry.illustrationIds.length === 0) continue
      items.push({
        type: 'category',
        // カードの絵は、小カテゴリーごとの先頭から1枚ずつ選んで、いろいろな種類が見えるようにする
        category: { id: entry.group.id, title: entry.group.title, subtitle: '', illustrationIds: pickPreviewIds(entry.categories) },
        index,
      })
      index += 1
    }
    return items
  }, [playGroups, quizCategories, secretMode, showQuizCatalog])
  const lpPreviewIllustrations = useMemo(() => {
    return ['apple', 'snack-05', 'flag-001']
      .map((id) => ILLUSTRATIONS.find((it) => it.id === id))
      .filter((it): it is IllustrationDef => Boolean(it))
  }, [])
  const lpTryRandomIllustration = useMemo(() => {
    const candidates = ILLUSTRATIONS.filter((it) => Boolean(it.thumbnailImage) && !it.referenceImage)
    if (!candidates.length) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }, [])

  const fills = selected ? state.fillsByIllustration[selected] ?? {} : {}
  const selectedQuiz = selected ? quizConfigs[selected] ?? null : null
  const illustrationById = useMemo(() => new Map(allIllustrations.map((it) => [it.id, it])), [allIllustrations])
  // いま開いているカテゴリーから、チャレンジで出せる問題
  const challengePoolIds = useMemo(() => {
    if (!selectedCategory || viewingGroupAll) return []
    return selectedCategory.illustrationIds.filter((id) => (!selectedTag || ILLUSTRATION_TAGS[id] === selectedTag) && quizConfigs[id] && illustrationById.get(id)?.referenceImage)
  }, [illustrationById, quizConfigs, selectedCategory, selectedTag, viewingGroupAll])
  // 難易度ごとの出題プール。プールが空の難易度（学習用のかんたん・むずかしいなど）は選べない
  const challengePools = useMemo(() => buildChallengePools(challengePoolIds), [challengePoolIds])
  const challengePoolSizes = useMemo<Record<ChallengeDifficulty, number>>(() => ({
    easy: challengePools.easy.length,
    normal: challengePools.normal.length,
    hard: challengePools.hardFine.length + challengePools.hardRest.length,
  }), [challengePools])
  const challengeEffectiveDifficulty: ChallengeDifficulty = challengePoolSizes[challengeDifficulty] > 0 ? challengeDifficulty : 'normal'
  // チャレンジ中の問題を開いている間だけ有効（別のぬりえを開いたら自然に無効になる）
  const challenge = challengeState && (challengeState.phase === 'finished' || (quizMode && selected === challengeState.ids[challengeState.index])) ? challengeState : null
  const challengeRunning = challenge !== null && challenge.phase !== 'finished'
  const challengeLabel = challenge && challengeRunning
    ? `${challenge.index + 1} / ${challenge.ids.length}問目 ・ 正解 ${challenge.results.filter(Boolean).length}問`
    : undefined
  const selectedQuizSwatches = useMemo(() => {
    if (!selected || !selectedQuiz) return null
    return shuffleQuizSwatches(selectedQuiz.swatches, `${selected}:quiz-palette`)
  }, [selected, selectedQuiz])
  const activeSwatches = quizMode && selectedQuizSwatches ? selectedQuizSwatches : customSwatches
  const learnedQuizIds = useMemo(() => new Set(quizAttempts.filter((attempt) => attempt.passed).map((attempt) => attempt.illustrationId)), [quizAttempts])
  // はじめてクイズに正解した日時（合格した挑戦のうち、いちばん古いもの）。挑戦はすべて DB に残っているので、これまでの分もさかのぼって出せる
  const firstLearnedAtById = useMemo(() => {
    const firstAt = new Map<string, string>()
    for (const attempt of quizAttempts) {
      if (!attempt.passed) continue
      const current = firstAt.get(attempt.illustrationId)
      if (!current || new Date(attempt.createdAt).getTime() < new Date(current).getTime()) firstAt.set(attempt.illustrationId, attempt.createdAt)
    }
    return firstAt
  }, [quizAttempts])
  // マイギャラリーに作品を保存しているぬりえ
  const savedIllustrationIds = useMemo(() => new Set(savedColorings.map((item) => item.illustrationId)), [savedColorings])
  // クイズモードがオンのときは「クイズに正解した（緑）」、オフのときは「マイギャラリーに保存した（コーラルレッド）」チェックを出す
  const checkKind = quizSelectionArmed ? 'learned' : 'saved'
  const checkedIds = quizSelectionArmed ? learnedQuizIds : savedIllustrationIds
  // 「ぬりえの記録」ページ用: カテゴリーごとに、ぬりえ全部の「ぬった（マイギャラリーに保存ずみ）」「クイズせいかい」を並べる
  const recordLearnCategories = useMemo(
    () => buildRecordCategories(learnCategories, (id) => Boolean(quizConfigs[id]), illustrationById, savedIllustrationIds, learnedQuizIds, firstLearnedAtById),
    [firstLearnedAtById, illustrationById, learnCategories, learnedQuizIds, quizConfigs, savedIllustrationIds],
  )
  const recordPlayCategories = useMemo(
    () => buildRecordCategories(playCategories, () => true, illustrationById, savedIllustrationIds, learnedQuizIds, firstLearnedAtById),
    [firstLearnedAtById, illustrationById, learnedQuizIds, playCategories, savedIllustrationIds],
  )
  const recordLearnGroups = useMemo(() => buildRecordGroups(recordLearnCategories), [recordLearnCategories])
  const recordPlayGroups = useMemo(() => buildRecordGroups(recordPlayCategories), [recordPlayCategories])
  // バッジ（達成記録）。「はじめて」系は、その行動をとったことがあるかどうかだけを見る
  const achievements = useMemo(
    () => buildAchievements(recordPlayGroups, recordLearnCategories, savedIllustrationIds, savedColorings.length > 0, learnedQuizIds.size > 0, uploadedLinearts.length > 0),
    [learnedQuizIds, recordLearnCategories, recordPlayGroups, savedColorings.length, savedIllustrationIds, uploadedLinearts.length],
  )
  const earnedAchievements = useMemo(() => achievements.filter((achievement) => achievement.earned), [achievements])
  const colorModeDescription = {
    rgb: 'RGBは光の三原色。液晶画面の色と同じように、赤・緑・青の光を重ねて色を作ります。',
    cmy: 'CMYは色の三原色。絵の具を混ぜる感覚に近く、シアン・マゼンタ・イエローで色を作ります。',
    hsl: 'HSVは色相・彩度・明るさ。色み、あざやかさ、明るさを分けて調整できます。',
  }[colorControlMode]
  const settingsPreviewDescription = showColorSliders ? colorModeDescription : 'カラーパレットのみ表示します。'

  const myLineartSections = useMemo(() => {
    return ILLUSTRATION_CATEGORIES
      .map((category) => ({
        id: category.id,
        title: categoryDisplayTitle(category),
        items: uploadedLinearts.filter((item) => item.categoryId === category.id),
      }))
      .filter((section) => section.items.length > 0)
  }, [uploadedLinearts])

  const publicLineartSections = useMemo(() => {
    return ILLUSTRATION_CATEGORIES
      .map((category) => ({
        id: category.id,
        title: categoryDisplayTitle(category),
        items: publicLinearts.filter((item) => item.categoryId === category.id),
      }))
      .filter((section) => section.items.length > 0)
  }, [publicLinearts])

  const savedGallerySections = useMemo<GallerySection[]>(() => {
    const illustrationOrder = new Map(ILLUSTRATIONS.map((it, index) => [it.id, index]))
    const categoryOrderIndex = new Map(ILLUSTRATION_CATEGORIES.map((category, index) => [category.id, index]))
    const itemSorter = (left: SavedColoring, right: SavedColoring) => {
      const direction = gallerySortDirection === 'asc' ? 1 : -1
      if (gallerySortBasis === 'created') {
        const diff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        if (diff !== 0) return diff * direction
      } else {
        const leftOrder = illustrationOrder.get(left.illustrationId) ?? Number.MAX_SAFE_INTEGER
        const rightOrder = illustrationOrder.get(right.illustrationId) ?? Number.MAX_SAFE_INTEGER
        if (leftOrder !== rightOrder) return (leftOrder - rightOrder) * direction
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    }

    const filteredColorings = galleryPublishFilter === 'all'
      ? savedColorings
      : savedColorings.filter((item) => (galleryPublishFilter === 'public' ? Boolean(item.isPublic) : !item.isPublic))

    if (galleryGroupMode === 'all') {
      return [
        {
          id: 'all',
          title: 'すべて',
          items: [...filteredColorings].sort(itemSorter),
        },
      ]
    }

    const categorySections = ILLUSTRATION_CATEGORIES.map((category) => {
      const items = filteredColorings
        .filter((item) => category.illustrationIds.includes(item.illustrationId))
        .sort(itemSorter)
      return { id: category.id, title: categoryDisplayTitle(category), items }
    })
      .filter((section) => section.items.length > 0)
      .sort((left, right) => (categoryOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (categoryOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER))

    const unknownItems = filteredColorings
      .filter((item) => !ILLUSTRATION_CATEGORIES.some((category) => category.illustrationIds.includes(item.illustrationId)))
      .sort(itemSorter)

    // 大カテゴリーごとにまとめる（その中の小カテゴリーは categories に持たせて、チップで切り替える）
    const groupSections: GallerySection[] = CATEGORY_GROUPS.map((group) => {
      const categories = group.categoryIds
        .map((id) => categorySections.find((section) => section.id === id))
        .filter((section): section is (typeof categorySections)[number] => Boolean(section))
      return { id: group.id, title: group.title, items: categories.flatMap((section) => section.items).sort(itemSorter), categories }
    }).filter((section) => (section.categories?.length ?? 0) > 0)

    return unknownItems.length ? [...groupSections, { id: 'unknown', title: 'その他', items: unknownItems }] : groupSections
  }, [galleryGroupMode, galleryPublishFilter, gallerySortBasis, gallerySortDirection, savedColorings])

  const savedGalleryTotalCount = useMemo(
    () => savedGallerySections.reduce((sum, section) => sum + section.items.length, 0),
    [savedGallerySections],
  )

  // 「カテゴリー別」で開いている大カテゴリー（activeGalleryCategoryId は、大カテゴリーか小カテゴリーのID）
  const activeGalleryGroup = useMemo(() => {
    if (galleryGroupMode !== 'category') return null
    return savedGallerySections.find((section) => section.id === activeGalleryCategoryId || section.categories?.some((category) => category.id === activeGalleryCategoryId))
      ?? savedGallerySections[0] ?? null
  }, [activeGalleryCategoryId, galleryGroupMode, savedGallerySections])
  // いま表示しているぬりえの区分（大カテゴリーの全部、またはチップで選んだ小カテゴリー）
  const activeGallerySection = useMemo(() => {
    if (galleryGroupMode !== 'category') return savedGallerySections[0] ?? null
    if (!activeGalleryGroup) return null
    return activeGalleryGroup.categories?.find((category) => category.id === activeGalleryCategoryId) ?? activeGalleryGroup
  }, [activeGalleryCategoryId, activeGalleryGroup, galleryGroupMode, savedGallerySections])

  const refreshMe = useCallback(async (): Promise<AuthUser | null> => {
    const res = await fetch('/api/me', { credentials: 'include' })
    if (!res.ok) return null
    if (!isJsonResponse(res)) return null
    const data = (await res.json()) as { user: AuthUser | null; profile?: UserProfile | null; safetyLock?: boolean }
    setAuthUser(data.user)
    setSafetyLockEnabled(Boolean(data.user && data.safetyLock))
    setAuthName(data.user?.name ?? '')
    setAuthProfile(data.profile ?? null)
    if (data.profile) {
      setAuthMotifId(data.profile.motifId)
      setAuthIconColor(data.profile.iconColor)
    }
    return data.user
  }, [])

  const loadQuizProgress = useCallback(async () => {
    const res = await fetch('/api/quiz-progress', { credentials: 'include' })
    if (!res.ok || !isJsonResponse(res)) return
    const data = (await res.json()) as { attempts?: QuizAttempt[] }
    setQuizAttempts(data.attempts ?? [])
  }, [])

  useEffect(() => {
    // Session state is loaded from the Worker once when the app starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshMe()
  }, [refreshMe])

  useEffect(() => {
    // 認証メールのリンクから戻ってきたときの目印（?verify=...）は、画面を開いたあと URL から消す。
    if (verifyRedirect) window.history.replaceState(null, '', window.location.pathname)
  }, [verifyRedirect])

  useEffect(() => {
    if (!authUser) {
      setQuizAttempts([])
      return
    }
    void loadQuizProgress()
  }, [authUser, loadQuizProgress])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 2400)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    window.localStorage.setItem('nurie-paint-swatches', JSON.stringify(customSwatches))
    if (!authUser || !paletteSettingsReady) return undefined

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void savePaletteSettingsToAccount(customSwatches, controller.signal)
    }, 500)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [authUser, customSwatches, paletteSettingsReady])

  useEffect(() => {
    let cancelled = false

    async function syncPaletteSettings() {
      if (!authUser) {
        setPaletteSettingsReady(false)
        return
      }

      setPaletteSettingsReady(false)
      const res = await fetch('/api/palette-settings', { credentials: 'include' })
      if (cancelled) return

      if (!res.ok || !isJsonResponse(res)) {
        setPaletteSettingsReady(true)
        return
      }

      const data = (await res.json()) as PaletteSettingsPayload
      if (cancelled) return

      if (data.swatches?.length) {
        const accountSwatches = normalizePaletteSwatches(data.swatches)
        setCustomSwatches(accountSwatches)
        setPaletteDraftColor(accountSwatches[selectedSwatchIndex]?.hex ?? accountSwatches[0]?.hex ?? '#29A2DE')
      } else {
        await savePaletteSettingsToAccount(customSwatches)
      }
      if (!cancelled) setPaletteSettingsReady(true)
    }

    void syncPaletteSettings()

    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  // 一覧やぬりえ画面でチェックマークを出すため、保存済みの作品を（ログイン画面などを出さずに）読み込んでおく
  useEffect(() => {
    if (!authUser || !(selectedCategoryId || showQuizCatalog)) return
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/colorings', { credentials: 'include' }).catch(() => null)
      if (!res || !res.ok || !isJsonResponse(res)) return
      const data = (await res.json()) as { colorings: SavedColoring[] }
      if (!cancelled) setSavedColorings(data.colorings)
    })()
    return () => {
      cancelled = true
    }
  }, [authUser, selectedCategoryId, showQuizCatalog])

  useEffect(() => {
    if (!authUser) return
    if (showCreatePage) void loadLinearts()
    if (showPlayCatalog || showQuizCatalog || showSpreadPage || showSavedPage || showRecordPage || galleryOpen) void loadLibraryLinearts()
    if (showSpreadPage) void loadLinearts()
    if (showSavedPage || showRecordPage) void loadGallery({ openModal: false })
  }, [authUser, galleryOpen, showCreatePage, showPlayCatalog, showQuizCatalog, showRecordPage, showSavedPage, showSpreadPage])

  useEffect(() => {
    let cancelled = false
    const learningItems = libraryIllustrations.filter((it) => it.referenceImage)
    if (!learningItems.length) {
      setDynamicQuizConfigs({})
      return
    }

    void Promise.all(learningItems.map(async (it) => {
      const swatches = await extractQuizSwatchesFromImage(it.referenceImage!)
      return [
        it.id,
        {
          passingScore: 88,
          swatches,
        } satisfies QuizConfig,
      ] as const
    })).then((entries) => {
      if (!cancelled) setDynamicQuizConfigs(Object.fromEntries(entries))
    }).catch(() => {
      if (!cancelled) setDynamicQuizConfigs({})
    })

    return () => {
      cancelled = true
    }
  }, [libraryIllustrations])

  useEffect(() => {
    if (selected) setMobilePaletteOpen(true)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0 })
      document.scrollingElement?.scrollTo({ top: 0, left: 0 })
      homeScrollRef.current?.scrollTo({ top: 0, left: 0 })
    })
  }, [selected, selectedCategoryId, showPlayCatalog, showQuizCatalog, showCreatePage, showSpreadPage, showGalleryPage, showSavedPage, showRecordPage])

  function chooseIllustration(id: string, opts?: { scrollSidebarToTop?: boolean; forceQuiz?: boolean; challenge?: boolean }) {
    // かくしページから選んだときは、左カラムの一覧もはじめの8枚の並びのままにする
    const inSecretCategory = secretMode && selectedCategoryId === SECRET_FIRST_CATEGORY.id && SECRET_FIRST_CATEGORY.illustrationIds.includes(id)
    // いま開いているカテゴリー（小カテゴリーでも大カテゴリーの「すべて」でも）にそのぬりえがあるときは、そのまま使う
    const currentViewHasIt = Boolean(selectedCategoryId && selectedCategory?.illustrationIds.includes(id))
    const inLearn = showQuizCatalog || categoryReturnPage === 'learn'
    const nextViewId = inSecretCategory
      ? SECRET_FIRST_CATEGORY.id
      : currentViewHasIt
        ? selectedCategoryId
        : inLearn
          ? playCategories.find((it) => it.illustrationIds.includes(id))?.id ?? null
          : categoryViewIdFor(id)
    // ちいきなどのタグは、開いたぬりえがそのタグの中にあるときだけ引き継ぐ（マイギャラリーなど別の場所から開いたときは「すべて」にもどす）
    setCategoryTag((current) => (current && nextViewId === current.categoryId && ILLUSTRATION_TAGS[id] === current.tag ? current : null))
    if (nextViewId) {
      if (nextViewId !== selectedCategoryId && !opts?.challenge) {
        setCategoryReturnPage(showQuizCatalog ? 'learn' : 'play')
      }
      setSelectedCategoryId(nextViewId)
    }
    // あそぶのカテゴリー一覧やLPなど、サイドバーの外からこのイラストを選んだときは
    // 左カラムのイラスト一覧もそのイラストが一番上に来るようスクロールする。
    // すでに編集中でサイドバー自体をクリックした場合(SidebarのonSelect経由)は
    // opts.scrollSidebarToTop = false が渡ってくるのでスクロールしない。
    if (opts?.scrollSidebarToTop !== false) {
      setGallerySidebarScrollToken((token) => token + 1)
    }
    const nextQuizConfig = quizConfigs[id]
    const nextQuiz = Boolean((opts?.forceQuiz || quizSelectionArmed) && nextQuizConfig)
    if (opts?.forceQuiz) setQuizSelectionArmed(true)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowRecordPage(false)
    setRestoreImage(null)
    setArtZoom(1)
    setEyedropper(false)
    setBrush(false)
    setSelected(id)
    setQuizResult(null)
    if (!opts?.challenge) setChallengeState(null)
    setQuizMode(nextQuiz)
    if (nextQuiz && nextQuizConfig) {
      setColor(shuffleQuizSwatches(nextQuizConfig.swatches, `${id}:quiz-palette`)[0]?.hex ?? nextQuizConfig.swatches[0].hex)
      resetIllustration(id)
    }
  }

  function goHome() {
    setSelected(null)
    setSelectedCategoryId(null)
    setCategoryTag(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizSelectionArmed(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  // ぬりえを開くときに、左カラムの一覧として使うカテゴリー。3枚以上ある小カテゴリーはそのまま、それより少ない枠は大カテゴリーの「すべて」にする
  function categoryViewIdFor(illustrationId: string): string | null {
    const category = playCategories.find((it) => it.illustrationIds.includes(illustrationId))
    if (!category) return null
    if (category.illustrationIds.length >= CATEGORY_CHIP_MIN_COUNT) return category.id
    return findCategoryGroup(category.id)?.id ?? category.id
  }

  // 大カテゴリーの画面のチップ（すべて／小カテゴリー）を切り替える
  function chooseCategoryChip(id: string) {
    setSelected(null)
    setSelectedCategoryId(id)
    setCategoryTag(null)
    setQuizSelectionArmed(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  function chooseCategory(id: string) {
    setCategoryReturnPage(showQuizCatalog ? 'learn' : showPlayCatalog ? 'play' : 'home')
    setSelected(null)
    setSelectedCategoryId(id)
    setCategoryTag(null)
    setQuizSelectionArmed(showQuizCatalog && Boolean(learnCategories.find((category) => category.id === id)))
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  // ぬりえの編集画面から、いま見ていたカテゴリーのぬりえ一覧（小カテゴリー、または大カテゴリーの「すべて」）にもどる。
  // カテゴリーがないとき（LPから開いたときなど）は、カテゴリー選択の画面にもどる。
  function backToCategoryList() {
    if (!selectedCategory) {
      backToCategorySelection()
      return
    }
    setSelected(null)
    setQuizMode(false)
    setQuizResult(null)
  }

  function backToCategorySelection() {
    setSelected(null)
    setSelectedCategoryId(null)
    setCategoryTag(null)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizMode(false)
    setQuizResult(null)

    if (categoryReturnPage === 'learn') {
      setShowPlayCatalog(false)
      setShowQuizCatalog(true)
      setQuizSelectionArmed(true)
      return
    }

    if (categoryReturnPage === 'play') {
      setShowPlayCatalog(true)
      setShowQuizCatalog(false)
      setQuizSelectionArmed(false)
      return
    }

    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setQuizSelectionArmed(false)
  }

  function openPlayCatalog() {
    if (authUser) void loadLibraryLinearts()
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(true)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizSelectionArmed(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  function openQuizCatalog() {
    if (authUser) void loadLibraryLinearts()
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(true)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizSelectionArmed(true)
    setQuizMode(false)
    setQuizResult(null)
  }

  async function openSpreadPage() {
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(true)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    await Promise.all([
      loadPublicLinearts(),
      authUser ? loadLinearts() : Promise.resolve(),
      authUser ? loadLibraryLinearts() : Promise.resolve(),
    ])
  }

  async function openGalleryPage(opts?: { illustrationId?: string }) {
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(true)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setGalleryFilterIllustrationId(opts?.illustrationId ?? null)
    await loadPublicColorings()
  }

  function viewCommunityForIllustration(illustrationId: string) {
    setImagePreview(null)
    void openGalleryPage({ illustrationId })
  }

  async function openSavedPage(opts?: { rememberReturn?: boolean }) {
    savedPageReturnRef.current = opts?.rememberReturn && !showSavedPage ? captureCurrentView() : null
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(true)
    setShowRecordPage(false)
    await loadGallery({ openModal: false })
  }

  function closeSavedPage() {
    const snapshot = savedPageReturnRef.current
    savedPageReturnRef.current = null
    if (!snapshot) {
      goHome()
      return
    }
    setSelected(snapshot.selected)
    setSelectedCategoryId(snapshot.selectedCategoryId)
    setCategoryReturnPage(snapshot.categoryReturnPage)
    setShowPlayCatalog(snapshot.showPlayCatalog)
    setShowQuizCatalog(snapshot.showQuizCatalog)
    setShowCreatePage(snapshot.showCreatePage)
    setShowSpreadPage(snapshot.showSpreadPage)
    setShowGalleryPage(snapshot.showGalleryPage)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizSelectionArmed(snapshot.quizSelectionArmed)
    setQuizMode(snapshot.quizMode)
    setQuizResult(null)
  }

  function openRecordPage(opts?: { rememberReturn?: boolean }) {
    recordPageReturnRef.current = opts?.rememberReturn && !showRecordPage ? captureCurrentView() : null
    setAuthOpen(false)
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(true)
    setQuizSelectionArmed(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  function closeRecordPage() {
    const snapshot = recordPageReturnRef.current
    recordPageReturnRef.current = null
    if (!snapshot) {
      goHome()
      return
    }
    setSelected(snapshot.selected)
    setSelectedCategoryId(snapshot.selectedCategoryId)
    setCategoryReturnPage(snapshot.categoryReturnPage)
    setShowPlayCatalog(snapshot.showPlayCatalog)
    setShowQuizCatalog(snapshot.showQuizCatalog)
    setShowCreatePage(snapshot.showCreatePage)
    setShowSpreadPage(snapshot.showSpreadPage)
    setShowGalleryPage(snapshot.showGalleryPage)
    setShowSavedPage(snapshot.showSavedPage ?? false)
    setShowRecordPage(false)
    setQuizSelectionArmed(snapshot.quizSelectionArmed)
    setQuizMode(snapshot.quizMode)
    setQuizResult(null)
  }

  // 一覧のタイトルから、そのぬりえを開く（クイズの一覧ならクイズモードで、あそぶの一覧なら通常のぬりえで）
  function openIllustrationFromRecord(id: string, opts?: { quiz?: boolean }) {
    recordPageReturnRef.current = null
    chooseIllustration(id, opts?.quiz ? { forceQuiz: true } : undefined)
    setCategoryReturnPage(opts?.quiz ? 'learn' : 'play')
  }

  function captureCurrentView(): ViewSnapshot {
    return {
      selected,
      selectedCategoryId,
      categoryReturnPage,
      showPlayCatalog,
      showQuizCatalog,
      showCreatePage,
      showSpreadPage,
      showGalleryPage,
      showSavedPage,
      quizSelectionArmed,
      quizMode,
    }
  }

  function setRegionColor(regionId: string, nextColor: string, opts?: { erase?: boolean }) {
    if (!selected) return
    setState((prev) => {
      const currentFills = prev.fillsByIllustration[selected] ?? {}
      const nextFills: FillMap = { ...currentFills }
      if (opts?.erase) {
        delete nextFills[regionId]
      } else {
        nextFills[regionId] = nextColor
      }

      const nextUndo = [...prev.undoByIllustration[selected], currentFills].slice(-50)
      return {
        fillsByIllustration: {
          ...prev.fillsByIllustration,
          [selected]: nextFills,
        },
        undoByIllustration: {
          ...prev.undoByIllustration,
          [selected]: nextUndo,
        },
        redoByIllustration: {
          ...prev.redoByIllustration,
          [selected]: [],
        },
      }
    })
  }

  function undo() {
    if (!selected) return
    if (selectedDef?.raster) {
      setRasterCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'undo' }))
      return
    }
    setState((prev) => {
      const stack = prev.undoByIllustration[selected] ?? []
      const last = stack[stack.length - 1]
      if (!last) return prev
      const currentFills = prev.fillsByIllustration[selected] ?? {}
      return {
        fillsByIllustration: {
          ...prev.fillsByIllustration,
          [selected]: last,
        },
        undoByIllustration: {
          ...prev.undoByIllustration,
          [selected]: stack.slice(0, -1),
        },
        redoByIllustration: {
          ...prev.redoByIllustration,
          [selected]: [...(prev.redoByIllustration[selected] ?? []), currentFills].slice(-50),
        },
      }
    })
  }

  function redo() {
    if (!selected) return
    if (selectedDef?.raster) {
      setRasterCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'redo' }))
      return
    }
    setState((prev) => {
      const stack = prev.redoByIllustration[selected] ?? []
      const next = stack[stack.length - 1]
      if (!next) return prev
      const currentFills = prev.fillsByIllustration[selected] ?? {}
      return {
        fillsByIllustration: {
          ...prev.fillsByIllustration,
          [selected]: next,
        },
        undoByIllustration: {
          ...prev.undoByIllustration,
          [selected]: [...(prev.undoByIllustration[selected] ?? []), currentFills].slice(-50),
        },
        redoByIllustration: {
          ...prev.redoByIllustration,
          [selected]: stack.slice(0, -1),
        },
      }
    })
  }

  function reset() {
    if (!selected) return
    setQuizResult(null)
    if (selectedDef?.raster) {
      setRasterCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'reset' }))
      return
    }
    setState((prev) => ({
      fillsByIllustration: { ...prev.fillsByIllustration, [selected]: {} },
      undoByIllustration: { ...prev.undoByIllustration, [selected]: [] },
      redoByIllustration: { ...prev.redoByIllustration, [selected]: [] },
    }))
  }

  function resetIllustration(id: string) {
    const illustration = allIllustrations.find((it) => it.id === id)
    if (illustration?.raster) {
      setRasterCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'reset' }))
      return
    }
    setState((prev) => ({
      fillsByIllustration: { ...prev.fillsByIllustration, [id]: {} },
      undoByIllustration: { ...prev.undoByIllustration, [id]: [] },
      redoByIllustration: { ...prev.redoByIllustration, [id]: [] },
    }))
  }

  function startQuizMode() {
    if (!selected || !selectedQuiz) return
    setQuizMode(true)
    setQuizSelectionArmed(true)
    setQuizResult(null)
    setColor(selectedQuizSwatches?.[0]?.hex ?? selectedQuiz.swatches[0].hex)
    resetIllustration(selected)
    setStatus('クイズモードを開始しました。')
  }

  function exitQuizMode() {
    setQuizMode(false)
    setQuizResult(null)
    setStatus('ぬりえモードに切り替えました。')
  }

  async function completeQuiz() {
    if (!selected || !selectedDef?.referenceImage || !selectedQuiz) return
    // チャレンジ中の答え合わせは1回だけ（連打しても1問として数える）
    const inChallenge = challenge?.phase === 'answering'
    if (inChallenge) {
      if (challengeBusyRef.current) return
      challengeBusyRef.current = true
    }
    setStatus('答え合わせ中...')
    const result = await evaluateRasterQuiz(selectedDef.referenceImage, selectedDef.title, selectedQuiz.passingScore, selectedDef.rasterCrop).catch(() => null)
    if (!result) {
      challengeBusyRef.current = false
      setStatus('答え合わせできませんでした。')
      return
    }
    if (inChallenge) {
      const answeredId = selected
      setChallengeState((prev) => (
        prev && prev.phase === 'answering' && prev.ids[prev.index] === answeredId
          ? { ...prev, results: [...prev.results, result.passed], lastScore: result.score, phase: 'answered' }
          : prev
      ))
      challengeBusyRef.current = false
    } else {
      setQuizResult(result)
    }
    if (authUser) {
      await saveQuizAttempt(selected, selectedDef.title, result)
      await loadQuizProgress()
    }
    setStatus(result.passed ? '正解です！' : 'あと少しです。')
  }

  async function saveQuizAttempt(illustrationId: string, title: string, result: QuizResult) {
    const categoryId = learnCategories.find((category) => category.illustrationIds.includes(illustrationId))?.id ?? selectedCategory?.id ?? 'learning'
    await fetch('/api/quiz-attempts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        illustrationId,
        categoryId,
        title,
        score: result.score,
        total: result.total,
        matched: result.matched,
        missing: result.missing,
        passed: result.passed,
      }),
    }).catch(() => null)
  }

  function startChallenge() {
    const pool = challengePoolIds
    const difficulty = challengeEffectiveDifficulty
    const poolSize = challengePoolSizes[difficulty]
    if (!pool.length || !poolSize || !selectedCategory) return
    const count = Math.max(1, Math.min(challengeCount, poolSize))
    const ids = pickChallengeQuestions(pool, difficulty, count, savedIllustrationIds)
    challengeBusyRef.current = false
    challengeArmedRef.current = quizSelectionArmed
    setChallengeQuitOpen(false)
    setChallengeResetOpen(false)
    setChallengeSetupOpen(false)
    setChallengeState({ categoryId: selectedCategory.id, difficulty, poolIds: pool, ids, index: 0, results: [], lastScore: 0, phase: 'answering' })
    chooseIllustration(ids[0], { forceQuiz: true, challenge: true, scrollSidebarToTop: false })
  }

  function nextChallengeQuestion() {
    if (!challenge || challenge.phase !== 'answered') return
    const nextIndex = challenge.index + 1
    if (nextIndex >= challenge.ids.length) {
      setChallengeState({ ...challenge, phase: 'finished' })
      return
    }
    challengeBusyRef.current = false
    setChallengeState({ ...challenge, index: nextIndex, phase: 'answering' })
    chooseIllustration(challenge.ids[nextIndex], { forceQuiz: true, challenge: true, scrollSidebarToTop: false })
  }

  function restartChallenge() {
    if (!challenge) return
    const ids = pickChallengeQuestions(challenge.poolIds, challenge.difficulty, challenge.ids.length, savedIllustrationIds)
    challengeBusyRef.current = false
    setChallengeResetOpen(false)
    setChallengeState({ ...challenge, ids, index: 0, results: [], lastScore: 0, phase: 'answering' })
    chooseIllustration(ids[0], { forceQuiz: true, challenge: true, scrollSidebarToTop: false })
  }

  // チャレンジを終えて（またはやめて）、始めた一覧画面に戻る
  function exitChallenge() {
    const current = challenge
    challengeBusyRef.current = false
    setChallengeState(null)
    setChallengeQuitOpen(false)
    setChallengeResetOpen(false)
    if (!current) {
      openQuizCatalog()
      return
    }
    setSelected(null)
    setSelectedCategoryId(current.categoryId)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizMode(false)
    setQuizSelectionArmed(challengeArmedRef.current)
    setQuizResult(null)
  }

  function goToNextQuizChallenge() {
    if (selected) {
      const category = learnCategories.find((it) => it.illustrationIds.includes(selected))
      if (category) {
        // 同じカテゴリーの中で、いまのぬりえの次にあるクイズ対象のぬりえへ直接移動する
        const nextId = category.illustrationIds
          .slice(category.illustrationIds.indexOf(selected) + 1)
          .find((id) => Boolean(quizConfigs[id]) && (!selectedTag || ILLUSTRATION_TAGS[id] === selectedTag))
        if (nextId) {
          setSelectedCategoryId(category.id)
          chooseIllustration(nextId, { forceQuiz: true })
          return
        }
      }
      // 最後のぬりえまで来たときは、これまで通りカテゴリーのぬりえ一覧に戻る
      const categoryId = category?.id ?? selectedCategoryId
      if (categoryId) setSelectedCategoryId(categoryId)
    }
    setSelected(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(true)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setQuizMode(false)
    setQuizSelectionArmed(true)
    setQuizResult(null)
  }

  async function submitAuth(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    // パスワード再設定まわりの画面は、Enter キーや送信ボタンでそれぞれの処理に進む
    if (authMode === 'forgot') {
      await sendPasswordResetFromForm()
      return
    }
    if (authMode === 'resetPassword') {
      await submitNewPassword()
      return
    }
    if (authMode === 'verifyError') {
      await resendVerificationEmail()
      return
    }
    if (authMode === 'signupProfile' || (authMode === 'profile' && accountProfileEditing)) {
      if (!requireAuthName()) return
    }
    setStatus('処理中...')
    if (authMode === 'profile' || authMode === 'signupProfile') {
      const isSignupProfile = authMode === 'signupProfile'
      const wasEditingProfile = accountProfileEditing
      const saved = await saveProfile()
      if (isSignupProfile && !saved) {
        setAuthNameError('保存できませんでした。もう一度お試しください。')
        setStatus('')
        return
      }
      await refreshMe()
      if (isSignupProfile) {
        setAuthNameError('')
        setAuthMode('signupComplete')
        setAccountProfileEditing(false)
        setStatus('')
        return
      }
      if (wasEditingProfile) {
        setAccountProfileEditing(false)
        setStatus('')
        return
      }
      setAuthOpen(false)
      setStatus('')
      return
    }
    const isSignup = authMode === 'signup'
    if (isSignup && authPassword !== signupPasswordConfirm) {
      setStatus('確認用パスワードが一致していません。')
      return
    }
    if (isSignup && !signupConsent) {
      setStatus('利用規約とプライバシーポリシーへの同意が必要です。')
      return
    }
    const endpoint = authMode === 'signup' ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email'
    const payload =
      authMode === 'signup'
        ? { name: authName.trim() || generateDefaultName(), email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword }
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!isSignup && res.status === 403) {
      // メールアドレスの確認がまだのアカウント。サーバー側で確認メールを再送している。
      const body = (await res.json().catch(() => null)) as { code?: string } | null
      if (body?.code === 'EMAIL_NOT_VERIFIED') {
        setAuthSentFromSignin(true)
        setAuthMode('signupSent')
        setAuthPassword('')
        setStatus('')
        return
      }
    }
    if (!res.ok || !isJsonResponse(res)) {
      setStatus(isSignup ? '登録できませんでした。入力内容を確認して、もう一度お試しください。' : 'ログイン情報を確認してください。')
      return
    }
    if (isSignup) {
      // メール認証が済むまでログイン状態にはならない。確認メールのリンクを開くと、その先の画面に進む。
      setAuthSentFromSignin(false)
      setAuthMode('signupSent')
      setSignupPasswordConfirm('')
      setSignupConsent(false)
      setAuthPassword('')
      setStatus('')
      return
    }
    await refreshMe()
    setAuthOpen(false)
    setAuthPassword('')
    setStatus('')
  }

  async function deleteAccount() {
    if (!authUser) return
    setStatus('アカウントを削除しています...')
    const res = await fetch('/api/account', {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('アカウント削除に失敗しました。')
      return
    }
    setAuthUser(null)
    setAuthProfile(null)
    setSavedColorings([])
    setPublicColorings([])
    setPublicLinearts([])
    setLibraryLinearts([])
    setUploadedLinearts([])
    setQuizAttempts([])
    setAuthOpen(false)
    setAccountDeleteConfirmOpen(false)
    setAuthMode('signin')
    setStatus('アカウントを削除しました。')
  }

  async function saveProfile() {
    const canvas = authIconEditorRef.current?.querySelector<HTMLCanvasElement>('.rasterCanvas')
    const blob = canvas ? await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')) : null
    const form = new FormData()
    form.set('motifId', authMotifId)
    form.set('iconColor', authIconColor)
    form.set('name', authName)
    if (blob) form.set('iconImage', blob, `${authMotifId}-profile.png`)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      credentials: 'include',
      body: form,
    })
    if (!res.ok || !isJsonResponse(res)) return false
    const data = (await res.json()) as { profile: UserProfile | null }
    setAuthProfile(data.profile)
    if (authMode === 'profile') setAccountProfileEditing(false)
    return true
  }

  async function signOut() {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    })
    setAuthUser(null)
    setAuthProfile(null)
    setSavedColorings([])
    setPublicColorings([])
    setPublicLinearts([])
    setLibraryLinearts([])
    setUploadedLinearts([])
    setAuthOpen(false)
    setMobileMenuOpen(false)
    setGalleryOpen(false)
    goHome()
  }

  async function saveColoring() {
    if (!selected || !selectedDef) return
    if (!authUser) {
      setAuthMode('signin')
      setAuthOpen(true)
      setStatus('保存するにはログインしてください。')
      return
    }
    const canvas = document.querySelector<HTMLCanvasElement>('.stage .rasterCanvas')
    if (!canvas) {
      setStatus('保存できる塗り絵が見つかりません。')
      return
    }
    setStatus('保存中...')
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) {
      setStatus('画像の作成に失敗しました。')
      return
    }
    const form = new FormData()
    form.set('title', selectedDef.title)
    form.set('illustrationId', selected)
    form.set('image', blob, `${selected}.png`)
    const res = await fetch('/api/colorings', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('保存に失敗しました。')
      return
    }
    setStatus('保存しました。')
    // 保存済みの一覧を更新する（チェックマークにも反映される）
    await loadGallery({ openModal: false })
  }

  async function loadGallery(opts?: { openModal?: boolean }) {
    if (!authUser) {
      setAuthMode('signin')
      setAuthOpen(true)
      setStatus('保存した塗り絵を見るにはログインしてください。')
      return
    }
    const res = await fetch('/api/colorings', { credentials: 'include' })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('保存済みの取得に失敗しました。')
      return
    }
    const data = (await res.json()) as { colorings: SavedColoring[] }
    setSavedColorings(data.colorings)
    if (opts?.openModal !== false) setGalleryOpen(true)
  }

  async function loadPublicColorings() {
    const res = await fetch('/api/public-colorings')
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('公開ぬりえの取得に失敗しました。')
      return
    }
    const data = (await res.json()) as { colorings: PublicColoring[] }
    setPublicColorings(data.colorings)
  }

  async function loadLinearts() {
    if (!authUser) return
    const res = await fetch('/api/linearts', { credentials: 'include' })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('アップロード済みぬりえの取得に失敗しました。')
      return
    }
    const data = (await res.json()) as { linearts: UploadedLineArt[] }
    setUploadedLinearts(data.linearts)
  }

  async function loadPublicLinearts() {
    const res = await fetch('/api/public-linearts', { credentials: 'include' })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('公開ぬりえ素材の取得に失敗しました。')
      return
    }
    const data = (await res.json()) as { linearts: PublicLineArt[] }
    setPublicLinearts(data.linearts)
  }

  async function loadLibraryLinearts() {
    if (!authUser) {
      setLibraryLinearts([])
      return
    }
    const res = await fetch('/api/library-linearts', { credentials: 'include' })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('追加したぬりえの取得に失敗しました。')
      return
    }
    const data = (await res.json()) as { linearts: LibraryLineArt[] }
    setLibraryLinearts(data.linearts)
  }

  function getLineartAddCategoryId(lineartId: string) {
    return lineartAddCategoryById[lineartId] ?? ILLUSTRATION_CATEGORIES[0]?.id ?? ''
  }

  function updateLineartAddCategory(lineartId: string, categoryId: string) {
    setLineartAddCategoryById((current) => ({ ...current, [lineartId]: categoryId }))
  }

  async function addLineartToPlay(lineart: Pick<PublicLineArt | UploadedLineArt, 'id'>) {
    if (!authUser) {
      setAuthMode('signin')
      setAuthOpen(true)
      setStatus('ぬりえを追加するにはログインしてください。')
      return
    }
    const categoryId = getLineartAddCategoryId(lineart.id)
    if (!categoryId) {
      setStatus('追加先のカテゴリーを選んでください。')
      return
    }
    const res = await fetch('/api/library-linearts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineartId: lineart.id, categoryId }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('あそぶへの追加に失敗しました。')
      return
    }
    setStatus('あそぶに追加しました。')
    await Promise.all([loadLibraryLinearts(), loadPublicLinearts()])
  }

  async function removeLineartFromPlay(lineart: LibraryLineArt) {
    const res = await fetch(`/api/library-linearts/${lineart.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('あそぶから削除できませんでした。')
      return
    }
    setLibraryLinearts((items) => items.filter((item) => item.id !== lineart.id))
    if (selected === `library-${lineart.id}`) {
      setSelected(null)
      setSelectedCategoryId('library-linearts')
    }
    setStatus('あそぶから削除しました。')
  }

  async function toggleLineartPublish(item: UploadedLineArt) {
    const nextPublic = !item.isPublic
    const res = await fetch(`/api/linearts/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic: nextPublic }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('ぬりえ素材の公開設定を変更できませんでした。')
      return
    }
    const data = (await res.json()) as { isPublic: boolean; publishedAt: string | null }
    setUploadedLinearts((items) => items.map((lineart) => lineart.id === item.id ? { ...lineart, isPublic: data.isPublic, publishedAt: data.publishedAt } : lineart))
    setStatus(data.isPublic ? 'ぬりえ素材を公開しました。' : 'ぬりえ素材を非公開にしました。')
    await loadPublicLinearts()
  }

  async function updateUploadedLineartCategory(item: UploadedLineArt, categoryId: string) {
    const res = await fetch(`/api/linearts/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('カテゴリーを変更できませんでした。')
      return
    }
    const data = (await res.json()) as { categoryId: string }
    setUploadedLinearts((items) => items.map((lineart) => lineart.id === item.id ? { ...lineart, categoryId: data.categoryId } : lineart))
    setLibraryLinearts((items) => items.map((lineart) => lineart.lineartId === item.id ? { ...lineart, categoryId: data.categoryId } : lineart))
    setStatus('カテゴリーを変更しました。')
  }

  async function deleteUploadedLineart() {
    if (!lineartDeleteTarget) return
    const target = lineartDeleteTarget
    setStatus('ぬりえを削除しています...')
    const res = await fetch(`/api/linearts/${target.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('ぬりえの削除に失敗しました。')
      return
    }

    const removedLibraryIds = libraryLinearts
      .filter((lineart) => lineart.lineartId === target.id)
      .map((lineart) => lineart.id)
    setUploadedLinearts((items) => items.filter((item) => item.id !== target.id))
    setPublicLinearts((items) => items.filter((item) => item.id !== target.id))
    setLibraryLinearts((items) => items.filter((item) => item.lineartId !== target.id))
    if (selected && removedLibraryIds.includes(selected.replace(/^library-/, ''))) {
      setSelected(null)
    }
    setImagePreview((preview) => (preview?.reportKind === 'ぬりえ' && preview.reportId === target.id ? null : preview))
    setLineartDeleteTarget(null)
    setStatus('ぬりえを削除しました。')
  }

  function renderLineartPublishToggle(item: UploadedLineArt) {
    return (
      <button
        className={`publishToggle ${item.isPublic ? 'publishToggleOn' : 'publishToggleOff'}`}
        type="button"
        role="switch"
        aria-checked={Boolean(item.isPublic)}
        onClick={() => toggleLineartPublish(item)}
      >
        <span className="publishToggleTrack" aria-hidden="true">
          <span className="publishToggleKnob" />
        </span>
        <span>{item.isPublic ? '公開中' : '非公開'}</span>
      </button>
    )
  }

  async function uploadLineart(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!authUser) {
      setAuthMode('signin')
      setAuthOpen(true)
      setStatus('アップロードするにはログインしてください。')
      return
    }
    if (!lineartFile) {
      setStatus('画像ファイルを選んでください。')
      return
    }
    if (!lineartCategoryId) {
      setStatus('カテゴリーを選んでください。')
      return
    }
    if (lineartIsLearning && !lineartReferenceFile) {
      setStatus('学習用ぬりえには見本画像を登録してください。')
      return
    }
    const lineartHasColor = await lineartFileHasColor(lineartFile).catch(() => false)
    if (lineartHasColor) {
      setStatus('色が入っている画像は登録できません。白黒の線画をアップロードしてください。')
      return
    }
    setUploadPreviewUrl(URL.createObjectURL(lineartFile))
    setUploadPreviewRefUrl(lineartIsLearning && lineartReferenceFile ? URL.createObjectURL(lineartReferenceFile) : null)
    setUploadPreviewShowRef(false)
    setUploadPreviewColor('#EF6950')
    setUploadPreviewCommand(null)
    setUploadPreviewBrush(false)
    setUploadPreviewEyedropper(false)
    setUploadAgreeCopyright(false)
    setUploadAgreePrivacy(false)
    setUploadAgreeDecency(false)
    setUploadPasswordOpen(false)
    setUploadPassword('')
    setUploadPasswordError('')
    setUploadPreviewOpen(true)
  }

  function closeUploadPreview() {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    if (uploadPreviewRefUrl) URL.revokeObjectURL(uploadPreviewRefUrl)
    setUploadPreviewUrl(null)
    setUploadPreviewRefUrl(null)
    setUploadPreviewOpen(false)
    setUploadPasswordOpen(false)
    setUploadPassword('')
    setUploadPasswordError('')
  }

  // 確認画面の「アップロードする」を押したとき。セーフティーロックがオンならパスワード入力を挟む
  function requestUploadLineart() {
    if (authUser && safetyLockEnabled) {
      setUploadPassword('')
      setUploadPasswordError('')
      setUploadPasswordOpen(true)
      return
    }
    void confirmUploadLineart()
  }

  function closeUploadPasswordDialog() {
    if (uploadPasswordBusy) return
    setUploadPasswordOpen(false)
    setUploadPassword('')
    setUploadPasswordError('')
  }

  // password を渡したときは、パスワード入力画面を出したまま送信し、成功するまで確認画面を閉じない
  async function confirmUploadLineart(password?: string) {
    if (!lineartFile) return
    const withPassword = password !== undefined
    if (withPassword) {
      setUploadPasswordBusy(true)
      setUploadPasswordError('')
    } else {
      setUploadPreviewOpen(false)
      setStatus('アップロード中...')
    }
    const form = new FormData()
    form.set('title', lineartTitle || lineartFile.name.replace(/\.[^.]+$/, ''))
    form.set('image', lineartFile)
    form.set('categoryId', lineartCategoryId)
    form.set('isPublic', 'false')
    form.set('isLearning', String(lineartIsLearning))
    if (lineartIsLearning && lineartReferenceFile) form.set('referenceImage', lineartReferenceFile)
    if (withPassword) form.set('password', password)
    const res = await fetch('/api/linearts', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).catch(() => null)
    if (withPassword) setUploadPasswordBusy(false)
    // パスワードが必要・違う・試しすぎのときは、確認画面を残したままパスワード入力に戻す
    const rejected = res && !res.ok && isJsonResponse(res)
      ? ((await res.json().catch(() => null)) as { code?: string; error?: string } | null)
      : null
    if (rejected?.code === 'PASSWORD_REQUIRED' || rejected?.code === 'PASSWORD_INVALID' || rejected?.code === 'TOO_MANY_ATTEMPTS') {
      setSafetyLockEnabled(true)
      setUploadPreviewOpen(true)
      setUploadPasswordOpen(true)
      setUploadPassword('')
      setUploadPasswordError(withPassword ? rejected.error ?? 'パスワードが違います。' : '')
      setStatus('')
      return
    }
    if (withPassword && (!res || !res.ok || !isJsonResponse(res))) {
      setUploadPasswordError('アップロードに失敗しました。もう一度お試しください。')
      return
    }
    if (withPassword) {
      setUploadPasswordOpen(false)
      setUploadPassword('')
      setUploadPreviewOpen(false)
    }
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    if (uploadPreviewRefUrl) URL.revokeObjectURL(uploadPreviewRefUrl)
    setUploadPreviewUrl(null)
    setUploadPreviewRefUrl(null)
    if (!res || !res.ok || !isJsonResponse(res)) {
      setStatus('アップロードに失敗しました。')
      return
    }
    const data = (await res.json()) as { lineart: UploadedLineArt }
    setUploadedLinearts((items) => [data.lineart, ...items])
    setLineartTitle('')
    setLineartFile(null)
    setLineartIsLearning(false)
    setLineartReferenceFile(null)
    setStatus('アップロードして、あそぶに追加しました。')
    if (showSpreadPage) await Promise.all([loadLibraryLinearts(), loadPublicLinearts()])
  }

  function replaceSelectedPaletteColor() {
    setCustomSwatches((swatches) => swatches.map((swatch, index) => (
      index === selectedSwatchIndex ? { ...swatch, hex: paletteDraftColor } : swatch
    )))
    setStatus('パレットの色を置き換えました。')
  }

  async function savePaletteSettingsToAccount(swatches: PaletteSwatch[], signal?: AbortSignal) {
    if (!authUser) return
    await fetch('/api/palette-settings', {
      method: 'PUT',
      credentials: 'include',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ swatches: normalizePaletteSwatches(swatches) }),
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error(error)
    })
  }

  async function togglePublish(item: SavedColoring) {
    const nextPublic = !item.isPublic
    if (nextPublic && isLearningColoring(item.illustrationId)) {
      setStatus('まなぶのぬりえは公開できません。')
      return
    }
    const res = await fetch(`/api/colorings/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic: nextPublic }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('公開設定の変更に失敗しました。')
      return
    }
    const data = (await res.json()) as { isPublic: boolean; publishedAt: string | null }
    setSavedColorings((items) => items.map((saved) => saved.id === item.id ? { ...saved, isPublic: data.isPublic, publishedAt: data.publishedAt } : saved))
    setStatus(data.isPublic ? '公開しました。' : '非公開にしました。')
    if (showSpreadPage) await loadPublicColorings()
  }

  function renderPublishToggle(item: SavedColoring) {
    const isLearning = isLearningColoring(item.illustrationId)
    if (isLearning) return null

    return (
      <button
        className={`publishToggle ${item.isPublic ? 'publishToggleOn' : 'publishToggleOff'}`}
        type="button"
        role="switch"
        aria-checked={Boolean(item.isPublic)}
        onClick={() => togglePublish(item)}
      >
        <span className="publishToggleTrack" aria-hidden="true">
          <span className="publishToggleKnob" />
        </span>
        <span>{item.isPublic ? '公開中' : '非公開'}</span>
      </button>
    )
  }

  function isLearningColoring(illustrationId: string) {
    if (illustrationId.startsWith('flag-') || illustrationId.startsWith('signal-flag-')) return true
    const lineart = libraryByIllustrationId.get(illustrationId)
    return Boolean(lineart?.isLearning)
  }

  async function deleteColoring() {
    if (!deleteTarget) return
    setStatus('削除中...')
    const res = await fetch(`/api/colorings/${deleteTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('削除に失敗しました。')
      return
    }
    setSavedColorings((items) => items.filter((item) => item.id !== deleteTarget.id))
    setDeleteTarget(null)
    setStatus('削除しました。')
  }

  // 暗い背景（ポップアップの枠外）をクリックしたら閉じる。オーバーレイ自身の onMouseDown / onClick に展開して使う。
  function backdropCloseProps(onClose: () => void) {
    return {
      onMouseDown: (ev: MouseEvent<HTMLDivElement>) => {
        const el = ev.currentTarget
        const rect = el.getBoundingClientRect()
        // 背景そのものを押したときだけ対象（ポップアップ内は対象外）。スクロールバー上の操作も対象外
        const onScrollbar = ev.clientX - rect.left >= el.clientWidth || ev.clientY - rect.top >= el.clientHeight
        backdropPressRef.current = ev.target === el && !onScrollbar
      },
      onClick: (ev: MouseEvent<HTMLDivElement>) => {
        const pressedOnBackdrop = backdropPressRef.current
        backdropPressRef.current = false
        if (pressedOnBackdrop && ev.target === ev.currentTarget) onClose()
      },
    }
  }

  function continueColoring(item: SavedColoring) {
    const illustration = allIllustrations.find((it) => it.id === item.illustrationId)
    if (!illustration) {
      setStatus('この塗り絵の元イラストが見つかりません。')
      return
    }
    const nextViewId = categoryViewIdFor(item.illustrationId)
    if (nextViewId) {
      setSelectedCategoryId(nextViewId)
      setCategoryReturnPage('play')
    }
    const restoreSeq = Date.now()
    setRestoreImage(null)
    setSelected(item.illustrationId)
    setGallerySidebarScrollToken((token) => token + 1)
    setArtZoom(1)
    setEyedropper(false)
    setBrush(false)
    setShowSavedPage(false)
    setShowRecordPage(false)
    setGalleryOpen(false)
    setImagePreview(null)
    window.requestAnimationFrame(() => {
      setRestoreImage({ url: `${item.imageUrl}?restore=${restoreSeq}`, seq: restoreSeq })
    })
    setStatus('保存済みから開きました。')
  }

  function renderSavedGalleryControls(className = '') {
    return (
      <div className={`galleryControlStack ${className}`}>
        <div className="galleryControlGroup" role="group" aria-label="保存済みの表示">
          <span className="galleryControlLabel">表示</span>
          <button className={`segmentButton ${galleryGroupMode === 'all' ? 'activeSegment' : ''}`} type="button" onClick={() => setGalleryGroupMode('all')}>
            すべて
          </button>
          <button
            className={`segmentButton ${galleryGroupMode === 'category' ? 'activeSegment' : ''}`}
            type="button"
            onClick={() => {
              setGalleryGroupMode('category')
              setActiveGalleryCategoryId((current) => current ?? savedGallerySections[0]?.id ?? null)
            }}
          >
            カテゴリー別
          </button>
        </div>
        <div className="galleryControlGroup" role="group" aria-label="保存済みの並び順">
          <span className="galleryControlLabel">並び</span>
          <button className={`segmentButton ${gallerySortBasis === 'created' ? 'activeSegment' : ''}`} type="button" onClick={() => setGallerySortBasis('created')}>
            作成日順
          </button>
          <button className={`segmentButton ${gallerySortBasis === 'playlist' ? 'activeSegment' : ''}`} type="button" onClick={() => setGallerySortBasis('playlist')}>
            ぬりえ順
          </button>
          <button
            className="segmentButton directionButton"
            type="button"
            onClick={() => setGallerySortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}
            aria-label={`並び順を${gallerySortDirection === 'asc' ? '降順' : '昇順'}に切り替え`}
            title={`並び順を${gallerySortDirection === 'asc' ? '降順' : '昇順'}に切り替え`}
          >
            {gallerySortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <div className="galleryControlGroup" role="group" aria-label="公開状態で絞り込み">
          <span className="galleryControlLabel">公開</span>
          <button className={`segmentButton ${galleryPublishFilter === 'all' ? 'activeSegment' : ''}`} type="button" onClick={() => setGalleryPublishFilter('all')}>
            すべて
          </button>
          <button className={`segmentButton ${galleryPublishFilter === 'public' ? 'activeSegment' : ''}`} type="button" onClick={() => setGalleryPublishFilter('public')}>
            公開中
          </button>
          <button className={`segmentButton ${galleryPublishFilter === 'private' ? 'activeSegment' : ''}`} type="button" onClick={() => setGalleryPublishFilter('private')}>
            非公開
          </button>
        </div>
        <span className="galleryTotalCount">{savedGalleryTotalCount}件</span>
      </div>
    )
  }

  // マイギャラリー「カテゴリー別」: 表示するカテゴリーは1つだけ。プルダウンで切り替える（PC・タブレット・スマホ共通）
  function renderSavedGalleryCategoryPicker(className = '') {
    if (galleryGroupMode !== 'category' || !savedGallerySections.length) return null
    const group = activeGalleryGroup
    const chipCategories = group?.categories ?? []
    return (
      <>
        <div className={`galleryCategoryPicker ${className}`}>
          <span className="galleryControlLabel">カテゴリー</span>
          <CategoryDropdown
            ariaLabel="カテゴリーを選ぶ"
            value={group?.id ?? null}
            options={savedGallerySections.map((section) => ({ id: section.id, label: section.title, count: section.items.length }))}
            onChange={setActiveGalleryCategoryId}
          />
        </div>
        {group && chipCategories.length >= 2 ? (
          <CategoryChips
            compact
            className={`galleryCategoryChips ${className}`}
            ariaLabel={`${group.title}をしぼりこむ`}
            activeId={activeGallerySection && activeGallerySection.id !== group.id ? activeGallerySection.id : null}
            allNote={group.items.length}
            items={chipCategories.map((category) => ({ id: category.id, label: categoryShortTitle(category.id, category.title), note: category.items.length }))}
            onChange={(id) => setActiveGalleryCategoryId(id ?? group.id)}
          />
        ) : null}
      </>
    )
  }

  function renderChallengeButton() {
    if (!challengePoolIds.length) return null
    return (
      <button className="btn challengeModeButton" type="button" onClick={() => setChallengeSetupOpen(true)}>
        ぬりえテスト
      </button>
    )
  }

  function renderChallengeSetupModal() {
    if (!challengeSetupOpen || !selectedCategory) return null
    if (!challengePoolIds.length) return null
    const difficulty = challengeEffectiveDifficulty
    const poolSize = challengePoolSizes[difficulty]
    if (!poolSize) return null
    const count = Math.max(1, Math.min(challengeCount, poolSize))
    const changeCount = (value: number) => setChallengeCount(Math.max(1, Math.min(poolSize, Math.round(value))))
    // ドラムロールのほかに、よく使う出題数をワンタップで選べるようにする（カテゴリーの問題数より少ないものだけ）
    const presetCounts = CHALLENGE_PRESET_COUNTS.filter((n) => n < poolSize)
    return (
      <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="ぬりえテスト">
        <div className="modal challengeSetupPanel">
          <div className="modalHead">
            <div>
              <div className="modalTitle">ぬりえテスト</div>
              <div className="modalSub">「{categoryDisplayTitle(selectedCategory)}{selectedTagLabel ? `（${selectedTagLabel}）` : ''}」からランダムに出題！何問つづけて正解できるかな？</div>
            </div>
            <button className="btn iconButton quizResultCloseButton" type="button" onClick={() => setChallengeSetupOpen(false)} aria-label="閉じる" title="閉じる">
              <span aria-hidden="true" />
            </button>
          </div>
          <div className="challengeSetupBody">
            <section className="challengeSetupSection" aria-labelledby="challenge-count-label">
              <div className="challengeSetupLabel">
                <span id="challenge-count-label">出題数</span>
              </div>
              <div className="challengeDial">
                <button className="btn challengeDialStep" type="button" onClick={() => changeCount(count - 1)} disabled={count <= 1} aria-label="1問へらす">−</button>
                <DrumRoll min={1} max={poolSize} value={count} onChange={changeCount} unit="問" label="出題数" />
                <button className="btn challengeDialStep" type="button" onClick={() => changeCount(count + 1)} disabled={count >= poolSize} aria-label="1問ふやす">＋</button>
              </div>
              <div className="challengePresets" role="radiogroup" aria-label="出題数をえらぶ">
                {presetCounts.map((n) => (
                  <button key={n} className="challengePresetChip" type="button" role="radio" aria-checked={count === n} onClick={() => changeCount(n)}>
                    {n}問
                  </button>
                ))}
                <button className="challengePresetChip" type="button" role="radio" aria-checked={count === poolSize} onClick={() => changeCount(poolSize)}>
                  全問
                </button>
              </div>
            </section>
            <section className="challengeSetupSection" aria-labelledby="challenge-difficulty-label">
              <div className="challengeSetupLabel">
                <span id="challenge-difficulty-label">むずかしさ</span>
              </div>
              <div className="challengeDifficulty" role="radiogroup" aria-labelledby="challenge-difficulty-label">
                {CHALLENGE_DIFFICULTIES.map((option) => (
                  <label className="challengeDifficultyOption" key={option.id}>
                    <input
                      type="radio"
                      name="challenge-difficulty"
                      checked={difficulty === option.id}
                      disabled={challengePoolSizes[option.id] === 0}
                      onChange={() => setChallengeDifficulty(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </section>
            <button className="btn primaryAction challengeStartButton" type="button" onClick={startChallenge}>
              スタート
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderChallengeModals() {
    if (challengeQuitOpen && challengeRunning) {
      return (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="ぬりえテストをやめる">
          <div className="modal quizResultPanel challengeResultPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">ぬりえテストをやめますか？</div>
              </div>
            </div>
            <div className="quizResultBody">
              <p>ここまでのぬりえテストの結果はなくなります。</p>
              <div className="challengeResultActions">
                <button className="btn primaryAction" type="button" onClick={() => setChallengeQuitOpen(false)}>
                  つづける
                </button>
                <button className="btn" type="button" onClick={exitChallenge}>
                  やめる
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    if (challengeResetOpen && challengeRunning) {
      return (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="ぬりえテストをやりなおす">
          <div className="modal quizResultPanel challengeResultPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">1問目からやりなおしますか？</div>
              </div>
            </div>
            <div className="quizResultBody">
              <p>
                ここまでの結果はなくなります。<br />
                問題は同じ出題数で新しく選びなおします。
              </p>
              <div className="challengeResultActions">
                <button className="btn primaryAction" type="button" onClick={restartChallenge}>
                  やりなおす
                </button>
                <button className="btn" type="button" onClick={() => setChallengeResetOpen(false)}>
                  つづける
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    if (!challenge || challenge.phase === 'answering') return null
    const total = challenge.ids.length
    const correct = challenge.results.filter(Boolean).length
    if (challenge.phase === 'answered') {
      const lastCorrect = challenge.results[challenge.results.length - 1] === true
      const isLast = challenge.index + 1 >= total
      return (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="ぬりえテストの判定結果">
          <div className="modal quizResultPanel challengeResultPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">{challenge.index + 1} / {total}問目</div>
              </div>
            </div>
            <div className="quizResultBody">
              <div className={`quizScoreBadge ${lastCorrect ? 'passedQuiz' : ''}`}>
                {lastCorrect ? '正解！' : `${challenge.lastScore}%`}
              </div>
              <p>{lastCorrect ? 'よくできました！' : 'ざんねん！'}</p>
              <div className="quizResultStats challengeStatsTwo">
                <span>正解 {correct}問</span>
                <span>のこり {total - challenge.index - 1}問</span>
              </div>
              <button className="btn primaryAction quizNextButton" type="button" onClick={nextChallengeQuestion}>
                {isLast ? '結果を見る' : '次の問題へ'}
              </button>
            </div>
          </div>
        </div>
      )
    }
    const perfect = correct === total
    return (
      <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="ぬりえテスト結果">
        <div className="modal quizResultPanel challengeResultPanel">
          <div className="modalHead">
            <div>
              <div className="modalTitle">ぬりえテスト結果</div>
            </div>
          </div>
          <div className="quizResultBody">
            <div className={`quizScoreBadge ${perfect ? 'passedQuiz' : ''} ${total >= 100 ? 'longScore' : ''}`}>
              {correct}/{total}
            </div>
            <p>{perfect ? 'ぜんぶ正解！パーフェクト！' : `${total}問中 ${correct}問 正解でした。`}</p>
            <div className="quizResultStats challengeStatsTwo">
              <span>正解 {correct}問</span>
              <span>まちがい {total - correct}問</span>
            </div>
            <div className="challengeResultActions">
              <button className="btn primaryAction quizNextButton" type="button" onClick={restartChallenge}>
                もういちど挑戦
              </button>
              <button className="btn" type="button" onClick={exitChallenge}>
                一覧にもどる
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderQuizModeSwitch() {
    return (
      <label className="quizModeSwitch">
        <span>クイズモード</span>
        <input type="checkbox" checked={quizSelectionArmed} onChange={(ev) => setQuizSelectionArmed(ev.target.checked)} />
        <i aria-hidden="true" />
      </label>
    )
  }

  function openAccountPanel() {
    if (!authUser) return
    setAuthMode('profile')
    setAuthName(authUser.name ?? '')
    setAuthNameError('')
    setAuthMotifId(authProfile?.motifId ?? authMotifId)
    setAuthIconColor(authProfile?.iconColor ?? authIconColor)
    setAuthIconEyedropper(false)
    setAccountProfileEditing(false)
    setAccountEmailEditing(false)
    setAccountEmailValue(authUser.email)
    setAccountEmailMessage('')
    setAccountPasswordOpen(false)
    setAccountPasswordMessage('')
    setAccountPasswordSent(false)
    setAccountDeleteConfirmOpen(false)
    setSignupPasswordConfirm('')
    setSignupConsent(false)
    setAuthOpen(true)
    setStatus('')
  }

  function openSignupPanel() {
    setAuthMode('signup')
    setAuthIconEyedropper(false)
    setAccountProfileEditing(false)
    setAccountEmailEditing(false)
    setAccountDeleteConfirmOpen(false)
    setSignupPasswordConfirm('')
    setSignupConsent(false)
    setAuthOpen(true)
  }

  function openSigninPanel() {
    setAuthMode('signin')
    setAuthIconEyedropper(false)
    setAccountProfileEditing(false)
    setAccountEmailEditing(false)
    setAccountDeleteConfirmOpen(false)
    setSignupPasswordConfirm('')
    setSignupConsent(false)
    setAuthOpen(true)
  }

  // 名前が空（空白だけを含む）なら、名前欄の下にメッセージを出して false を返す
  function requireAuthName(): boolean {
    if (authName.trim()) {
      setAuthNameError('')
      return true
    }
    setAuthNameError('アカウント名を入力してください。')
    authNameInputRef.current?.focus()
    return false
  }

  // アカウント作成画面（メール確認後〜プロフィール登録）は、アカウント名を決めるまで閉じられない。
  // ×ボタン・枠外クリックのどちらもここを通る。（アプリ自体を閉じた場合は、サーバー側のデフォルト名になる）
  async function closeAuthPanel() {
    if (authMode === 'signupVerified') {
      await startSignupProfile({ requireName: true })
      return
    }
    if (authMode === 'signupProfile') {
      if (!requireAuthName()) return
      // 名前が入っているなら、保存してから完了画面へ進む
      setStatus('処理中...')
      const saved = await saveProfile()
      if (!saved) {
        setAuthNameError('保存できませんでした。もう一度お試しください。')
        setStatus('')
        return
      }
      await refreshMe()
      setAuthNameError('')
      setAuthMode('signupComplete')
      setAccountProfileEditing(false)
      setStatus('')
      return
    }
    setAuthOpen(false)
  }

  function startAfterSignup() {
    setAuthOpen(false)
    setAuthMode('profile')
    setAccountProfileEditing(false)
    setStatus('')
    openPlayCatalog()
  }

  async function startSignupProfile(options?: { requireName?: boolean }) {
    // 認証メールのリンクを開くとログイン状態になっている。そうなっていなければログイン画面へ。
    const me = await refreshMe()
    if (!me) {
      setAuthMode('signin')
      setStatus('メールアドレスの確認が完了しました。ログインしてください。')
      return
    }
    setAuthMode('signupProfile')
    setAccountProfileEditing(true)
    setAuthName('')
    setAuthNameError(options?.requireName ? 'アカウント名を入力してください。' : '')
    setStatus('')
  }

  async function resendVerificationEmail() {
    const email = authEmail.trim()
    if (!email || verifyResendBusy) return
    // 続けて何度も送らないよう、しばらくボタンを押せなくする
    setVerifyResendBusy(true)
    window.setTimeout(() => setVerifyResendBusy(false), 30000)
    setStatus('送信中...')
    const res = await fetch('/api/auth/send-verification-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      setStatus('送信できませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    if (authMode === 'verifyError') setAuthMode('signupSent')
    setStatus('確認メールをもう一度送りました。')
  }

  function startAccountProfileEditing() {
    if (authProfile) {
      setAuthMotifId(authProfile.motifId)
      setAuthIconColor(authProfile.iconColor)
    }
    setAuthIconEyedropper(false)
    setAccountProfileEditing(true)
  }

  async function submitAccountEmailChange() {
    const nextEmail = accountEmailValue.trim().toLowerCase()
    if (!nextEmail || nextEmail === authUser?.email) {
      setAccountEmailMessage('新しいメールアドレスを入力してください。')
      return
    }
    setAccountEmailMessage('送信中...')
    const res = await fetch('/api/auth/change-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newEmail: nextEmail, callbackURL: '/?verify=emailchanged' }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setAccountEmailMessage('確認メールを送れませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    // 新しいメールアドレスに届くリンクを開くと変更が完了する（それまでは今のメールアドレスのまま）
    setAccountEmailEditing(false)
    setAccountEmailMessage(`${nextEmail} に確認メールを送りました。メールのリンクを開くと、メールアドレスが変更されます。`)
  }

  // パスワード再設定メールを送る（成功したかどうかを返す）。届き先が登録されていなくても画面上は同じ結果にする。
  async function requestPasswordResetEmail(email: string) {
    const res = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      // 戻り先は src/auth.ts の RESET_PASSWORD_CALLBACK と対応
      body: JSON.stringify({ email, redirectTo: '/?reset=1' }),
    }).catch(() => null)
    return Boolean(res?.ok)
  }

  // ログイン画面の「パスワードを忘れた方」から
  async function sendPasswordResetFromForm() {
    const email = authEmail.trim()
    if (!email || resetMailBusy) return
    // 続けて何度も送らないよう、しばらくボタンを押せなくする
    setResetMailBusy(true)
    window.setTimeout(() => setResetMailBusy(false), 30000)
    setStatus('送信中...')
    const ok = await requestPasswordResetEmail(email)
    if (!ok) {
      setResetMailBusy(false)
      setStatus('送信できませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    setAuthEmail(email)
    setStatus(authMode === 'forgotSent' ? '再設定メールをもう一度送りました。' : '')
    setAuthMode('forgotSent')
  }

  // セーフティーロックのオンオフを保存する（オフにするときだけパスワードが必要）
  async function saveSafetyLock(enabled: boolean, password?: string) {
    if (safetyLockBusy) return
    setSafetyLockBusy(true)
    setSafetyLockMessage('')
    const res = await fetch('/api/safety-lock', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled, password }),
    }).catch(() => null)
    const body = res && isJsonResponse(res) ? ((await res.json().catch(() => null)) as { error?: string } | null) : null
    setSafetyLockBusy(false)
    if (!res || !res.ok) {
      setSafetyLockMessage(body?.error ?? '設定を変更できませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    setSafetyLockEnabled(enabled)
    setSafetyLockOffOpen(false)
    setSafetyLockOffPassword('')
    setSafetyLockMessage(enabled ? 'セーフティーロックをオンにしました。' : 'セーフティーロックをオフにしました。')
  }

  function toggleSafetyLock() {
    if (safetyLockBusy) return
    if (!safetyLockEnabled) {
      void saveSafetyLock(true)
      return
    }
    // オフにするときは、パスワードの入力欄を開く
    setSafetyLockMessage('')
    setSafetyLockOffPassword('')
    setSafetyLockOffOpen((open) => !open)
  }

  // ログイン中のアカウント画面の「パスワードを変更する」から（登録メールアドレスに送る）
  async function sendAccountPasswordResetEmail() {
    const email = authUser?.email
    if (!email || resetMailBusy) return
    setResetMailBusy(true)
    window.setTimeout(() => setResetMailBusy(false), 30000)
    setAccountPasswordMessage('送信中...')
    const ok = await requestPasswordResetEmail(email)
    if (!ok) {
      setResetMailBusy(false)
      setAccountPasswordMessage('送信できませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    setAccountPasswordMessage('')
    setAccountPasswordSent(true)
  }

  // メールのリンクから開いた「新しいパスワードを設定」画面の送信
  async function submitNewPassword() {
    if (!resetToken) {
      setAuthMode('resetError')
      return
    }
    if (resetNewPassword.length < 8) {
      setStatus('パスワードは8文字以上にしてください。')
      return
    }
    if (resetNewPassword !== resetNewPasswordConfirm) {
      setStatus('確認用パスワードが一致していません。')
      return
    }
    setStatus('変更中...')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newPassword: resetNewPassword, token: resetToken }),
    }).catch(() => null)
    if (!res || !res.ok) {
      const body = (await res?.json().catch(() => null)) as { code?: string } | null
      if (body?.code === 'INVALID_TOKEN') {
        setAuthMode('resetError')
        setStatus('')
        return
      }
      setStatus('変更できませんでした。しばらくしてからもう一度お試しください。')
      return
    }
    setResetNewPassword('')
    setResetNewPasswordConfirm('')
    // 再設定するとログイン状態が解除されるので、画面側の状態も合わせる
    await refreshMe()
    setAuthPassword('')
    setAuthMode('signin')
    setStatus('パスワードを変更しました。新しいパスワードでログインしてください。')
  }

  function runMobileMenuAction(action: () => void) {
    setMobileMenuOpen(false)
    action()
  }

  function renderRecordStat(label: string, count: number, total: number, tone: 'saved' | 'learned') {
    const percent = recordPercent(count, total)
    return (
      <div className={`recordStat ${tone === 'saved' ? 'recordStatSaved' : 'recordStatLearned'}`} key={tone}>
        <span className="recordStatLabel">{label}</span>
        <strong className="recordStatPercent">
          {percent}
          <small>%</small>
        </strong>
        <span className="recordStatCount">{total}こ中 {count}こ</span>
        <div className="recordBar" role="progressbar" aria-label={`${label}の達成率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }

  function renderRecordCheck(done: boolean, kind: 'saved' | 'learned', label: string, note?: string) {
    return done
      ? (
        <>
          <CheckBadge kind={kind} label={label} />
          {note ? <span className="recordCheckDate">{note}</span> : null}
        </>
      )
      : <span className="recordCheckEmpty" role="img" aria-label={`${label}: まだ`}>-</span>
  }

  // kind='learn'（まなぶ）: クイズがあるぬりえの「ぬった」「クイズせいかい」 / kind='play'（あそぶ）: すべてのぬりえの「ぬった」
  function renderRecordPanel(kind: 'learn' | 'play') {
    const isLearn = kind === 'learn'
    const categories = isLearn ? recordLearnGroups : recordPlayGroups
    const activeId = isLearn ? recordLearnCategoryId : recordPlayCategoryId
    const setActiveId = isLearn ? setRecordLearnCategoryId : setRecordPlayCategoryId
    // 記録は大カテゴリーのボタンで選び、その中の小カテゴリーはチップで切り替える（activeId は大カテゴリーか小カテゴリーのID）
    const activeGroup = categories.find((category) => category.id === activeId || category.children.some((child) => child.id === activeId)) ?? categories[0] ?? null
    const activeChild = activeGroup?.children.find((child) => child.id === activeId) ?? null
    const active: RecordCategory | null = activeChild ?? activeGroup
    if (!activeGroup || !active) {
      return (
        <p className="emptyInline">
          {isLearn ? 'クイズにできるぬりえがまだありません。' : 'ぬりえがまだありません。'}
        </p>
      )
    }
    // 国旗のちいきなど、小カテゴリーの中のタグ別に達成度を見られるようにする（小カテゴリーを選んでいるときだけ）
    const recordFacet = activeChild ? TAG_FACETS[activeChild.id] : undefined
    const recordTagChips = activeChild && recordFacet
      ? recordFacet.tags
        .map((tag) => {
          const rows = activeChild.rows.filter((row) => ILLUSTRATION_TAGS[row.id] === tag.id)
          return { tag, rows, doneCount: rows.filter((row) => (isLearn ? row.learned : row.saved)).length }
        })
        .filter((entry) => entry.rows.length > 0)
      : []
    const recordTagBar = recordTagChips.length >= 2 ? recordTagChips : null
    const activeRecordTag = recordTagBar && activeChild && recordTag && recordTag.categoryId === activeChild.id ? recordTag.tag : null
    const activeRecordTagLabel = activeRecordTag ? recordTagBar?.find((entry) => entry.tag.id === activeRecordTag)?.tag.label ?? null : null
    const shownRows = activeRecordTag ? active.rows.filter((row) => ILLUSTRATION_TAGS[row.id] === activeRecordTag) : active.rows
    const shownSavedCount = shownRows.filter((row) => row.saved).length
    const shownLearnedCount = shownRows.filter((row) => row.learned).length
    const total = categories.reduce((sum, category) => sum + category.rows.length, 0)
    const savedTotal = categories.reduce((sum, category) => sum + category.savedCount, 0)
    const learnedTotal = categories.reduce((sum, category) => sum + category.learnedCount, 0)
    return (
      <div className="recordPanel" role="tabpanel">
        <p className="recordOverall">
          ぜんぶで <b>{total}こ</b>のうち、
          {isLearn ? <>クイズせいかい <b>{learnedTotal}こ（{recordPercent(learnedTotal, total)}%）</b>、</> : null}
          ぬった <b>{savedTotal}こ（{recordPercent(savedTotal, total)}%）</b>
        </p>
        <div className="galleryCategoryButtons recordCategoryButtons" role="group" aria-label="カテゴリーを選ぶ">
          {categories.map((category) => (
            <button
              className={`galleryCategoryButton recordCategoryButton ${activeGroup.id === category.id ? 'activeGalleryCategory' : ''}`}
              type="button"
              key={category.id}
              onClick={() => setActiveId(category.id)}
            >
              <span>{category.title}</span>
              <small>{isLearn ? category.learnedCount : category.savedCount}/{category.rows.length}</small>
            </button>
          ))}
        </div>
        {activeGroup.children.length >= 2 ? (
          <CategoryChips
            compact
            className="recordCategoryChips"
            ariaLabel={`${activeGroup.title}をしぼりこむ`}
            activeId={activeChild ? activeChild.id : null}
            allNote={`${isLearn ? activeGroup.learnedCount : activeGroup.savedCount}/${activeGroup.rows.length}`}
            items={activeGroup.children.map((child) => ({
              id: child.id,
              label: categoryShortTitle(child.id, child.title),
              note: `${isLearn ? child.learnedCount : child.savedCount}/${child.rows.length}`,
            }))}
            onChange={(id) => setActiveId(id ?? activeGroup.id)}
          />
        ) : null}
        {recordTagBar && activeChild ? (
          <CategoryChips
            compact
            className="recordCategoryChips categoryTagChips"
            ariaLabel={recordFacet?.ariaLabel ?? 'しぼりこむ'}
            activeId={activeRecordTag}
            allNote={`${isLearn ? activeChild.learnedCount : activeChild.savedCount}/${activeChild.rows.length}`}
            items={recordTagBar.map((entry) => ({ id: entry.tag.id, label: entry.tag.label, note: `${entry.doneCount}/${entry.rows.length}` }))}
            onChange={(id) => setRecordTag(id ? { categoryId: activeChild.id, tag: id } : null)}
          />
        ) : null}
        <section className="recordCategory" aria-label={`${active.title}の一覧`}>
          <div className="recordCategoryHead">
            <h2>{activeRecordTagLabel ? `${active.title}（${activeRecordTagLabel}）` : active.title}</h2>
            <div className="recordStats">
              {isLearn ? renderRecordStat('クイズ せいかい', shownLearnedCount, shownRows.length, 'learned') : null}
              {renderRecordStat('ぬった', shownSavedCount, shownRows.length, 'saved')}
            </div>
          </div>
          {isLearn ? <p className="recordNote">クイズせいかいの下の日づけは、はじめて正解した日です。</p> : null}
          <div className="recordTableWrap">
            <table className={`recordTable ${isLearn ? 'recordTableWithDate' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">ぬりえ</th>
                  <th scope="col">ぬった</th>
                  {isLearn ? <th scope="col">クイズ<br />せいかい</th> : null}
                </tr>
              </thead>
              <tbody>
                {shownRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <button className="recordTitleButton" type="button" title="このぬりえをひらく" onClick={() => openIllustrationFromRecord(row.id, { quiz: isLearn })}>
                        {row.title}
                      </button>
                    </th>
                    <td className="recordCheckCell">{renderRecordCheck(row.saved, 'saved', 'ぬった')}</td>
                    {isLearn ? <td className="recordCheckCell">{renderRecordCheck(row.learned, 'learned', 'クイズせいかい', row.learnedAt ? formatDateOnly(row.learnedAt) : undefined)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  }

  // 「バッジ」タブ: とくべつ／ぬった数／カテゴリーマスター／クイズはかせ、の4区分で並べる。獲得ずみ・未獲得の両方を出すが、未獲得側に「あと1枚」のような煽り文言は付けない
  function renderAchievementPanel() {
    const sections: { tier: Achievement['tier']; heading: string; note: string }[] = [
      { tier: 'special', heading: 'とくべつ', note: 'はじめての行動でもらえる' },
      { tier: 'milestone', heading: 'ぬった数', note: '塗った枚数の節目でもらえる' },
      { tier: 'category', heading: 'カテゴリーマスター（あそぶ）', note: 'そのカテゴリーのぬりえを全部ぬるともらえる' },
      { tier: 'quiz', heading: 'クイズはかせ（まなぶ）', note: 'そのカテゴリーのクイズに全部せいかいするともらえる' },
    ]
    return (
      <div className="achievementPanel">
        <p className="recordOverall">
          ぜんぶで <b>{achievements.length}こ</b>のうち、獲得ずみ <b>{earnedAchievements.length}こ</b>
        </p>
        {sections.map((section) => {
          const items = achievements.filter((achievement) => achievement.tier === section.tier)
          if (!items.length) return null
          return (
            <section className="achievementSection" key={section.tier} aria-label={section.heading}>
              <h2>{section.heading}</h2>
              <p className="achievementSectionNote">{section.note}</p>
              <ul className="achievementGrid">
                {items.map((achievement) => <AchievementBadge achievement={achievement} key={achievement.id} />)}
              </ul>
            </section>
          )
        })}
      </div>
    )
  }

  const undoDisabled = Boolean(selected && !selectedDef?.raster && (state.undoByIllustration[selected]?.length ?? 0) === 0)
  const redoDisabled = Boolean(selected && !selectedDef?.raster && (state.redoByIllustration[selected]?.length ?? 0) === 0)
  const activeTopPage = selected
    ? quizMode ? 'learn' : 'play'
    : selectedCategory
      ? selectedCategoryHasQuiz ? 'learn' : 'play'
      : showGalleryPage
          ? 'gallery'
        : showSavedPage
          ? 'saved'
          : showRecordPage
            ? 'record'
          : showSpreadPage
            ? 'spread'
            : showCreatePage
              ? 'create'
      : showQuizCatalog
        ? 'learn'
        : showPlayCatalog
          ? 'play'
          : 'home'
  const showMobileMenuButton = !settingsOpen && !authOpen

  return (
    <div className="app">
      {status ? <div className="toastStatus" role="status">{status}</div> : null}
      {showMobileMenuButton ? (
        <button
          className={`mobileMenuButton ${mobileMenuOpen ? 'openMobileMenuButton' : ''}`}
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          aria-expanded={mobileMenuOpen}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
      {showMobileMenuButton && mobileMenuOpen ? (
        <div className="mobileMenuOverlay" role="dialog" aria-modal="true" aria-label="メニュー">
          <div className="mobileMenuPanel">
            <button className={`mobileMenuLink ${activeTopPage === 'play' ? 'activeMobileMenuLink' : ''}`} type="button" onClick={() => runMobileMenuAction(openPlayCatalog)}>
              あそぶ
            </button>
            <button className={`mobileMenuLink ${activeTopPage === 'learn' ? 'activeMobileMenuLink' : ''}`} type="button" onClick={() => runMobileMenuAction(openQuizCatalog)}>
              まなぶ
            </button>
            <button className={`mobileMenuLink ${activeTopPage === 'spread' ? 'activeMobileMenuLink' : ''}`} type="button" onClick={() => runMobileMenuAction(openSpreadPage)}>
              ひろげる
            </button>
            <button className={`mobileMenuLink ${activeTopPage === 'gallery' ? 'activeMobileMenuLink' : ''}`} type="button" onClick={() => runMobileMenuAction(() => openGalleryPage())}>
              みんなの作品
            </button>
            {authUser ? (
              <button className={`mobileMenuLink ${activeTopPage === 'saved' ? 'activeMobileMenuLink' : ''}`} type="button" onClick={() => runMobileMenuAction(() => openSavedPage())}>
                マイギャラリー
              </button>
            ) : null}
            {!selected ? (
              <button className="mobileMenuLink" type="button" onClick={() => runMobileMenuAction(() => setSettingsOpen(true))}>
                設定
              </button>
            ) : null}
            {authUser ? (
              <>
                <button className="mobileMenuLink" type="button" onClick={() => runMobileMenuAction(openAccountPanel)}>
                  アカウント
                </button>
              </>
            ) : (
              <>
                <button className="mobileMenuLink primaryMobileMenuLink" type="button" onClick={() => runMobileMenuAction(openSignupPanel)}>
                  アカウント作成
                </button>
                <button className="mobileMenuLink blueMobileMenuLink" type="button" onClick={() => runMobileMenuAction(openSigninPanel)}>
                  ログイン
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      <header className={`topbar ${selected ? 'editingTopbar' : ''}`}>
        <button className="topLogoLink" type="button" onClick={goHome} aria-label="ぬりえペイント ホームへ">
          <img src="/icons/nuriepaint-mark.png" alt="" aria-hidden="true" />
          <span className="titleCoral">ぬ</span>
          <span className="titleOrange">り</span>
          <span className="titleBlue">え</span>
          <span className="titleCoral">ペ</span>
          <span className="titleOrange">イ</span>
          <span className="titleBlue">ン</span>
          <span className="titleCoral">ト</span>
        </button>
        <div className={`topbarActions ${selected ? 'editingTopbarActions' : ''}`}>
          <button className={`navLink ${activeTopPage === 'play' ? 'activeNav' : ''}`} type="button" onClick={openPlayCatalog}>
            あそぶ
          </button>
          <button className={`navLink ${activeTopPage === 'learn' ? 'activeNav' : ''}`} type="button" onClick={openQuizCatalog}>
            まなぶ
          </button>
          <button className={`navLink ${activeTopPage === 'spread' ? 'activeNav' : ''}`} type="button" onClick={openSpreadPage}>
            ひろげる
          </button>
          <button className={`navLink galleryNavButton ${activeTopPage === 'gallery' ? 'activeNav' : ''}`} type="button" onClick={() => openGalleryPage()}>
            みんなの作品
          </button>
          {!selected ? (
            <>
              {authUser ? (
              <button className={`navLink savedNavButton ${activeTopPage === 'saved' ? 'activeNav' : ''}`} type="button" onClick={() => openSavedPage()}>
                マイギャラリー
              </button>
              ) : null}
              <button className="navLink" type="button" onClick={() => setSettingsOpen(true)}>
                設定
              </button>
            </>
          ) : null}
          {authUser ? (
            <>
              {selected ? (
                <button className="btn saveTopButton" type="button" onClick={saveColoring}>
                  保存
                </button>
              ) : null}
              <button
                className="navLink accountTopButton"
                type="button"
                onClick={openAccountPanel}
              >
                アカウント
              </button>
            </>
          ) : (
            <div className="authTopActions">
              <button
                className="btn signupTopButton"
                type="button"
                onClick={openSignupPanel}
              >
                アカウント作成
              </button>
              <button
                className="btn loginTopButton"
                type="button"
                onClick={openSigninPanel}
              >
                ログイン
              </button>
            </div>
          )}
          {selected ? (
            <>
              {authUser ? (
                <button className="navLink savedNavButton editingSavedNavButton" type="button" onClick={() => openSavedPage({ rememberReturn: true })}>
                  マイギャラリー
                </button>
              ) : null}
              <button className="navLink editingSettingsNavButton" type="button" onClick={() => setSettingsOpen(true)}>
                設定
              </button>
              {quizMode ? <span className="topQuizModeBadge">{challengeRunning ? 'ぬりえテスト' : 'クイズモード'}</span> : null}
              <button className="btn illustrationTopButton" type="button" onClick={() => setSelected(null)}>
                ぬりえを選ぶ
              </button>
              <button className="btn mobileSaveHeaderButton" type="button" onClick={saveColoring}>
                保存
              </button>
              <button className="btn mobileSettingsHeaderButton" type="button" onClick={() => setSettingsOpen(true)}>
                設定
              </button>
              <button
                className="btn iconButton topUndoButton"
                type="button"
                onClick={undo}
                disabled={undoDisabled}
                aria-label="戻す"
                title="戻す"
              >
                <UndoIcon />
              </button>
              <button className="btn zoomResetButton topZoomResetButton" type="button" onClick={() => setArtZoom(1)} disabled={artZoom <= 1} aria-label="100%に戻す" title="100%に戻す">
                100%
              </button>
              <button className={`btn iconButton topEyedropperButton ${eyedropper ? 'activeTool' : ''}`} type="button" onClick={() => { setEyedropper((value) => !value); setBrush(false) }} aria-label="スポイト" title="スポイト">
                <EyedropperIcon />
              </button>
              <button className={`btn iconButton topBrushButton ${brush ? 'activeTool' : ''}`} type="button" onClick={() => { setBrush((value) => !value); setEyedropper(false) }} aria-label="ブラシ" title="ブラシ">
                <BrushIcon />
              </button>
              <button className="btn btnDanger resetTopButton" type="button" onClick={reset}>
                リセット
              </button>
            </>
          ) : null}
        </div>
      </header>

      {selected ? (
        <>
          <div className="layout">
            <aside className="rail">
              {challenge ? (
                <ChallengeSidebar
                  total={challenge.ids.length}
                  current={Math.min(challenge.index + 1, challenge.ids.length)}
                  correct={challenge.results.filter(Boolean).length}
                  answered={challenge.results.map((passed, index) => ({ illustration: illustrationById.get(challenge.ids[index]) ?? null, correct: passed }))}
                  onReset={() => setChallengeResetOpen(true)}
                />
              ) : <Sidebar selected={selected} illustrations={displayedCategoryIllustrations.length ? displayedCategoryIllustrations : undefined} checkedIds={checkedIds} checkKind={checkKind} onSelect={(id) => chooseIllustration(id, { scrollSidebarToTop: false })} onBackToCategories={backToCategoryList} backLabel={selectedCategory ? '一覧へもどる' : undefined} scrollToTopToken={gallerySidebarScrollToken} />}
            </aside>

            <main className="main">
              <div className="stageWrap">
                <div className="mobileEditorToolbar" aria-label="塗り絵の操作">
                  <button className="btn" type="button" onClick={() => openSavedPage({ rememberReturn: true })}>
                    マイギャラリー
                  </button>
                  <button className="btn" type="button" onClick={saveColoring}>
                    保存
                  </button>
                  <button className="btn btnDanger" type="button" onClick={reset}>
                    リセット
                  </button>
                  <button className="btn" type="button" onClick={() => setSelected(null)}>
                    ぬりえを選ぶ
                  </button>
                </div>
                <Stage
                  illustration={selectedDef}
                  fills={fills}
                  color={color}
                  command={selectedDef?.raster ? rasterCommand : null}
                  zoom={artZoom}
                  onZoomChange={setArtZoom}
                  eyedropper={eyedropper}
                  brush={brush}
                  restoreImage={restoreImage}
                  quizMode={quizMode}
                  quizAvailable={Boolean(selectedQuiz)}
                  onStartQuiz={startQuizMode}
                  onExitQuiz={exitQuizMode}
                  onCompleteQuiz={completeQuiz}
                  challengeProgress={challengeLabel}
                  onQuitChallenge={challengeRunning ? () => setChallengeQuitOpen(true) : undefined}
                  onOpenSaved={() => openSavedPage({ rememberReturn: true })}
                  onSave={saveColoring}
                  onPickColor={(pickedColor) => {
                    setColor(pickedColor)
                    setEyedropper(false)
                    setStatus(`${pickedColor} を選びました。`)
                  }}
                  onUndo={undo}
                  onPaint={(regionId, ev) => setRegionColor(regionId, color, { erase: ev.shiftKey || ev.altKey })}
                />
                <div className="hint">
                  <span className="desktopHintText">塗りたい場所をクリック。</span>
                  <span className="mobileHintText">塗りたい場所をタップ。２本指タップで1つ戻る。</span>
                </div>
              </div>
            </main>
          </div>

          <footer className={`paletteDock ${mobilePaletteOpen ? 'openPaletteDock' : 'closedPaletteDock'}`}>
            <div className="mobilePaletteToolbar" aria-label="色とツール">
              <div className="mobileCurrentColor" aria-label={`選択中の色: ${color}`}>
                <span className={isWhiteColor(color) ? 'isWhite' : undefined} style={{ background: color }} aria-hidden="true" />
                <strong>{color}</strong>
              </div>
              <button className="btn iconButton mobileUndoButton" type="button" onClick={undo} disabled={undoDisabled} aria-label="戻る" title="戻る">
                <UndoIcon />
              </button>
              <button className="btn iconButton mobileRedoButton" type="button" onClick={redo} disabled={redoDisabled} aria-label="進む" title="進む">
                <RedoIcon />
              </button>
              <button className={`btn iconButton mobileEyedropperButton ${eyedropper ? 'activeTool' : ''}`} type="button" onClick={() => { setEyedropper((value) => !value); setBrush(false) }} aria-label="スポイト" title="スポイト">
                <EyedropperIcon />
              </button>
              <button className={`btn iconButton mobileBrushButton ${brush ? 'activeTool' : ''}`} type="button" onClick={() => { setBrush((value) => !value); setEyedropper(false) }} aria-label="ブラシ" title="ブラシ">
                <BrushIcon />
              </button>
              <button className="btn btnDanger tabletPaletteResetButton" type="button" onClick={reset}>
                リセット
              </button>
              <button
                className="btn iconButton mobilePaletteToggleButton"
                type="button"
                onClick={() => setMobilePaletteOpen((open) => !open)}
                aria-label={mobilePaletteOpen ? 'カラーツールをしまう' : 'カラーツールを開く'}
                title={mobilePaletteOpen ? 'しまう' : '開く'}
              >
                {mobilePaletteOpen ? '▼' : '▲'}
              </button>
            </div>
            <div className="palettePanel" hidden={!mobilePaletteOpen}>
              <Palette
                value={color}
                onChange={setColor}
                showSliders={!quizMode && showColorSliders}
                showSwatches={quizMode ? true : showColorSwatches}
                controlMode={colorControlMode}
                swatches={activeSwatches}
                actions={(
                  <>
                    <button className="btn iconButton paletteActionButton paletteSettingsButton" type="button" onClick={() => setSettingsOpen(true)} aria-label="設定" title="設定">
                      <GearIcon />
                    </button>
                    <button className="btn iconButton paletteActionButton" type="button" onClick={undo} disabled={undoDisabled} aria-label="戻る" title="戻る">
                      <UndoIcon />
                    </button>
                    <button className="btn iconButton paletteActionButton" type="button" onClick={redo} disabled={redoDisabled} aria-label="進む" title="進む">
                      <RedoIcon />
                    </button>
                    <button className={`btn iconButton paletteActionButton ${eyedropper ? 'activeTool' : ''}`} type="button" onClick={() => { setEyedropper((value) => !value); setBrush(false) }} aria-label="スポイト" title="スポイト">
                      <EyedropperIcon />
                    </button>
                    <button className={`btn iconButton paletteActionButton ${brush ? 'activeTool' : ''}`} type="button" onClick={() => { setBrush((value) => !value); setEyedropper(false) }} aria-label="ブラシ" title="ブラシ">
                      <BrushIcon />
                    </button>
                  </>
                )}
              />
            </div>
          </footer>
        </>
      ) : (
        <main ref={homeScrollRef} className={`home ${selectedCategory ? 'categoryPage' : showSavedPage ? 'savedPage' : showRecordPage ? 'recordPage' : showGalleryPage ? 'galleryPage' : showSpreadPage ? 'spreadPage' : showCreatePage ? 'createPage' : showQuizCatalog ? 'quizCatalogPage' : showPlayCatalog ? 'playCatalogPage' : 'homePage'}`}>
          {!selectedCategory && !showQuizCatalog && !showPlayCatalog && !showCreatePage && !showSpreadPage && !showGalleryPage && !showSavedPage && !showRecordPage ? (
            <section className="homeHero" aria-labelledby="home-hero-copy">
              <div className="heroText">
                <p className="heroCatch">
                  好きな色をのせていくだけ。<br />
                  ぬりえを通じて育む<br className="heroCatchNarrowBreak" />
                  想像力と学び。
                </p>
                <p className="heroLead" id="home-hero-copy">
                  ぬりえペイントは、ぬりえの「めんどくささ」を解消して、<br />
                  配色を通じた想像力や、集中力・学びを追求するツールです。
                </p>
                <button className="btn primaryAction heroPrimaryAction" type="button" onClick={openPlayCatalog}>
                  いますぐやってみる
                </button>
              </div>
              <div className="lpVisual heroArtwork" aria-label="ぬりえ作品のイメージ">
                <img className="heroObject heroObjectButterfly" src="/lp/hero-butterfly-line.png" alt="" />
                <img className="heroObject heroObjectApple" src="/lp/hero-apple-white.png" alt="" />
                <img className="heroObject heroObjectAirplane" src="/lp/hero-airplane-line.png" alt="" />
              </div>
            </section>
          ) : null}
          {showCreatePage ? (
            <section className="toolPage createToolPage" aria-labelledby="home-title">
              <div className="toolIntro">
                <h1 id="home-title">つくる</h1>
                <p>手描きの線画や教材画像をアップロードして、自分だけのぬりえ置き場を作れます。ログインした人だけが使えるコーナーです。</p>
              </div>
              {authUser ? (
                <>
                  <form className="uploadPanel" onSubmit={uploadLineart}>
                    <label className="field">
                      <span>タイトル</span>
                      <input value={lineartTitle} onChange={(ev) => setLineartTitle(ev.target.value)} placeholder="" />
                    </label>
                    <label className="field">
                      <span>画像ファイル</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(ev) => setLineartFile(ev.target.files?.[0] ?? null)} />
                    </label>
                    <button className="btn primaryAction uploadCheckButton" type="submit">チェック画面へ</button>
                  </form>
                  <section className="publicGrid" aria-label="アップロード済みぬりえ">
                    {uploadedLinearts.length ? uploadedLinearts.map((item) => (
                      <figure className="publicCard" key={item.id}>
                        <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: 'マイギャラリー', imageUrl: item.imageUrl })}>
                          <img src={item.imageUrl} alt={item.title} />
                        </button>
                        <figcaption>
                          <strong>{item.title}</strong>
                          <span>{formatDateDisplay(item.createdAt)}</span>
                        </figcaption>
                      </figure>
                    )) : <p className="emptyInline">まだアップロードされたぬりえはありません。</p>}
                  </section>
                </>
              ) : (
                <div className="lockedPanel">
                  <p>つくるコーナーを使うにはログインしてください。</p>
                  <button className="btn loginTopButton" type="button" onClick={() => setAuthOpen(true)}>ログイン</button>
                </div>
              )}
            </section>
          ) : showSpreadPage ? (
            <section className="toolPage spreadToolPage" aria-labelledby="home-title">
              <div className="toolIntro">
                <h1 id="home-title">ひろげる</h1>
                <p>
                  {authUser
                    ? '自分で作ったぬりえを公開したり、みんなのぬりえをあそぶに追加できます。'
                    : '自分で作ったぬりえや、他の人がつくったぬりえであそぶことができます。'}
                </p>
              </div>
              {authUser ? (
                <>
                  <form className="uploadPanel spreadUploadPanel" onSubmit={uploadLineart}>
                    <label className="lineartFileField">
                      <span>ぬりえイラストファイル</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(ev) => setLineartFile(ev.target.files?.[0] ?? null)} />
                    </label>
                    <div className="lineartMetaRow">
                      <label>
                        <span>ぬりえのタイトル</span>
                        <input value={lineartTitle} onChange={(ev) => setLineartTitle(ev.target.value)} placeholder="" />
                      </label>
                      <label>
                        <span>カテゴリー</span>
                        <select value={lineartCategoryId} onChange={(ev) => setLineartCategoryId(ev.target.value)} required>
                          <CategoryOptions />
                        </select>
                      </label>
                    </div>
                    <div className="lineartLearningRow">
                      <label className="lineartLearningToggle">
                        <input type="checkbox" checked={lineartIsLearning} onChange={(ev) => {
                          setLineartIsLearning(ev.target.checked)
                          if (!ev.target.checked) setLineartReferenceFile(null)
                        }} />
                        <span>学習用ぬりえとして登録</span>
                      </label>
                      <details className="learningHelp">
                        <summary aria-label="学習用ぬりえとは">?</summary>
                        <p>
                          学習用ぬりえは、国旗や生き物の模様など、見本に近い配色を覚えながら楽しむぬりえです。
                          登録すると、まなぶやクイズモードで使えるようになります。
                        </p>
                      </details>
                    </div>
                    {lineartIsLearning ? (
                      <label className="lineartReferenceField">
                        <span>見本画像</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" required onChange={(ev) => setLineartReferenceFile(ev.target.files?.[0] ?? null)} />
                      </label>
                    ) : null}
                    <p className="uploadCaution">
                      ※不適切だと判断されるものを公開した場合は運営から削除される可能性があります。
                    </p>
                    <button className="btn primaryAction uploadSubmitButton uploadCheckButton" type="submit">チェック画面へ</button>
                  </form>
                  <section className="lineartSection" aria-labelledby="my-linearts-title">
                    <div className="lineartSectionHead">
                      <h2 id="my-linearts-title">自分のぬりえ</h2>
                      <p>公開すると、ほかの人があそぶに追加できるようになります。</p>
                    </div>
                    {myLineartSections.length ? (
                      <GroupedLineartView
                        sections={myLineartSections}
                        filter={myLineartCategoryFilter}
                        onFilterChange={setMyLineartCategoryFilter}
                        cardsLabel="自分のぬりえのカテゴリー一覧"
                        renderItems={(items, title) => (
                          <div className="publicGrid" aria-label={`自分のぬりえ - ${title}`}>
                            {items.map((item, idx) => (
                              <figure className="publicCard lineartDisplayCard" key={item.id} style={{ ['--card-accent' as never]: getLoopCardAccent(idx) }}>
                                <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: '自分のぬりえ', imageUrl: item.imageUrl, reportKind: 'ぬりえ', reportId: item.id })}>
                                  <img src={item.imageUrl} alt={item.title} />
                                </button>
                                <figcaption>
                                  <strong>{item.title}</strong>
                                  {item.isLearning ? <span>学習用ぬりえ</span> : null}
                                  <label className="lineartCategoryChanger">
                                    <select aria-label="カテゴリー" value={item.categoryId} onChange={(ev) => updateUploadedLineartCategory(item, ev.target.value)}>
                                      <CategoryOptions />
                                    </select>
                                  </label>
                                  <div className="cardActionRow">
                                    {renderLineartPublishToggle(item)}
                                    <button className="downloadLink savedDeleteLink" type="button" onClick={() => setLineartDeleteTarget(item)}>
                                      削除
                                    </button>
                                  </div>
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        )}
                      />
                    ) : <p className="emptyInline">まだアップロードしたぬりえはありません。</p>}
                  </section>
                </>
              ) : (
                <div className="lockedPanel spreadLockedPanel spreadLoginBand">
                  <div className="spreadLoginBandCopy">
                    <strong>アカウントでひろげる</strong>
                    <p>ぬりえをアップロードしたり、あそぶに追加したりするにはログインしてください。</p>
                  </div>
                  <button className="btn loginTopButton" type="button" onClick={() => setAuthOpen(true)}>ログイン</button>
                </div>
              )}
              <section className="lineartSection" aria-labelledby="public-linearts-title">
                <div className="lineartSectionHead">
                  <h2 id="public-linearts-title">みんなのぬりえ</h2>
                  <p>気に入ったぬりえを、あそぶの中に追加できます。</p>
                </div>
                {publicLineartSections.length ? (
                  <GroupedLineartView
                    sections={publicLineartSections}
                    filter={publicLineartCategoryFilter}
                    onFilterChange={setPublicLineartCategoryFilter}
                    cardsLabel="みんなのぬりえのカテゴリー一覧"
                    renderItems={(items, title) => (
                      <div className="publicGrid" aria-label={`みんなのぬりえ - ${title}`}>
                        {items.map((item, idx) => (
                          <figure className="publicCard lineartDisplayCard" key={item.id} style={{ ['--card-accent' as never]: getLoopCardAccent(idx) }}>
                            <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: item.authorName ? `${item.authorName} さん` : 'ぬりえペイント', imageUrl: item.imageUrl, reportKind: 'ぬりえ', reportId: item.id })}>
                              <img src={item.imageUrl} alt={item.title} />
                            </button>
                            <figcaption>
                              <strong>{item.title}</strong>
                              <span>{item.authorName ? `${item.authorName} さん` : 'ぬりえペイント'}</span>
                              {item.isLearning ? <span>学習用ぬりえ</span> : null}
                              <div className="lineartAddControls">
                                <label>
                                  <span>カテゴリー</span>
                                  <select value={getLineartAddCategoryId(item.id)} onChange={(ev) => updateLineartAddCategory(item.id, ev.target.value)} disabled={Boolean(item.added)}>
                                    <CategoryOptions />
                                  </select>
                                </label>
                                <button className={`downloadLink ${item.added ? 'addedLineartButton' : ''}`} type="button" disabled={Boolean(item.added)} onClick={() => addLineartToPlay(item)}>
                                  {item.added ? '追加済み' : 'あそぶに追加'}
                                </button>
                              </div>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  />
                ) : <p className="emptyInline">公開されているぬりえはまだありません。</p>}
              </section>
            </section>
          ) : showGalleryPage ? (
            <section className="toolPage galleryToolPage" aria-labelledby="home-title">
              <div className="toolIntro">
                <h1 id="home-title">みんなの作品</h1>
                <p>みんなが公開した作品を眺められる場所です。</p>
                {galleryFilterIllustrationId ? (
                  <div className="galleryFilterChipRow">
                    <span className="galleryFilterChip">このぬりえの作品だけ表示中</span>
                    <button className="downloadLink" type="button" onClick={() => setGalleryFilterIllustrationId(null)}>
                      すべての作品を見る
                    </button>
                  </div>
                ) : null}
              </div>
              <section className="publicGrid" aria-label="みんなの作品">
                {(() => {
                  const filtered = galleryFilterIllustrationId
                    ? publicColorings.filter((item) => item.illustrationId === galleryFilterIllustrationId)
                    : publicColorings
                  return filtered.length ? filtered.map((item) => (
                    <figure className="publicCard" key={item.id}>
                      <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: item.authorName ? `${item.authorName} さん` : 'ぬりえペイント', imageUrl: item.imageUrl, reportKind: '作品', reportId: item.id })}>
                        <img src={item.imageUrl} alt={item.title} />
                      </button>
                      <figcaption>
                        <strong>{item.title}</strong>
                        <span className="authorLine">
                          {item.authorProfile ? (
                            <ProfileIcon profile={item.authorProfile} size="small" />
                          ) : null}
                          {item.authorName ? `${item.authorName} さん` : 'ぬりえペイント'}
                        </span>
                        <span>{item.publishedAt ? `公開: ${formatDateDisplay(item.publishedAt)}` : '公開中'}</span>
                      </figcaption>
                    </figure>
                  )) : <p className="emptyInline">{galleryFilterIllustrationId ? 'このぬりえの公開作品はまだありません。' : '公開されている作品はまだありません。'}</p>
                })()}
              </section>
            </section>
          ) : showSavedPage ? (
            <section className="toolPage savedToolPage" aria-labelledby="home-title">
              <div className="toolIntro toolIntroWithAction">
                <div>
                  <h1 id="home-title">マイギャラリー</h1>
                  <p>自分がぬった作品を見返したり、公開設定を変えたりできます。</p>
                </div>
                {savedPageReturnRef.current ? (
                  <button className="btn savedPageCloseButton" type="button" onClick={closeSavedPage}>
                    ぬりえに戻る
                  </button>
                ) : null}
              </div>
              {authUser ? (
                <>
                  {renderSavedGalleryControls('pageGalleryToolbar')}
                  {renderSavedGalleryCategoryPicker('pageGalleryCategoryPicker')}
                  <section className="publicGrid" aria-label="保存済み作品">
                    {activeGallerySection?.items.length ? activeGallerySection.items.map((item) => (
                      <figure className="publicCard" key={item.id}>
                        <button
                          className="publicImageButton"
                          type="button"
                          onClick={() => setImagePreview({ title: item.title, subtitle: 'マイギャラリー', imageUrl: item.imageUrl, illustrationId: item.illustrationId, continueItem: item })}
                        >
                          <img src={item.imageUrl} alt={item.title} />
                        </button>
                        <figcaption>
                          <strong>{item.title}</strong>
                          <span>作成: {formatDateDisplay(item.createdAt)}</span>
                          <div className="cardActionRow savedCardActionRow">
                            {renderPublishToggle(item)}
                            <button className="downloadLink" type="button" onClick={() => continueColoring(item)}>
                              続きから
                            </button>
                            <button className="downloadLink savedDeleteLink savedDeleteIconButton" type="button" onClick={() => setDeleteTarget(item)} aria-label="削除" title="削除">
                              <TrashIcon />
                            </button>
                          </div>
                        </figcaption>
                      </figure>
                    )) : (
                      <p className="emptyInline savedPageEmptyText">
                        まだ保存された作品はありません。<br />
                        塗り絵ページで保存すると、ここに並びます。
                      </p>
                    )}
                  </section>
                </>
              ) : (
                <div className="lockedPanel">
                  <p>マイギャラリーを使うにはログインしてください。</p>
                  <button className="btn loginTopButton" type="button" onClick={() => setAuthOpen(true)}>ログイン</button>
                </div>
              )}
            </section>
          ) : showRecordPage ? (
            <section className="toolPage recordToolPage" aria-labelledby="home-title">
              <div className="toolIntro toolIntroWithAction">
                <div>
                  <h1 id="home-title">{RECORD_PAGE_TITLE}</h1>
                  <p>ぬりえの名前をぜんぶならべて、ぬったもの（マイギャラリーに入っているもの）と、クイズにせいかいしたものをチェックできます。</p>
                </div>
                <button className="btn savedPageCloseButton" type="button" onClick={closeRecordPage}>
                  もどる
                </button>
              </div>
              {authUser ? (
                <>
                  <div className="recordTabs" role="tablist" aria-label="表示するもの">
                    <button className={`recordTab ${recordTab === 'learn' ? 'activeRecordTab' : ''}`} type="button" role="tab" aria-selected={recordTab === 'learn'} onClick={() => setRecordTab('learn')}>
                      まなぶ（クイズ）
                    </button>
                    <button className={`recordTab ${recordTab === 'play' ? 'activeRecordTab' : ''}`} type="button" role="tab" aria-selected={recordTab === 'play'} onClick={() => setRecordTab('play')}>
                      あそぶ（ぬりえ）
                    </button>
                    <button className={`recordTab ${recordTab === 'badge' ? 'activeRecordTab' : ''}`} type="button" role="tab" aria-selected={recordTab === 'badge'} onClick={() => setRecordTab('badge')}>
                      バッジ
                    </button>
                  </div>
                  {recordTab === 'badge' ? renderAchievementPanel() : renderRecordPanel(recordTab)}
                </>
              ) : (
                <div className="lockedPanel">
                  <p>{RECORD_PAGE_TITLE}を見るにはログインしてください。</p>
                  <button className="btn loginTopButton" type="button" onClick={() => setAuthOpen(true)}>ログイン</button>
                </div>
              )}
            </section>
          ) : !selectedCategory && !showQuizCatalog && !showPlayCatalog ? (
            <>
              <section className="lpMain" aria-label="主な特徴">
                <div className="lpFeatureGrid" aria-label="主な特徴">
                  <section className="lpFeature lpFeatureSave">
                    <div className="lpFeatureArtwork lpSaveArtwork" aria-hidden="true">
                      <div className="lpMiniPaper">
                        {lpPreviewIllustrations[1] ? <IllustrationThumb illustration={lpPreviewIllustrations[1]} /> : null}
                      </div>
                    </div>
                    <h2>
                      ワンタッチの<br />
                      塗りつぶしぬりえ
                    </h2>
                    <div className="lpFeatureCopy">
                      <p>
                        「クレヨンだと周りのものを汚してしまう…」<br />
                        「色鉛筆で広い面を塗るのは大変…」<br />
                        ぬりえペイントなら、いつでもどこでも色の構成だけに集中してぬりえを楽しめます。
                      </p>
                      <button className="btn lpFeatureButton lpFeatureButtonBlue" type="button" onClick={openPlayCatalog}>
                        ぬりえをはじめる
                      </button>
                    </div>
                  </section>
                  <section className="lpFeature lpFeatureColor">
                    <div className="lpFeatureArtwork lpColorArtwork" aria-hidden="true">
                      <div className="lpColorMixer">
                        <i style={{ background: '#ef6950' }} />
                        <i style={{ background: '#feb61c' }} />
                        <i style={{ background: '#29a2de' }} />
                        <div><b style={{ width: '78%', background: '#ef6950' }} /></div>
                        <div><b style={{ width: '55%', background: '#1cb5a5' }} /></div>
                        <div><b style={{ width: '68%', background: '#29a2de' }} /></div>
                      </div>
                    </div>
                    <h2>
                      色の混ぜ方を<br />
                      さわって学べる
                    </h2>
                    <div className="lpFeatureCopy">
                      <p>
                        カラーパレットに加えて、RGB、CMY、HSVのスライダーで自分だけの色を作れます。<br />
                        カラーパレットをオフにして、スライダーの混色だけでぬりえを楽しむこともできます。
                      </p>
                      <button className="btn lpFeatureButton lpFeatureButtonCoral" type="button" onClick={() => setSettingsOpen(true)}>
                        色の調節設定を確認する
                      </button>
                    </div>
                  </section>
                  <section className="lpFeature lpFeatureLearn">
                    <div className="lpFeatureArtwork lpLearnArtwork" aria-hidden="true">
                      <div className="lpMiniPaper">
                        {lpPreviewIllustrations[2] ? <IllustrationThumb illustration={lpPreviewIllustrations[2]} /> : null}
                      </div>
                    </div>
                    <h2>
                      ぬりえを通じて<br />
                      知識が身に付く
                    </h2>
                    <div className="lpFeatureCopy">
                      <p>国旗や生き物の模様など、決まった配色がある題材は、ぬりえクイズとしてたのしむこともできます。</p>
                      <button className="btn lpFeatureButton lpFeatureButtonGreen" type="button" onClick={openQuizCatalog}>
                        ぬりえでまなぶ
                      </button>
                    </div>
                  </section>
                </div>
              </section>
              <section className="lpAccountSection" aria-labelledby="lp-account-title">
                <div className="lpAccountIntro">
                  <h2 id="lp-account-title">アカウントを作成すると・・・</h2>
                </div>
                <div className="lpAccountBenefitGrid">
                  <section className="lpAccountBenefitCard lpAccountBenefitSave">
                    <div className="lpAccountBenefitArtwork" aria-hidden="true">
                      <div className="lpMiniPaper">
                        {lpPreviewIllustrations[1] ? <IllustrationThumb illustration={lpPreviewIllustrations[1]} /> : null}
                      </div>
                    </div>
                    <div className="lpAccountBenefitText">
                      <h3>自分のぬりえを保存できる</h3>
                      <p>あとから見返したり、続きからはじめたりすることができるように。</p>
                    </div>
                  </section>
                  <section className="lpAccountBenefitCard lpAccountBenefitQuiz">
                    <div className="lpAccountBenefitArtwork" aria-hidden="true">
                      <div className="lpMiniPaper">
                        {lpPreviewIllustrations[2] ? <IllustrationThumb illustration={lpPreviewIllustrations[2]} /> : null}
                      </div>
                    </div>
                    <div className="lpAccountBenefitText">
                      <h3>ぬりえクイズの結果を残せる</h3>
                      <p>
                        ゲーム感覚でぬりえを楽しんで、知識を身につけられます。<br />
                        達成率100％をめざしてがんばりましょう！
                      </p>
                    </div>
                  </section>
                  <section className="lpAccountBenefitCard lpAccountBenefitAdd">
                    <div className="lpAccountBenefitArtwork" aria-hidden="true">
                      <div className="lpInstallArtwork">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <div className="lpAccountBenefitText">
                      <h3>ぬりえを追加できる</h3>
                      <p>ぬりえをインストールすれば楽しみが無限大に。</p>
                    </div>
                  </section>
                </div>
                {!authUser ? (
                  <button className="btn lpAccountCreateButton" type="button" onClick={openSignupPanel}>
                    アカウントを作成する
                  </button>
                ) : null}
              </section>
              <section className="featureBand lpImaginationBand" aria-labelledby="lp-imagination-title">
                <div className="featureInner lpImaginationBandInner">
                  <h2 id="lp-imagination-title">Reveal the imagination within.</h2>
                  {lpTryRandomIllustration ? (
                    <button
                      className="lpTryPreviewFrame"
                      type="button"
                      onClick={() => chooseIllustration(lpTryRandomIllustration.id)}
                      aria-label={`${lpTryRandomIllustration.title}のぬりえをためしにやってみる`}
                    >
                      <div className="lpMiniPaper lpTryPreviewPaper">
                        <IllustrationThumb illustration={lpTryRandomIllustration} />
                      </div>
                    </button>
                  ) : null}
                  <button
                    className="btn bandLink lpImaginationButton"
                    type="button"
                    onClick={() => chooseIllustration(lpTryRandomIllustration ? lpTryRandomIllustration.id : 'animal-11')}
                  >
                    ためしにやってみる
                  </button>
                </div>
              </section>
            </>
          ) : (
          <section className="homeCatalog" aria-labelledby="home-title">
            <div className={`homeIntro ${(showQuizCatalog && !selectedCategory) || selectedCategoryHasQuiz ? 'learningIntro' : ''}`}>
            <div>
              <h1 id="home-title">
                {selectedCategory ? categoryDisplayTitle(selectedCategory) : showQuizCatalog ? 'まなぶ' : showPlayCatalog ? 'あそぶ' : 'カテゴリーを選ぶ'}
              </h1>
              {!selectedCategory ? (
                <p>
                  {showQuizCatalog
                      ? (
                        <>
                          遊びながらたのしく学べる<br className="learnIntroBreak" />
                          ぬりえを集めました。<br />
                          クイズモードでは、<br className="learnIntroBreak" />
                          正しい配色に塗れるか挑戦できます。
                        </>
                      )
                      : showPlayCatalog
                        ? '自由に楽しめるぬりえです。'
                      : authUser ? `${authUser.email} でログイン中` : 'ログインすると作品を保存できます。'}
                </p>
              ) : null}
            </div>
            {selectedCategory ? (
              <div className="introActions">
                <button className="btn categoryBackButton" type="button" onClick={backToCategorySelection}>
                  カテゴリー選択へ
                </button>
                {selectedCategoryHasQuiz ? renderChallengeButton() : null}
                {selectedCategoryHasQuiz ? renderQuizModeSwitch() : null}
              </div>
            ) : showQuizCatalog ? (
              <div className="introActions">
                {renderQuizModeSwitch()}
              </div>
            ) : null}
            </div>
          {categoryChipBar ? (
            <CategoryChips
              ariaLabel="カテゴリーをしぼりこむ"
              activeId={viewingGroupAll ? null : selectedCategoryId}
              items={categoryChipBar.chips.map((chip) => ({ id: chip.id, label: chip.title }))}
              onChange={(id) => chooseCategoryChip(id ?? categoryChipBar.groupId)}
            />
          ) : null}
          {selectedCategory && categoryTagBar ? (
            <CategoryChips
              compact
              className="categoryTagChips"
              ariaLabel={categoryTagBar.ariaLabel}
              activeId={selectedTag}
              items={categoryTagBar.tags.map((tag) => ({ id: tag.id, label: tag.label }))}
              onChange={(id) => setCategoryTag(id ? { categoryId: selectedCategory.id, tag: id } : null)}
            />
          ) : null}
          {selectedCategory ? (
            <section className="homeGrid" aria-label="イラスト一覧">
              {displayedCategoryIllustrations.map((it, idx) => (
                libraryByIllustrationId.has(it.id) ? (
                  <div className="homeCard libraryHomeCard" key={it.id} style={{ ['--stagger' as never]: `${Math.min(idx, 12)}` }}>
                    <button className="homeCardMain" type="button" onClick={() => chooseIllustration(it.id)}>
                      {checkedIds.has(it.id) ? <CheckBadge kind={checkKind} /> : null}
                      <div className="homeThumb" aria-hidden="true">
                        <div className="thumbPaper">
                          <IllustrationThumb illustration={it} />
                        </div>
                      </div>
                      <div className="homeMeta">
                        <strong>{it.title}</strong>
                        <span>{it.subtitle}</span>
                      </div>
                    </button>
                    <button className="downloadLink savedDeleteLink libraryRemoveButton" type="button" onClick={() => {
                      const lineart = libraryByIllustrationId.get(it.id)
                      if (lineart) void removeLineartFromPlay(lineart)
                    }}>
                      あそぶから削除
                    </button>
                  </div>
                ) : (
                  <button
                    key={it.id}
                    type="button"
                    className="homeCard"
                    onClick={() => chooseIllustration(it.id)}
                    style={{ ['--stagger' as never]: `${Math.min(idx, 12)}` }}
                  >
                    {checkedIds.has(it.id) ? <CheckBadge kind={checkKind} /> : null}
                    <div className="homeThumb" aria-hidden="true">
                      <div className="thumbPaper">
                        <IllustrationThumb illustration={it} />
                      </div>
                    </div>
                    <div className="homeMeta">
                      <strong>{it.title}</strong>
                      <span>{it.subtitle}</span>
                    </div>
                  </button>
                )
              ))}
            </section>
          ) : (
            <section className="homeGrid categoryGrid" aria-label="カテゴリー一覧">
              {catalogItems.map((item) => {
                if (item.type === 'group') {
                  return <h2 className="categoryGroupHeading" key={`group-${item.id}`}>{item.title}</h2>
                }
                const { category, index: idx } = item
                const previews = category.illustrationIds
                  .slice(0, 4)
                  .map((id) => allIllustrations.find((it) => it.id === id))
                  .filter((it): it is IllustrationDef => Boolean(it))
                return (
              <button
                key={category.id}
                type="button"
                className="homeCard categoryCard"
                onClick={() => chooseCategory(category.id)}
                style={{ ['--stagger' as never]: `${Math.min(idx, 12)}` }}
              >
                <div className="categoryThumb" aria-hidden="true">
                  {previews.map((it) => (
                    <div className="thumbPaper" key={it.id}>
                      <IllustrationThumb illustration={it} />
                    </div>
                  ))}
                </div>
                <div className="homeMeta">
                  <strong>{category.title}</strong>
                </div>
              </button>
                )
              })}
            </section>
          )}
          </section>
          )}
          {!selected ? (
            <footer className="siteFooter">
              <div className="footerBrand" aria-label="ぬりえペイント">
                <img src="/icons/nuriepaint-mark.png" alt="" aria-hidden="true" />
                <span className="titleCoral">ぬ</span>
                <span className="titleOrange">り</span>
                <span className="titleBlue">え</span>
                <span className="titleCoral">ペ</span>
                <span className="titleOrange">イ</span>
                <span className="titleBlue">ン</span>
                <span className="titleCoral">ト</span>
              </div>
              <nav className="footerLinks" aria-label="フッター">
                <button type="button" onClick={() => setTermsOpen(true)}>利用規約</button>
                <button type="button" onClick={() => setPrivacyOpen(true)}>プライバシーポリシー</button>
                <button type="button" onClick={() => setContactOpen(true)}>お問い合わせ</button>
              </nav>
              <p className="footerCopyright">© 2026 ぬりえペイント</p>
            </footer>
          ) : null}
        </main>
      )}
      {settingsOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="設定" {...backdropCloseProps(() => setSettingsOpen(false))}>
          <div className="modal settingsPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">設定</div>
                <div className="modalSub">塗り絵画面の表示を選べます。</div>
              </div>
              <button className="btn" type="button" onClick={() => setSettingsOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="settingsBody">
              <section className="settingsSection" aria-labelledby="color-settings-title">
                <div>
                  <h2 id="color-settings-title">色の操作</h2>
                  <p>下部の色エリアに表示するもの</p>
                </div>
                <div className="settingsOptions">
                  <label className="settingToggle">
                    <input type="checkbox" checked={showColorSliders} onChange={(ev) => setShowColorSliders(ev.target.checked)} />
                    <span>スライダー</span>
                  </label>
                  <label className="settingToggle">
                    <input type="checkbox" checked={showColorSwatches} onChange={(ev) => setShowColorSwatches(ev.target.checked)} />
                    <span>カラーパレット</span>
                  </label>
                </div>
              </section>
              <section className="settingsSection" aria-labelledby="color-mode-title">
                <div className="settingsCopy">
                  <h2 id="color-mode-title">色の作り方</h2>
                  <p>スライダーの種類を選べます。</p>
                </div>
                <div className="settingsOptions">
                  <label className="settingToggle">
                    <input type="radio" name="color-control-mode" checked={colorControlMode === 'rgb'} onChange={() => setColorControlMode('rgb')} />
                    <span>RGB</span>
                  </label>
                  <label className="settingToggle">
                    <input type="radio" name="color-control-mode" checked={colorControlMode === 'cmy'} onChange={() => setColorControlMode('cmy')} />
                    <span>CMY</span>
                  </label>
                  <label className="settingToggle">
                    <input type="radio" name="color-control-mode" checked={colorControlMode === 'hsl'} onChange={() => setColorControlMode('hsl')} />
                    <span>HSV</span>
                  </label>
                </div>
              </section>
              <section className="settingsPreviewSection paletteEditSection" aria-labelledby="palette-edit-title">
                <div className="paletteEditHead">
                  <div>
                    <h2 id="palette-edit-title">カラーパレットの色</h2>
                  </div>
                  {paletteEditorOpen ? (
                    <div className="paletteEditActions">
                      <button className="btn primaryAction" type="button" onClick={replaceSelectedPaletteColor}>
                        パレットにいれる
                      </button>
                      <button className="btn iconButton closePaletteEditorButton" type="button" onClick={() => setPaletteEditorOpen(false)} aria-label="パレット編集を閉じる" title="閉じる">
                        <span aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn primaryAction"
                      type="button"
                      onClick={() => {
                        setPaletteDraftColor(customSwatches[selectedSwatchIndex]?.hex ?? customSwatches[0]?.hex ?? DEFAULT_SWATCHES[0].hex)
                        setPaletteEditorOpen(true)
                      }}
                    >
                      パレットを編集する
                    </button>
                  )}
                </div>
                {paletteEditorOpen ? (
                  <>
                    <div className="settingsPalettePreview paletteDraftPreview">
                      <Palette value={paletteDraftColor} onChange={setPaletteDraftColor} showSliders controlMode={colorControlMode} showSwatches={false} />
                    </div>
                    <div className="editableSwatches" aria-label="現在のカラーパレット">
                      {customSwatches.map((swatch, index) => (
                        <button
                          className={`swatch editableSwatch ${selectedSwatchIndex === index ? 'activeEditableSwatch' : ''}${isWhiteColor(swatch.hex) ? ' isWhite' : ''}`}
                          type="button"
                          key={`${swatch.name}-${index}`}
                          style={{ background: swatch.hex }}
                          onClick={() => {
                            setSelectedSwatchIndex(index)
                            setPaletteDraftColor(swatch.hex)
                          }}
                          aria-label={`${swatch.name}: ${swatch.hex}`}
                          title={swatch.hex}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </section>
              <section className="settingsPreviewSection" aria-labelledby="settings-preview-title">
                <div>
                  <h2 id="settings-preview-title">表示プレビュー</h2>
                  <p>{settingsPreviewDescription}</p>
                </div>
                <div className="settingsPalettePreview">
                  <Palette value={color} onChange={setColor} showSliders={showColorSliders} showSwatches={showColorSwatches} controlMode={colorControlMode} swatches={customSwatches} />
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {renderChallengeModals()}
      {renderChallengeSetupModal()}
      {quizResult ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="クイズ結果">
          <div className="modal quizResultPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">判定結果</div>
              </div>
              <button className="btn iconButton quizResultCloseButton" type="button" onClick={() => setQuizResult(null)} aria-label="閉じる" title="閉じる">
                <span aria-hidden="true" />
              </button>
            </div>
            <div className="quizResultBody">
              <div className={`quizScoreBadge ${quizResult.passed ? 'passedQuiz' : ''}`}>
                {quizResult.score >= 95 ? '正解！' : `${quizResult.score}%`}
              </div>
              <p>
                {quizResult.passed
                  ? 'よくできました！'
                  : '見本と違う色、またはまだ塗れていない場所があります。'}
              </p>
              {quizResult.passed ? (
                <button className="btn primaryAction quizNextButton" type="button" onClick={goToNextQuizChallenge}>
                  次のぬりえにチャレンジ
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {authOpen ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="アカウント"
          {...backdropCloseProps(() => void closeAuthPanel())}
        >
          <form className="authPanel" onSubmit={submitAuth}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">
                  {authMode === 'signup'
                    ? 'アカウント作成'
                    : authMode === 'signupSent'
                      ? '確認メールを送りました'
                      : authMode === 'signupVerified'
                        ? 'アカウント作成完了'
                        : authMode === 'verifyError'
                          ? 'リンクを開けませんでした'
                          : authMode === 'emailChanged'
                            ? 'メールアドレスを変更しました'
                            : authMode === 'forgot' || authMode === 'forgotSent' || authMode === 'resetPassword' || authMode === 'resetError'
                              ? 'パスワードの再設定'
                    : authMode === 'signupProfile'
                      ? 'プロフィール登録'
                      : authMode === 'signupComplete'
                        ? 'アカウント作成完了！'
                        : authMode === 'profile' && accountProfileEditing
                      ? 'プロフィール登録'
                      : authMode === 'profile'
                        ? 'アカウント'
                        : 'ログイン'}
                </div>
              </div>
              <button className="btn iconButton quizResultCloseButton" type="button" onClick={() => void closeAuthPanel()} aria-label="閉じる" title="閉じる">
                <span aria-hidden="true" />
              </button>
            </div>
            <div className="authBody">
              {authMode === 'signupSent' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="確認メールを送りました">
                  <h2>
                    確認メールを<br className="spBreak" />送りました
                  </h2>
                  {authSentFromSignin ? <p>メールアドレスの確認がまだ完了していません。</p> : null}
                  <p>
                    <strong className="verifyEmail">{authEmail}</strong>
                    <span className="pcSpace">{' '}</span>に<br className="spBreak" />確認メールを送りました。
                    <br />
                    メールに書かれているリンクを開くと、アカウント作成が完了します。
                  </p>
                  <p className="verifyHint">メールが届かないときは、迷惑メールフォルダも確認してください。</p>
                  <button className="btn" type="button" onClick={resendVerificationEmail} disabled={verifyResendBusy}>
                    確認メールをもう一度送る
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setAuthMode(authSentFromSignin ? 'signin' : 'signup')
                      setStatus('')
                    }}
                  >
                    {authSentFromSignin ? 'ログイン画面へ' : 'メールアドレスを入力し直す'}
                  </button>
                </section>
              ) : null}
              {authMode === 'signupVerified' ? (
                <section className="signupCompletePanel signupVerifiedPanel" aria-label="アカウントが作成できました">
                  <h2>
                    アカウントが<br className="spBreak" />作成できました
                  </h2>
                  <p>
                    メールアドレスの確認が<br className="spBreak" />完了しました。
                  </p>
                  <p>名前とアイコンを設定しましょう。</p>
                  <button className="btn primaryAction signupCompleteButton" type="button" onClick={() => void startSignupProfile()}>
                    プロフィールを設定する
                  </button>
                </section>
              ) : null}
              {authMode === 'verifyError' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="リンクを開けませんでした">
                  <h2>リンクを開けませんでした</h2>
                  <p>{verifyError === 'TOKEN_EXPIRED' ? 'リンクの有効期限が切れています。' : 'リンクが正しくないか、すでに使われています。'}</p>
                  <p className="verifyHint">メールアドレスを入力して、確認メールをもう一度送ってください。</p>
                  <label className="field verifyEmailField">
                    <span>メール</span>
                    <input value={authEmail} onChange={(ev) => setAuthEmail(ev.target.value)} type="email" autoComplete="email" />
                  </label>
                  <button className="btn primaryAction" type="button" onClick={resendVerificationEmail} disabled={verifyResendBusy || !authEmail.trim()}>
                    確認メールを送る
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setAuthMode('signin')
                      setStatus('')
                    }}
                  >
                    ログイン画面へ
                  </button>
                </section>
              ) : null}
              {authMode === 'forgot' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="パスワードの再設定">
                  <h2>
                    パスワードの<br className="spBreak" />再設定
                  </h2>
                  <p>
                    登録したメールアドレスを<br className="spBreak" />入力してください。
                    <br />
                    パスワード再設定用の<br className="spBreak" />メールを送ります。
                  </p>
                  <label className="field verifyEmailField">
                    <span>メール</span>
                    <input value={authEmail} onChange={(ev) => setAuthEmail(ev.target.value)} type="email" autoComplete="email" required />
                  </label>
                  <button className="btn primaryAction" type="submit" disabled={resetMailBusy}>
                    再設定メールを送る
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setAuthMode('signin')
                      setStatus('')
                    }}
                  >
                    ログイン画面へ
                  </button>
                </section>
              ) : null}
              {authMode === 'forgotSent' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="再設定メールを送りました">
                  <h2>
                    再設定メールを<br className="spBreak" />送りました
                  </h2>
                  <p>
                    <strong className="verifyEmail">{authEmail}</strong>
                    <span className="pcSpace">{' '}</span>に<br className="spBreak" />パスワード再設定用の<br className="spBreak" />メールを送りました。
                    <br />
                    メールのリンクを開いて、新しいパスワードを設定してください。
                  </p>
                  <p className="verifyHint">メールが届かないときは、迷惑メールフォルダも確認してください。登録されていないメールアドレスには届きません。リンクの有効期限は1時間です。</p>
                  <button className="btn" type="button" onClick={sendPasswordResetFromForm} disabled={resetMailBusy}>
                    再設定メールをもう一度送る
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setResetMailBusy(false)
                      setAuthMode('forgot')
                      setStatus('')
                    }}
                  >
                    メールアドレスを入力し直す
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setAuthMode('signin')
                      setStatus('')
                    }}
                  >
                    ログイン画面へ
                  </button>
                </section>
              ) : null}
              {authMode === 'resetPassword' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="新しいパスワードを設定">
                  <h2>
                    新しい<br className="spBreak" />パスワードを設定
                  </h2>
                  <p>
                    新しいパスワードを<br className="spBreak" />入力してください。
                  </p>
                  <label className="field verifyEmailField">
                    <span>新しいパスワード</span>
                    <PasswordInput value={resetNewPassword} onChange={(ev) => setResetNewPassword(ev.target.value)} autoComplete="new-password" minLength={8} required />
                  </label>
                  <label className="field verifyEmailField">
                    <span>新しいパスワード（確認）</span>
                    <PasswordInput value={resetNewPasswordConfirm} onChange={(ev) => setResetNewPasswordConfirm(ev.target.value)} autoComplete="new-password" minLength={8} required />
                  </label>
                  <p className="verifyHint">8文字以上で入力してください。</p>
                  <button className="btn primaryAction" type="submit">
                    パスワードを変更する
                  </button>
                </section>
              ) : null}
              {authMode === 'resetError' ? (
                <section className="signupCompletePanel verifyPanel" aria-label="リンクを開けませんでした">
                  <h2>
                    リンクを<br className="spBreak" />開けません
                  </h2>
                  <p>
                    期限が切れているか、<br className="spBreak" />すでに使われたリンクです。
                  </p>
                  <button
                    className="btn primaryAction"
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot')
                      setStatus('')
                    }}
                  >
                    再設定メールをもう一度送る
                  </button>
                  <button
                    className="linkBtn"
                    type="button"
                    onClick={() => {
                      setAuthMode('signin')
                      setStatus('')
                    }}
                  >
                    ログイン画面へ
                  </button>
                </section>
              ) : null}
              {authMode === 'emailChanged' ? (
                <section className="signupCompletePanel" aria-label="メールアドレスを変更しました">
                  <h2>メールアドレスを変更しました</h2>
                  <p>これからは新しいメールアドレスでログインできます。</p>
                  <button className="btn primaryAction signupCompleteButton" type="button" onClick={() => setAuthOpen(false)}>
                    閉じる
                  </button>
                </section>
              ) : null}
              {authMode === 'signupComplete' ? (
                <section className="signupCompletePanel" aria-label="アカウント作成完了">
                  <h2>アカウント作成完了！</h2>
                  <p>さっそくぬりえをやってみましょう。</p>
                  <button className="btn primaryAction signupCompleteButton" type="button" onClick={startAfterSignup}>
                    はじめる
                  </button>
                </section>
              ) : null}
              {authMode === 'profile' && !accountProfileEditing ? (
                <>
                  <section className="accountProfileSummary" aria-label="プロフィール">
                    {authProfile ? (
                      <ProfileIcon profile={authProfile} />
                    ) : (
                      <ProfileIcon profile={{ motifId: authMotifId, iconColor: authIconColor, imageUrl: getProfileMotifImage(authMotifId) }} />
                    )}
                    <div>
                      <span>なまえ</span>
                      <strong>{authName || authUser?.name || authUser?.email}</strong>
                    </div>
                    <button className="btn accountEditButton" type="button" onClick={startAccountProfileEditing} aria-label="プロフィールを編集" title="プロフィールを編集">
                      <span>編集する</span>
                      <EditPencilIcon />
                    </button>
                  </section>
                  <section className="accountSecuritySection" aria-label="アカウント情報">
                    <div className="accountSectionHead">
                      <div>
                        <h3>登録メールアドレス</h3>
                        <p>{authUser?.email}</p>
                      </div>
                      <button
                        className="btn compactSecondaryButton"
                        type="button"
                        onClick={() => {
                          setAccountEmailValue(authUser?.email ?? '')
                          setAccountEmailEditing((open) => !open)
                          setAccountEmailMessage('')
                        }}
                      >
                        {accountEmailEditing ? '閉じる' : '変更する'}
                      </button>
                    </div>
                    {accountEmailEditing ? (
                      <div
                        className="accountInlineForm"
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault()
                            void submitAccountEmailChange()
                          }
                        }}
                      >
                        <label className="field">
                          <span>新しいメール</span>
                          <input value={accountEmailValue} onChange={(ev) => setAccountEmailValue(ev.target.value)} type="email" autoComplete="email" required />
                        </label>
                        <button className="btn primaryAction" type="button" onClick={submitAccountEmailChange}>
                          確認メールを送る
                        </button>
                      </div>
                    ) : null}
                    {accountEmailMessage ? <p className="accountSettingMessage">{accountEmailMessage}</p> : null}
                  </section>
                  <section className="accountTextActionSection" aria-label="パスワード">
                    <button
                      className="accountTextLink"
                      type="button"
                      onClick={() => {
                        setAccountPasswordOpen((open) => !open)
                        setAccountPasswordMessage('')
                        setAccountPasswordSent(false)
                      }}
                    >
                      パスワードを変更する
                    </button>
                    {accountPasswordOpen ? (
                      <div className="accountInlineForm accountPasswordForm">
                        {accountPasswordSent ? (
                          <p className="accountSettingMessage">{authUser?.email} に再設定用のメールを送りました。メールのリンクを開いて、新しいパスワードを入力してください。</p>
                        ) : (
                          <p className="accountSettingMessage">登録しているメールアドレスに、パスワード再設定用のメールを送ります。</p>
                        )}
                        <button className="btn primaryAction" type="button" onClick={sendAccountPasswordResetEmail} disabled={resetMailBusy}>
                          再設定メールを送る
                        </button>
                      </div>
                    ) : null}
                    {accountPasswordMessage ? <p className="accountSettingMessage">{accountPasswordMessage}</p> : null}
                  </section>
                  <section className="accountSecuritySection safetyLockSection" aria-label="セーフティーロック">
                    <div className="accountSectionHead">
                      <div>
                        <h3>セーフティーロック</h3>
                        <p>オンにすると、ぬりえをアップロードするときにアカウントのパスワードが必要になります。</p>
                      </div>
                      <button
                        className={`publishToggle safetyLockToggle ${safetyLockEnabled ? 'publishToggleOn' : 'publishToggleOff'}`}
                        type="button"
                        role="switch"
                        aria-checked={safetyLockEnabled}
                        onClick={toggleSafetyLock}
                        disabled={safetyLockBusy}
                      >
                        <span className="publishToggleTrack" aria-hidden="true">
                          <span className="publishToggleKnob" />
                        </span>
                        <span>{safetyLockEnabled ? 'オン' : 'オフ'}</span>
                      </button>
                    </div>
                    {safetyLockOffOpen ? (
                      <div
                        className="accountInlineForm"
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' && safetyLockOffPassword) {
                            ev.preventDefault()
                            void saveSafetyLock(false, safetyLockOffPassword)
                          }
                        }}
                      >
                        <p className="accountSettingMessage">オフにするには、アカウントのパスワードを入力してください。</p>
                        <label className="field">
                          <span>パスワード</span>
                          <PasswordInput
                            value={safetyLockOffPassword}
                            onChange={(ev) => setSafetyLockOffPassword(ev.target.value)}
                            autoComplete="current-password"
                          />
                        </label>
                        <button
                          className="btn primaryAction"
                          type="button"
                          onClick={() => void saveSafetyLock(false, safetyLockOffPassword)}
                          disabled={!safetyLockOffPassword || safetyLockBusy}
                        >
                          ロックをオフにする
                        </button>
                      </div>
                    ) : null}
                    {safetyLockMessage ? <p className="accountSettingMessage" role="status">{safetyLockMessage}</p> : null}
                  </section>
                </>
              ) : null}
              {(authMode === 'profile' && accountProfileEditing) || authMode === 'signupProfile' ? (
                <>
                  <label className={`field accountNameField${authNameError ? ' hasError' : ''}`}>
                    <span>なまえ</span>
                    <input
                      ref={authNameInputRef}
                      value={authName}
                      onChange={(ev) => {
                        setAuthName(ev.target.value)
                        setAuthNameError('')
                      }}
                      autoComplete="name"
                      aria-invalid={authNameError ? true : undefined}
                    />
                    {authNameError ? <span className="accountNameError" role="alert">{authNameError}</span> : null}
                  </label>
                  <div className="profileCreator" aria-label="プロフィールアイコン">
                    <div className="profilePreviewWrap">
                      <div>
                        <strong>プロフィールアイコン</strong>
                      </div>
                    </div>
                    <div className="profileMotifGrid" role="list" aria-label="モチーフ">
                      {PROFILE_MOTIFS.map((motif) => (
                        <button
                          className={`profileMotifButton ${authMotifId === motif.id ? 'activeProfileMotif' : ''}`}
                          type="button"
                          key={motif.id}
                          onClick={() => {
                            setAuthMotifId(motif.id)
                            setAuthIconCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'reset' }))
                          }}
                        >
                          <img src={motif.imageUrl} alt="" aria-hidden="true" />
                          <span>{motif.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="profilePaintArea" ref={authIconEditorRef}>
                      <RasterLineArt
                        key={authMotifId}
                        title={PROFILE_MOTIFS.find((motif) => motif.id === authMotifId)?.label ?? 'アイコン'}
                        source={PROFILE_MOTIFS.find((motif) => motif.id === authMotifId)?.imageUrl ?? `/profile-motifs/${authMotifId}.png`}
                        color={authIconColor}
                        command={authIconCommand}
                        eyedropper={authIconEyedropper}
                        onPickColor={(next) => {
                          setAuthIconColor(next)
                          setAuthIconEyedropper(false)
                        }}
                        restoreImage={authMode === 'profile' && authProfile?.motifId === authMotifId ? { url: authProfile.imageUrl, seq: 1 } : null}
                        paintMask="circle"
                      />
                    </div>
                    <div className="profilePalette">
                      <div className="profilePaletteToolbar" aria-label="プロフィールアイコンの色操作">
                        <div className="profileCurrentColor">
                          <span className={`colorChip${isWhiteColor(authIconColor) ? ' isWhite' : ''}`} style={{ background: authIconColor }} aria-label={`選択中の色: ${authIconColor}`} />
                          <strong>{authIconColor}</strong>
                        </div>
                        <div className="profilePaletteActions">
                          <button className="btn iconButton" type="button" onClick={() => setAuthIconCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'undo' }))} aria-label="戻す" title="戻す">
                            <UndoIcon />
                          </button>
                          <button className="btn iconButton" type="button" onClick={() => setAuthIconCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'redo' }))} aria-label="進む" title="進む">
                            <RedoIcon />
                          </button>
                          <button
                            className={`btn iconButton ${authIconEyedropper ? 'activeTool' : ''}`}
                            type="button"
                            onClick={() => setAuthIconEyedropper((active) => !active)}
                            aria-label="スポイト"
                            title="スポイト"
                          >
                            <EyedropperIcon />
                          </button>
                        </div>
                      </div>
                      <Palette value={authIconColor} onChange={setAuthIconColor} showSliders controlMode={colorControlMode} showSwatches swatches={customSwatches} />
                    </div>
                  </div>
                </>
              ) : null}
              {authMode === 'profile' && !accountProfileEditing ? (
                <div className="accountRecordLink">
                  <button className="btn accountRecordButton" type="button" onClick={() => openRecordPage({ rememberReturn: true })}>
                    {RECORD_PAGE_TITLE}を見る
                  </button>
                </div>
              ) : null}
              {(authMode === 'signin' || authMode === 'signup') ? (
                <>
                  <label className="field">
                    <span>メール</span>
                    <input value={authEmail} onChange={(ev) => setAuthEmail(ev.target.value)} type="email" autoComplete="email" required />
                  </label>
                  <label className="field">
                    <span>パスワード</span>
                    <PasswordInput
                      value={authPassword}
                      onChange={(ev) => setAuthPassword(ev.target.value)}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={8}
                      required
                    />
                  </label>
                  {authMode === 'signup' ? (
                    <>
                      <label className="field">
                        <span>パスワード（確認）</span>
                        <PasswordInput
                          value={signupPasswordConfirm}
                          onChange={(ev) => setSignupPasswordConfirm(ev.target.value)}
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                      </label>
                      <div className="signupAgreement">
                        <label>
                          <input type="checkbox" checked={signupConsent} onChange={(ev) => setSignupConsent(ev.target.checked)} required />
                          <span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setTermsOpen(true)
                              }}
                            >
                              利用規約
                            </button>
                            および
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setPrivacyOpen(true)
                              }}
                            >
                              プライバシーポリシー
                            </button>
                            に同意する
                          </span>
                        </label>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
              {(['signin', 'signup', 'signupProfile'] as string[]).includes(authMode) || (authMode === 'profile' && accountProfileEditing) ? (
                <button className={`btn ${authMode === 'signin' ? 'loginTopButton loginSubmitButton' : authMode === 'signup' ? 'signupTopButton signupSubmitButton' : ''}`} type="submit">
                  {authMode === 'signup' ? '作成する' : authMode === 'profile' || authMode === 'signupProfile' ? '保存する' : 'ログインする'}
                </button>
              ) : null}
              {authMode === 'signin' ? (
                <button
                  className="linkBtn"
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot')
                    setStatus('')
                  }}
                >
                  パスワードを忘れた方
                </button>
              ) : null}
              {(authMode === 'signin' || authMode === 'signup') ? (
                <button
                  className="linkBtn"
                  type="button"
                  onClick={() => {
                    setAuthMode((mode) => (mode === 'signup' ? 'signin' : 'signup'))
                    setStatus('')
                  }}
                >
                  {authMode === 'signup' ? 'ログイン画面へ' : 'アカウントを作る'}
                </button>
              ) : null}
              {authMode === 'profile' && !accountProfileEditing ? (
                <div className="accountDangerActions">
                  <button className="accountLogoutLink" type="button" onClick={signOut}>
                    ログアウト
                  </button>
                  <button className="accountDeleteLink" type="button" onClick={() => setAccountDeleteConfirmOpen(true)}>
                    アカウントを削除する
                  </button>
                </div>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
      {galleryOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="マイギャラリー" {...backdropCloseProps(() => setGalleryOpen(false))}>
          <div className="modal galleryPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">マイギャラリー</div>
                <div className="modalSub">{authUser?.email}</div>
              </div>
              <button className="btn" type="button" onClick={() => setGalleryOpen(false)}>
                閉じる
              </button>
            </div>
            {renderSavedGalleryControls()}
            {savedColorings.length ? renderSavedGalleryCategoryPicker('modalGalleryCategoryPicker') : null}
            <div className="galleryBody">
              {savedColorings.length ? (
                <>
                  {activeGallerySection ? (
                    <section className="gallerySection" aria-label={activeGallerySection.title}>
                      {galleryGroupMode === 'category' ? <h3>{activeGallerySection.title}</h3> : null}
                    <div className="galleryGrid">
                      {activeGallerySection.items.map((item) => (
                        <figure className="savedCard" key={item.id}>
                          <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: 'マイギャラリー', imageUrl: item.imageUrl, illustrationId: item.illustrationId, continueItem: item })}>
                            <img src={item.imageUrl} alt={item.title} />
                          </button>
                          <figcaption>
                            <div className="savedInfo">
                              <strong>{item.title}</strong>
                              <span>作成: {formatDateDisplay(item.createdAt)}</span>
                            </div>
                            <div className="savedActions">
                              {renderPublishToggle(item)}
                              <button className="btn savedContinueButton" type="button" onClick={() => continueColoring(item)}>
                                続きからやる
                              </button>
                              <button className="btn iconButton savedDeleteButton" type="button" onClick={() => setDeleteTarget(item)} aria-label="削除" title="削除">
                                <TrashIcon />
                              </button>
                            </div>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="emptyGallery">まだ保存された塗り絵はありません。</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {imagePreview ? (
        <div className="modalOverlay imagePreviewOverlay" role="dialog" aria-modal="true" aria-label={`${imagePreview.title}の拡大表示`}>
          <div className="modal imagePreviewPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">{imagePreview.title}</div>
                {imagePreview.subtitle ? <div className="modalSub">{imagePreview.subtitle}</div> : null}
              </div>
              <button className="btn" type="button" onClick={() => setImagePreview(null)}>
                閉じる
              </button>
            </div>
            <div className="imagePreviewBody">
              <img src={imagePreview.imageUrl} alt={imagePreview.title} />
            </div>
            {(imagePreview.illustrationId && !isLearningColoring(imagePreview.illustrationId)) || imagePreview.continueItem ? (
              <div className={`imagePreviewActions imagePreviewCommunityActions ${imagePreview.continueItem ? 'hasContinue' : ''}`}>
                {imagePreview.continueItem ? (
                  <button className="btn imagePreviewContinueButton" type="button" onClick={() => continueColoring(imagePreview.continueItem!)}>
                    続きから
                  </button>
                ) : null}
                {imagePreview.illustrationId && !isLearningColoring(imagePreview.illustrationId) ? (
                  <button className="btn imagePreviewCommunityButton" type="button" onClick={() => viewCommunityForIllustration(imagePreview.illustrationId!)}>
                    みんなの作品もみてみる
                  </button>
                ) : null}
              </div>
            ) : null}
            {hasReportInfo(imagePreview) ? (
              <div className="imagePreviewActions">
                <a className="reportButton" href={buildReportMailto(imagePreview)}>
                  報告する
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="保存済み塗り絵の削除確認">
          <div className="modal confirmPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">削除しますか？</div>
                <div className="modalSub">この操作は取り消せません。</div>
              </div>
            </div>
            <div className="confirmBody">
              <p>
                <strong>{deleteTarget.title}</strong> を保存済みから削除します。
              </p>
              <div className="confirmActions">
                <button className="btn" type="button" onClick={() => setDeleteTarget(null)}>
                  キャンセル
                </button>
                <button className="btn btnDanger" type="button" onClick={deleteColoring}>
                  削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {lineartDeleteTarget ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="アップロードしたぬりえの削除確認">
          <div className="modal confirmPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">削除しますか？</div>
                <div className="modalSub">この操作は取り消せません。</div>
              </div>
            </div>
            <div className="confirmBody">
              <p>
                <strong>{lineartDeleteTarget.title}</strong> をアップロードしたぬりえから削除します。
              </p>
              <div className="confirmActions">
                <button className="btn" type="button" onClick={() => setLineartDeleteTarget(null)}>
                  キャンセル
                </button>
                <button className="btn btnDanger" type="button" onClick={deleteUploadedLineart}>
                  削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {accountDeleteConfirmOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="アカウント削除確認">
          <div className="modal confirmPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">アカウントを削除しますか？</div>
                <div className="modalSub">保存した作品や設定も削除されます。</div>
              </div>
            </div>
            <div className="confirmBody">
              <p>
                アカウントを削除すると、保存済みのぬりえ、アップロードしたぬりえ、クイズ結果、プロフィール情報を元に戻せません。
              </p>
              <div className="confirmActions">
                <button className="btn" type="button" onClick={() => setAccountDeleteConfirmOpen(false)}>
                  キャンセル
                </button>
                <button className="btn btnDanger" type="button" onClick={deleteAccount}>
                  削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {uploadPreviewOpen && uploadPreviewUrl ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="アップロード前の確認">
          <div className="modal uploadPreviewPanel">
            <div className="modalHead uploadPreviewHead">
              <div>
                <div className="modalTitle">アップロード前の確認</div>
                <div className="modalSub">実際に塗って、線が途切れていないか確認してください。</div>
              </div>
              <div className="uploadPreviewHeadActions">
                <button
                  className="btn btnDanger uploadPreviewResetButton"
                  type="button"
                  onClick={() => setUploadPreviewCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'reset' }))}
                >
                  リセット
                </button>
                {lineartIsLearning && uploadPreviewRefUrl ? (
                  <button className="btn uploadPreviewToggleButton" type="button" onClick={() => setUploadPreviewShowRef((value) => !value)}>
                    {uploadPreviewShowRef ? '線画にもどす' : '見本と比べる'}
                  </button>
                ) : null}
                <button className="btn uploadPreviewCloseButton" type="button" onClick={closeUploadPreview}>
                  閉じる
                </button>
              </div>
            </div>
            <div className="uploadPreviewBody">
              <div className="uploadPreviewStage">
                {uploadPreviewShowRef && uploadPreviewRefUrl ? (
                  <img className="uploadPreviewRefImage" src={uploadPreviewRefUrl} alt="見本" />
                ) : (
                  <RasterLineArt
                    key="line"
                    title={lineartTitle || 'アップロード確認用プレビュー'}
                    source={uploadPreviewUrl}
                    color={uploadPreviewColor}
                    command={uploadPreviewCommand}
                    brush={uploadPreviewBrush}
                    eyedropper={uploadPreviewEyedropper}
                    onPickColor={(pickedColor) => {
                      setUploadPreviewColor(pickedColor)
                      setUploadPreviewEyedropper(false)
                    }}
                  />
                )}
              </div>
              {uploadPreviewShowRef ? (
                <p className="uploadPreviewHint">
                  見本と線画を見比べて、配色がずれていないか確認してください。
                </p>
              ) : null}
              <div className="uploadPreviewDock">
                <Palette
                  value={uploadPreviewColor}
                  onChange={setUploadPreviewColor}
                  showSliders
                  showSwatches
                  swatches={customSwatches}
                  actions={(
                    <>
                      <button
                        className="btn iconButton paletteActionButton"
                        type="button"
                        onClick={() => setUploadPreviewCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'undo' }))}
                        aria-label="戻す"
                        title="戻す"
                      >
                        <UndoIcon />
                      </button>
                      <button
                        className="btn iconButton paletteActionButton"
                        type="button"
                        onClick={() => setUploadPreviewCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'redo' }))}
                        aria-label="進む"
                        title="進む"
                      >
                        <RedoIcon />
                      </button>
                      <button
                        className={`btn iconButton paletteActionButton uploadPreviewBrushButton ${uploadPreviewBrush ? 'activeTool' : ''}`}
                        type="button"
                        onClick={() => { setUploadPreviewBrush((value) => !value); setUploadPreviewEyedropper(false) }}
                        aria-label="ブラシ"
                        title="ブラシ"
                      >
                        <BrushIcon />
                      </button>
                      <button
                        className={`btn iconButton paletteActionButton ${uploadPreviewEyedropper ? 'activeTool' : ''}`}
                        type="button"
                        onClick={() => { setUploadPreviewEyedropper((value) => !value); setUploadPreviewBrush(false) }}
                        aria-label="スポイト"
                        title="スポイト"
                      >
                        <EyedropperIcon />
                      </button>
                    </>
                  )}
                />
              </div>
              <div className="uploadAgreementList">
                <label className="uploadAgreementItem">
                  <input type="checkbox" checked={uploadAgreeCopyright} onChange={(ev) => setUploadAgreeCopyright(ev.target.checked)} />
                  <span>既存のキャラクター等の著作権に抵触する可能性がない</span>
                </label>
                <label className="uploadAgreementItem">
                  <input type="checkbox" checked={uploadAgreePrivacy} onChange={(ev) => setUploadAgreePrivacy(ev.target.checked)} />
                  <span>プライバシーに抵触するものではない</span>
                </label>
                <label className="uploadAgreementItem">
                  <input type="checkbox" checked={uploadAgreeDecency} onChange={(ev) => setUploadAgreeDecency(ev.target.checked)} />
                  <span>公序良俗に反する表現が含まれない</span>
                </label>
              </div>
              <p className="uploadAgreementWarning">
                上記に抵触する投稿をした場合は、アカウント停止・削除措置が行われます。
              </p>
              <button
                className="btn primaryAction uploadSubmitButton"
                type="button"
                disabled={!uploadAgreeCopyright || !uploadAgreePrivacy || !uploadAgreeDecency}
                onClick={requestUploadLineart}
              >
                アップロードする
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {uploadPreviewOpen && uploadPreviewUrl && uploadPasswordOpen ? (
        <div className="modalOverlay safetyLockOverlay" role="dialog" aria-modal="true" aria-label="パスワードの確認">
          <form
            className="modal confirmPanel safetyLockDialog"
            onSubmit={(ev) => {
              ev.preventDefault()
              if (uploadPassword && !uploadPasswordBusy) void confirmUploadLineart(uploadPassword)
            }}
          >
            <div className="modalHead">
              <div>
                <div className="modalTitle">パスワードを入力してください</div>
                <div className="modalSub">セーフティーロックがオンになっています。</div>
              </div>
            </div>
            <div className="confirmBody">
              <p>ぬりえをアップロードするには、アカウントのパスワードが必要です。</p>
              <label className="field">
                <span>パスワード</span>
                <PasswordInput
                  value={uploadPassword}
                  onChange={(ev) => setUploadPassword(ev.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>
              {uploadPasswordError ? <p className="safetyLockError" role="alert">{uploadPasswordError}</p> : null}
              <div className="confirmActions">
                <button className="btn" type="button" onClick={closeUploadPasswordDialog} disabled={uploadPasswordBusy}>
                  キャンセル
                </button>
                <button className="btn primaryAction" type="submit" disabled={!uploadPassword || uploadPasswordBusy}>
                  {uploadPasswordBusy ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      {contactOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="お問い合わせ">
          <div className="modal privacyPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">お問い合わせ</div>
                <div className="modalSub">ご意見、不具合、公開内容のご相談はこちらから。</div>
              </div>
              <button className="btn" type="button" onClick={() => setContactOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="privacyBody">
              <p>ぬりえペイントへのお問い合わせは、以下のメールアドレスまでお願いします。</p>
              <p>
                <a className="contactMailLink" href="mailto:tzlt.73.san@gmail.com?subject=%E3%81%AC%E3%82%8A%E3%81%88%E3%83%9A%E3%82%A4%E3%83%B3%E3%83%88%E3%81%B8%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B">
                  tzlt.73.san@gmail.com
                </a>
              </p>
              <h2>お問い合わせ時にあると助かる情報</h2>
              <p>不具合の場合は、使っていた端末、画面名、起きたこと、可能であればスクリーンショットを添えてください。公開作品やぬりえ素材についてのご相談は、対象のタイトルやURLがあると確認しやすくなります。</p>
            </div>
          </div>
        </div>
      ) : null}
      {termsOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="利用規約">
          <div className="modal privacyPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">利用規約（叩き台）</div>
                <div className="modalSub">公開前に運営実態に合わせて確認してください。</div>
              </div>
              <button className="btn" type="button" onClick={() => setTermsOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="privacyBody">
              <p>この利用規約（以下「本規約」）は、ぬりえペイント（以下「本サービス」）の利用条件を定めるものです。本サービスを利用する方は、本規約に同意したものとみなします。</p>
              <h2>本サービスについて</h2>
              <p>本サービスは、ぬりえの作成、色塗り、作品保存、クイズモード、作品やぬりえ素材の共有などを提供します。提供する機能は、予告なく追加、変更、停止することがあります。</p>
              <h2>アカウント</h2>
              <p>アカウントを作成する場合、利用者は正確な情報を登録し、自分の責任でログイン情報を管理してください。第三者による不正利用が疑われる場合は、すみやかに運営へ連絡してください。</p>
              <h2>子どもの利用</h2>
              <p>子どもが本サービスを利用する場合は、保護者または先生など管理者の確認と見守りのもとで利用してください。個人を特定できる情報を作品名、名前、アップロード素材などに含めないよう注意してください。</p>
              <h2>保存・公開される内容</h2>
              <p>利用者は、保存した作品、公開した作品、アップロードしたぬりえ素材について、必要な権利を持っていること、または権利者から許可を得ていることを保証するものとします。</p>
              <h2>公開機能</h2>
              <p>作品やぬりえ素材を公開すると、他の利用者が閲覧したり、自分のぬりえとして追加したりできる場合があります。公開前に、個人情報や第三者の権利を侵害する内容が含まれていないか確認してください。</p>
              <h2>禁止事項</h2>
              <p>著作権、商標権、肖像権、プライバシーなど第三者の権利を侵害する行為、公序良俗に反する内容を投稿または公開する行為、他者への嫌がらせ、不正アクセス、サービス運営を妨げる行為は禁止します。</p>
              <h2>削除・利用制限</h2>
              <p>運営は、不適切または本規約に違反すると判断した作品、ぬりえ素材、アカウントについて、事前の通知なく削除、非公開化、利用制限を行うことがあります。</p>
              <h2>知的財産権</h2>
              <p>本サービスに含まれるデザイン、プログラム、文章、ロゴなどの権利は、運営または正当な権利者に帰属します。利用者が作成した作品やアップロードした素材の権利は、原則として利用者または元の権利者に帰属します。</p>
              <h2>免責事項</h2>
              <p>運営は、本サービスが常に正確、安全、継続的に利用できることを保証しません。利用者間または第三者との間で生じたトラブルについて、運営は法令上必要な範囲を除き責任を負いません。</p>
              <h2>退会・アカウント削除</h2>
              <p>利用者は、アカウント画面からアカウント削除を行うことができます。削除後は、保存作品、公開作品、アップロード素材などが復元できない場合があります。</p>
              <h2>規約の変更</h2>
              <p>本規約は、機能追加、運営方針の変更、法令改正などに応じて更新することがあります。重要な変更がある場合は、サービス上でわかりやすく知らせます。</p>
              <p className="privacyNote">注: これは叩き台です。公開時は、実際の運営者名、問い合わせ先、対象年齢、公開機能の仕様、削除基準、対象地域の法令に合わせて専門家確認をおすすめします。</p>
            </div>
          </div>
        </div>
      ) : null}
      {privacyOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="プライバシーポリシー">
          <div className="modal privacyPanel">
            <div className="modalHead">
              <div>
                <div className="modalTitle">プライバシーポリシー（叩き台）</div>
                <div className="modalSub">公開前に運営実態に合わせて確認してください。</div>
              </div>
              <button className="btn" type="button" onClick={() => setPrivacyOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="privacyBody">
              <p>ぬりえペイント（以下「本サービス」）は、利用者のプライバシーを尊重し、取得する情報を必要な範囲に限定して取り扱います。</p>
              <h2>取得する情報</h2>
              <p>アカウント作成時のメールアドレス、表示名、ログイン状態、保存された塗り絵画像、利用日時など、サービス提供に必要な情報を取得する場合があります。</p>
              <h2>利用目的</h2>
              <p>ログイン、作品の保存と表示、機能改善、不正利用の防止、問い合わせ対応のために利用します。広告配信や不要な第三者販売を目的として利用しません。</p>
              <h2>子どもの利用</h2>
              <p>子どもが利用する場合は、保護者または先生の管理のもとで利用されることを想定しています。必要以上の個人情報を入力しない設計を心がけます。</p>
              <h2>第三者提供</h2>
              <p>法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。外部サービスを利用する場合は、保存・認証など必要な範囲に限定します。</p>
              <h2>保存期間と削除</h2>
              <p>保存された作品やアカウント情報は、利用目的に必要な期間保持します。削除依頼があった場合は、本人確認のうえ合理的な範囲で対応します。</p>
              <h2>安全管理</h2>
              <p>不正アクセス、紛失、改ざん、漏えいを防ぐため、アクセス制限や適切な管理方法を検討・実施します。</p>
              <h2>改定</h2>
              <p>本ポリシーは、機能追加や法令変更に応じて更新することがあります。重要な変更がある場合は、サービス上でわかりやすく知らせます。</p>
              <p className="privacyNote">注: これは叩き台です。公開時は、実際の運営者名、問い合わせ先、利用する外部サービス、対象地域の法令に合わせて専門家確認をおすすめします。</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type AuthMode =
  | 'signin'
  | 'signup'
  | 'signupSent'
  | 'signupVerified'
  | 'signupProfile'
  | 'signupComplete'
  | 'verifyError'
  | 'emailChanged'
  | 'forgot'
  | 'forgotSent'
  | 'resetPassword'
  | 'resetError'
  | 'profile'

// かくしページ（https://nuriepaint.com/ringo-mikan-lemon）を開いているか。
// wrangler.jsonc の not_found_handling が single-page-application なので、この道筋でも index.html が返ってくる。
function readSecretMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.replace(/\/+$/, '') === SECRET_PATH
}

// 認証メールのリンクを開いたあとに戻ってくる URL（?verify=done / ?verify=emailchanged、失敗時は &error=...）を読む。
// サーバー側（src/auth.ts）が付ける callbackURL と対応している。
function readVerifyRedirect(): { mode: AuthMode; error: string | null; token: string | null } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  // パスワード再設定メールのリンク（?reset=1&token=... / 失敗時は &error=INVALID_TOKEN）
  if (params.get('reset')) {
    const token = params.get('token')
    if (error || !token) return { mode: 'resetError', error: error ?? 'INVALID_TOKEN', token: null }
    return { mode: 'resetPassword', error: null, token }
  }
  const kind = params.get('verify')
  if (!kind) return null
  if (error) return { mode: 'verifyError', error, token: null }
  if (kind === 'done') return { mode: 'signupVerified', error: null, token: null }
  if (kind === 'emailchanged') return { mode: 'emailChanged', error: null, token: null }
  return null
}

function isJsonResponse(res: Response) {
  return res.headers.get('content-type')?.includes('application/json') ?? false
}

// 日づけだけ（例: 2026/9/21）
function formatDateOnly(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateDisplay(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  let h = d.getHours()
  const ampm = h < 12 ? 'AM' : 'PM'
  h = h % 12
  if (h === 0) h = 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}/${m}/${day} ${ampm} ${h}:${mm}`
}

function normalizePaletteSwatches(value: unknown): PaletteSwatch[] {
  const fallback = DEFAULT_SWATCHES.map((swatch) => ({ ...swatch }))
  if (!Array.isArray(value)) return fallback

  const incoming = value
    .filter((swatch): swatch is PaletteSwatch => {
      if (!swatch || typeof swatch !== 'object') return false
      const item = swatch as { name?: unknown; hex?: unknown }
      return typeof item.name === 'string' && typeof item.hex === 'string' && /^#[0-9a-f]{6}$/i.test(item.hex)
    })
    .slice(0, DEFAULT_SWATCHES.length)
    .map((swatch, index) => ({
      name: swatch.name.trim().slice(0, 24) || fallback[index].name,
      hex: swatch.hex.toLowerCase(),
    }))

  return [...incoming, ...fallback.slice(incoming.length)].slice(0, DEFAULT_SWATCHES.length)
}

// 正解色（と、すでに入っているダミー色）が QUIZ_PALETTE_SIZE 色に満たないとき、ダミー色を足して基本の色数にする。
// すでにそれ以上ある旗（正解色が多い旗）はそのまま。国旗・国際信号旗・手書き・学習用のすべてのクイズで共通。
function fillQuizSwatchesWithDummies(swatches: PaletteSwatch[], seedText: string, size = QUIZ_PALETTE_SIZE): PaletteSwatch[] {
  if (swatches.length >= size) return swatches
  const result = swatches.map((swatch) => ({ ...swatch }))
  const candidates = shuffleQuizSwatches(QUIZ_DUMMY_SWATCHES, seedText)
  const addFrom = (isBlocked: (candidate: PaletteSwatch) => boolean) => {
    for (const candidate of candidates) {
      if (result.length >= size) return
      if (result.some((swatch) => swatch.hex.toLowerCase() === candidate.hex.toLowerCase())) continue
      if (isBlocked(candidate)) continue
      result.push({ ...candidate })
    }
  }
  // 1回目: 正解色にも、ほかのダミー色にも紛らわしくない色だけ足す
  addFrom((candidate) => isConfusingQuizDummy(candidate.hex, result.map((swatch) => swatch.hex)))
  // 2回目（まだ足りないとき）: 色が近すぎるものだけ除く
  addFrom((candidate) => result.some((swatch) => colorDistance(hexToRgb(candidate.hex), hexToRgb(swatch.hex)) < 64))
  return result
}

// チャレンジの出題を選ぶ。マイギャラリーに保存しているぬりえを優先し、
// 保存数が出題数より多ければ保存しているものだけから、足りなければ残りをほかのぬりえからランダムに選ぶ。
// 選んだあとは並びをシャッフルする（保存済みだけが前にかたまらないように）。
function pickChallengeIds(pool: string[], count: number, savedIds: Set<string>): string[] {
  const saved = shuffleArray(pool.filter((id) => savedIds.has(id)))
  const others = shuffleArray(pool.filter((id) => !savedIds.has(id)))
  return shuffleArray([...saved, ...others].slice(0, count))
}

type ChallengePools = { easy: string[]; normal: string[]; hardFine: string[]; hardRest: string[] }

function difficultyInfoOf(id: string) {
  return FLAG_DIFFICULTY_DATA[id] as (typeof FLAG_DIFFICULTY_DATA)[string] | undefined
}

// カテゴリーの問題を、難易度ごとの出題プールに分ける（判定のルールは CHALLENGE_HARD_FINE_RATIO のコメント参照）。
// hardFine＝むずかしいで一定の割合だけ混ぜる細かい旗（S）、hardRest＝それ以外でデータのある旗
function buildChallengePools(poolIds: string[]): ChallengePools {
  return {
    easy: poolIds.filter((id) => {
      const info = difficultyInfoOf(id)
      return Boolean(info) && info!.colors <= 3 && info!.fine === null
    }),
    normal: poolIds.filter((id) => difficultyInfoOf(id)?.fine !== 'S'),
    hardFine: poolIds.filter((id) => difficultyInfoOf(id)?.fine === 'S'),
    hardRest: poolIds.filter((id) => {
      const info = difficultyInfoOf(id)
      return Boolean(info) && info!.fine !== 'S'
    }),
  }
}

// 難易度を反映して出題を選ぶ。まず難易度で絞り、そのなかでマイギャラリーに保存しているぬりえを優先する（pickChallengeIds）。
function pickChallengeQuestions(poolIds: string[], difficulty: ChallengeDifficulty, count: number, savedIds: Set<string>): string[] {
  const pools = buildChallengePools(poolIds)
  if (difficulty === 'easy') return pickChallengeIds(pools.easy, count, savedIds)
  if (difficulty === 'normal') return pickChallengeIds(pools.normal, count, savedIds)
  const total = pools.hardFine.length + pools.hardRest.length
  const n = Math.min(count, total)
  let fineCount = Math.min(pools.hardFine.length, Math.round(n * CHALLENGE_HARD_FINE_RATIO))
  let restCount = n - fineCount
  if (restCount > pools.hardRest.length) {
    // 細かくない旗が足りないときは、細かい旗で補う
    fineCount += restCount - pools.hardRest.length
    restCount = pools.hardRest.length
  }
  const fine = pickChallengeIds(pools.hardFine, fineCount, savedIds)
  // 細かくない旗は、色の多い旗（5色以上）から順に、足りるまで色の少ない段へ補っていく
  const byColors = new Map<number, string[]>()
  for (const id of pools.hardRest) {
    const key = Math.min(difficultyInfoOf(id)?.colors ?? 0, 5)
    byColors.set(key, [...(byColors.get(key) ?? []), id])
  }
  const rest: string[] = []
  for (const key of [...byColors.keys()].sort((a, b) => b - a)) {
    if (rest.length >= restCount) break
    rest.push(...pickChallengeIds(byColors.get(key) ?? [], restCount - rest.length, savedIds))
  }
  return shuffleArray([...fine, ...rest])
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function shuffleQuizSwatches(swatches: PaletteSwatch[], seedText: string) {
  const shuffled = swatches.map((swatch) => ({ ...swatch }))
  let seed = 0
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0
  }

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const swapIndex = seed % (index + 1)
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled
}

async function extractQuizSwatchesFromImage(referenceImage: string): Promise<PaletteSwatch[]> {
  try {
    const image = await loadImage(referenceImage)
    const canvas = document.createElement('canvas')
    const maxSize = 180
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return LEARNING_QUIZ_FALLBACK_SWATCHES
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const bins = new Map<string, { r: number; g: number; b: number; count: number }>()
    const totalPixels = canvas.width * canvas.height

    for (let index = 0; index < imageData.data.length; index += 16) {
      const alpha = imageData.data[index + 3]
      if (alpha < 180) continue
      const color = {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
      }
      if (isNearWhite(color)) continue
      const nearBlack = isNearBlack(color)
      const bucket = nearBlack
        ? 'black'
        : [
            Math.round(color.r / 28) * 28,
            Math.round(color.g / 28) * 28,
            Math.round(color.b / 28) * 28,
          ].join(',')
      const current = bins.get(bucket) ?? { r: 0, g: 0, b: 0, count: 0 }
      current.r += color.r
      current.g += color.g
      current.b += color.b
      current.count += 1
      bins.set(bucket, current)
    }

    const dominant = [...bins.entries()]
      .map(([key, bin]) => ({
        key,
        count: bin.count,
        color: {
          r: Math.round(bin.r / bin.count),
          g: Math.round(bin.g / bin.count),
          b: Math.round(bin.b / bin.count),
        },
      }))
      .filter((bin) => bin.key !== 'black' || bin.count > totalPixels * 0.01)
      .sort((left, right) => right.count - left.count)

    const swatches: PaletteSwatch[] = [{ name: '白', hex: '#ffffff' }]
    for (const bin of dominant) {
      if (swatches.length >= 8) break
      if (swatches.some((swatch) => colorDistance(hexToRgb(swatch.hex), bin.color) < 42)) continue
      swatches.push({ name: `見本色${swatches.length}`, hex: rgbToHex(bin.color) })
    }

    const filled = fillQuizSwatchesWithDummies(swatches, `${referenceImage}:dummy-swatches`)
    return filled.length >= 4 ? filled : LEARNING_QUIZ_FALLBACK_SWATCHES
  } catch {
    return LEARNING_QUIZ_FALLBACK_SWATCHES
  }
}

function recordPercent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

// カテゴリーごとに、ぬりえのタイトルと「ぬった（マイギャラリーに保存ずみ）」「クイズせいかい」の一覧を作る
function buildRecordCategories(
  categories: IllustrationCategory[],
  include: (illustrationId: string) => boolean,
  illustrationById: Map<string, IllustrationDef>,
  savedIds: Set<string>,
  learnedIds: Set<string>,
  learnedAtById: Map<string, string>,
): RecordCategory[] {
  return categories
    .map((category) => {
      const rows = category.illustrationIds
        .filter(include)
        .map((id) => illustrationById.get(id))
        .filter((it): it is IllustrationDef => Boolean(it))
        .map((it) => ({ id: it.id, title: it.title, saved: savedIds.has(it.id), learned: learnedIds.has(it.id), learnedAt: learnedAtById.get(it.id) ?? null }))
      return {
        id: category.id,
        title: categoryDisplayTitle(category),
        rows,
        savedCount: rows.filter((row) => row.saved).length,
        learnedCount: rows.filter((row) => row.learned).length,
      }
    })
    .filter((category) => category.rows.length > 0)
}

// 小カテゴリーごとの記録を、大カテゴリー単位にまとめる（ぬりえがある小カテゴリーだけが children になる）
function buildRecordGroups(categories: RecordCategory[]): RecordGroup[] {
  return CATEGORY_GROUPS.map((group) => {
    const children = group.categoryIds
      .map((id) => categories.find((category) => category.id === id))
      .filter((category): category is RecordCategory => Boolean(category))
    return {
      id: group.id,
      title: group.title,
      rows: children.flatMap((child) => child.rows),
      savedCount: children.reduce((sum, child) => sum + child.savedCount, 0),
      learnedCount: children.reduce((sum, child) => sum + child.learnedCount, 0),
      children,
    }
  }).filter((group) => group.children.length > 0)
}

const ACHIEVEMENT_MILESTONE_THRESHOLDS = [5, 10, 30, 50, 100, 200]

// バッジ（達成記録）を作る。DB・APIの変更はなく、既存の「ぬりえの記録」用データからその場で毎回計算する。
// 「あと1枚でバッジ」のような進捗を煽る見せ方はせず、獲得ずみかどうかだけを見せる方針（ユーザーの指示）。
function buildAchievements(
  recordPlayGroups: RecordGroup[],
  recordLearnCategories: RecordCategory[],
  savedIllustrationIds: Set<string>,
  hasSavedColoring: boolean,
  hasLearnedQuiz: boolean,
  hasUpload: boolean,
): Achievement[] {
  const achievements: Achievement[] = []

  // とくべつ（一回性の行動）
  achievements.push({ id: 'special-first-coloring', title: 'はじめての1まい', tier: 'special', earned: hasSavedColoring })
  achievements.push({ id: 'special-first-quiz', title: 'はじめてクイズにせいかい', tier: 'special', earned: hasLearnedQuiz })
  achievements.push({ id: 'special-first-upload', title: 'はじめてのじぶんのぬりえ', tier: 'special', earned: hasUpload })

  // 累計枚数（あそぶ全体で「ぬった」枚数の節目。存在する枚数を超える節目は出さない）
  const playTotal = recordPlayGroups.reduce((sum, group) => sum + group.rows.length, 0)
  const savedTotal = savedIllustrationIds.size
  for (const threshold of ACHIEVEMENT_MILESTONE_THRESHOLDS) {
    if (threshold > playTotal) continue
    achievements.push({ id: `milestone-${threshold}`, title: `${threshold}まい ぬった`, tier: 'milestone', earned: savedTotal >= threshold, count: savedTotal, total: threshold })
  }
  if (playTotal > 0) {
    achievements.push({ id: 'milestone-all', title: 'ぜんぶぬった', tier: 'milestone', earned: savedTotal >= playTotal, count: savedTotal, total: playTotal })
  }

  // カテゴリーマスター（あそぶの小カテゴリーを全部ぬった）
  for (const group of recordPlayGroups) {
    for (const category of group.children) {
      if (category.rows.length === 0) continue
      achievements.push({
        id: `category-${category.id}`,
        title: `${category.title}マスター`,
        tier: 'category',
        earned: category.savedCount === category.rows.length,
        count: category.savedCount,
        total: category.rows.length,
      })
    }
  }

  // クイズはかせ（まなぶの小カテゴリーで全問正解）
  for (const category of recordLearnCategories) {
    if (category.rows.length === 0) continue
    achievements.push({
      id: `quiz-${category.id}`,
      title: `${category.title}はかせ`,
      tier: 'quiz',
      earned: category.learnedCount === category.rows.length,
      count: category.learnedCount,
      total: category.rows.length,
    })
  }

  return achievements
}

// チップに出す、小カテゴリーの短い名前（「アジアのもよう」ではなく、大カテゴリーの中で通じる「アジア」）
function categoryShortTitle(categoryId: string, fallback: string) {
  return ILLUSTRATION_CATEGORIES.find((category) => category.id === categoryId)?.title ?? fallback
}

function mergeLibraryLineartsIntoCategories(categories: IllustrationCategory[], linearts: LibraryLineArt[]) {
  return categories.map((category) => {
    const additions = linearts
      .filter((lineart) => lineart.categoryId === category.id)
      .map((lineart) => `library-${lineart.id}`)

    return additions.length
      ? { ...category, illustrationIds: [...category.illustrationIds, ...additions] }
      : category
  })
}

function buildLearnCategories(categories: IllustrationCategory[], linearts: LibraryLineArt[]) {
  return categories
    .map((category) => {
      const baseIds = QUIZ_CATEGORY_IDS.has(category.id) ? category.illustrationIds : []
      const additions = linearts
        .filter((lineart) => lineart.categoryId === category.id && lineart.isLearning && lineart.referenceImageUrl)
        .map((lineart) => `library-${lineart.id}`)

      return { ...category, illustrationIds: [...baseIds, ...additions] }
    })
    .filter((category) => category.illustrationIds.length > 0)
}

function getProfileMotifImage(motifId: string) {
  return PROFILE_MOTIFS.find((motif) => motif.id === motifId)?.imageUrl ?? `/profile-motifs/${motifId}.png`
}

// 大カテゴリーの「すべて」を表すID（CATEGORY_GROUPS の id は group- で始まる）
function isGroupCategoryId(id: string) {
  return id.startsWith('group-')
}

// 大カテゴリーのカードに出す絵。小カテゴリーの先頭から1枚ずつ、そのあとに残りを順に並べる
function pickPreviewIds(categories: IllustrationCategory[]): string[] {
  const firsts = categories.map((category) => category.illustrationIds[0]).filter((id): id is string => Boolean(id))
  const rest = categories.flatMap((category) => category.illustrationIds.slice(1))
  return [...firsts, ...rest].slice(0, 4)
}

type CatalogItem =
  | { type: 'group'; id: string; title: string }
  | { type: 'category'; category: IllustrationCategory; index: number }

// ぬりえを追加するときのカテゴリー選択肢。大カテゴリーごとに <optgroup> でまとめる（空の「枠」にも追加できる）
function CategoryOptions() {
  return (
    <>
      {CATEGORY_GROUPS.map((group) => (
        <optgroup label={group.title} key={group.id}>
          {group.categoryIds
            .map((id) => ILLUSTRATION_CATEGORIES.find((category) => category.id === id))
            .filter((category): category is IllustrationCategory => Boolean(category))
            .map((category) => (
              <option value={category.id} key={category.id}>{category.title}</option>
            ))}
        </optgroup>
      ))}
    </>
  )
}

// パスワード入力欄。右端の目のアイコンで、入力中のパスワードを表示／非表示にできる。
function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'パスワードを隠す' : 'パスワードを表示する'
  return (
    <span className="passwordInput">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        className="passwordToggle"
        type="button"
        // 押してもキーボードが閉じないよう、入力欄からフォーカスを外さない
        onMouseDown={(ev) => ev.preventDefault()}
        onClick={() => setVisible((value) => !value)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible ? <path d="M4 4l16 16" /> : null}
        </svg>
      </button>
    </span>
  )
}

function ProfileIcon(props: { profile: Pick<UserProfile, 'motifId' | 'iconColor' | 'imageUrl'>; size?: 'small' | 'normal' }) {
  return (
    <span
      className={`profileIcon ${props.size === 'small' ? 'smallProfileIcon' : ''}`}
      style={{ ['--profile-color' as never]: props.profile.iconColor }}
      aria-hidden="true"
    >
      <img src={props.profile.imageUrl || getProfileMotifImage(props.profile.motifId)} alt="" />
    </span>
  )
}

function getLoopCardAccent(index: number) {
  const colors = ['#ef6950', '#29a2de', '#feb61c', '#1cb5a5', '#feb61c', '#ef6950', '#1cb5a5', '#29a2de']
  return colors[index % colors.length]
}

function buildReportMailto(preview: ImagePreview & { reportKind: '作品' | 'ぬりえ'; reportId: string }) {
  const subject = encodeURIComponent(`ぬりえペイント ${preview.reportKind}の報告: ${preview.title}`)
  const body = encodeURIComponent([
    '以下の内容を報告します。',
    '',
    `種類: ${preview.reportKind}`,
    `タイトル: ${preview.title}`,
    `ID: ${preview.reportId}`,
    `画像URL: ${preview.imageUrl}`,
    '',
    '報告理由:',
  ].join('\n'))
  return `mailto:tzlt.73.san@gmail.com?subject=${subject}&body=${body}`
}

function hasReportInfo(preview: ImagePreview): preview is ImagePreview & { reportKind: '作品' | 'ぬりえ'; reportId: string } {
  return Boolean(preview.reportKind && preview.reportId)
}

async function evaluateRasterQuiz(
  referenceImage: string,
  title: string,
  passingScore: number,
  crop?: { x: number; y: number; width: number; height: number },
): Promise<QuizResult | null> {
  const currentCanvas = document.querySelector<HTMLCanvasElement>('.stage .rasterCanvas')
  if (!currentCanvas || currentCanvas.width === 0 || currentCanvas.height === 0) return null

  const reference = await loadImage(referenceImage)
  const referenceCanvas = document.createElement('canvas')
  referenceCanvas.width = currentCanvas.width
  referenceCanvas.height = currentCanvas.height
  const referenceCtx = referenceCanvas.getContext('2d', { willReadFrequently: true })
  const currentCtx = currentCanvas.getContext('2d', { willReadFrequently: true })
  if (!referenceCtx || !currentCtx) return null

  if (crop) {
    referenceCtx.drawImage(reference, crop.x, crop.y, crop.width, crop.height, 0, 0, referenceCanvas.width, referenceCanvas.height)
  } else {
    referenceCtx.drawImage(reference, 0, 0, referenceCanvas.width, referenceCanvas.height)
  }
  const expected = referenceCtx.getImageData(0, 0, referenceCanvas.width, referenceCanvas.height)
  const actual = currentCtx.getImageData(0, 0, currentCanvas.width, currentCanvas.height)
  const bounds = findContentBounds(expected)
  if (!bounds) return null

  let total = 0
  let matched = 0
  let missing = 0

  for (let y = bounds.top; y <= bounds.bottom; y += 2) {
    for (let x = bounds.left; x <= bounds.right; x += 2) {
      const index = (y * expected.width + x) * 4
      const expectedColor = {
        r: expected.data[index],
        g: expected.data[index + 1],
        b: expected.data[index + 2],
      }

      const actualColor = {
        r: actual.data[index],
        g: actual.data[index + 1],
        b: actual.data[index + 2],
      }
      if (isLikelyLinePixel(expected, x, y) || (isLikelyLinePixel(actual, x, y) && !isNearBlack(expectedColor))) continue

      total += 1
      if (colorDistance(expectedColor, actualColor) <= 78) {
        matched += 1
      } else if (!isNearWhite(expectedColor) && isNearWhite(actualColor)) {
        missing += 1
      }
    }
  }

  const score = total ? Math.round((matched / total) * 100) : 0
  return {
    title,
    score,
    total,
    matched,
    missing,
    passed: score >= passingScore && missing < total * 0.08,
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

async function lineartFileHasColor(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    const maxSize = 420
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let coloredPixels = 0
    let visiblePixels = 0

    for (let index = 0; index < imageData.data.length; index += 4) {
      const alpha = imageData.data[index + 3]
      if (alpha < 32) continue
      const color = {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
      }
      const brightness = (color.r + color.g + color.b) / 3
      if (brightness > 246) continue
      visiblePixels += 1
      if (isLikelyLineartColor(color)) coloredPixels += 1
    }

    return coloredPixels > Math.max(80, visiblePixels * 0.012)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function isLikelyLineartColor(color: { r: number; g: number; b: number }) {
  const max = Math.max(color.r, color.g, color.b)
  const min = Math.min(color.r, color.g, color.b)
  const saturation = max - min
  const brightness = (color.r + color.g + color.b) / 3
  if (brightness < 42 || brightness > 248) return false
  if (saturation < 48) return false
  return colorDistance(color, { r: brightness, g: brightness, b: brightness }) > 40
}

function findContentBounds(imageData: ImageData) {
  let left = imageData.width
  let right = -1
  let top = imageData.height
  let bottom = -1

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const index = (y * imageData.width + x) * 4
      const color = {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
      }
      if (isNearWhite(color)) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < 0 || bottom < 0) return null
  return { left, right, top, bottom }
}

function colorDistance(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b)
}

function isConfusingQuizDummy(candidateHex: string, answerHexes: string[]) {
  const candidate = hexToRgb(candidateHex)
  const candidateHsl = rgbToSimpleHsl(candidate)
  return answerHexes.some((answerHex) => {
    const answer = hexToRgb(answerHex)
    if (colorDistance(candidate, answer) < 96) return true
    const answerHsl = rgbToSimpleHsl(answer)
    const hueDiff = Math.min(Math.abs(candidateHsl.h - answerHsl.h), 360 - Math.abs(candidateHsl.h - answerHsl.h))
    const lightnessDiff = Math.abs(candidateHsl.l - answerHsl.l)
    const saturationDiff = Math.abs(candidateHsl.s - answerHsl.s)
    return hueDiff < 24 && lightnessDiff < 18 && saturationDiff < 28
  })
}

function rgbToSimpleHsl(color: { r: number; g: number; b: number }) {
  const r = color.r / 255
  const g = color.g / 255
  const b = color.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l: lightness * 100 }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === r) hue = ((g - b) / delta) % 6
  if (max === g) hue = (b - r) / delta + 2
  if (max === b) hue = (r - g) / delta + 4
  hue = Math.round(hue * 60)
  if (hue < 0) hue += 360
  return { h: hue, s: saturation * 100, l: lightness * 100 }
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized.padEnd(6, '0').slice(0, 6), 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(color: { r: number; g: number; b: number }) {
  return `#${[color.r, color.g, color.b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`
}

function isNearWhite(color: { r: number; g: number; b: number }) {
  return color.r > 240 && color.g > 240 && color.b > 236
}

function isNearBlack(color: { r: number; g: number; b: number }) {
  return color.r < 35 && color.g < 35 && color.b < 35
}

function isLikelyLinePixel(imageData: ImageData, x: number, y: number) {
  const centerIndex = (y * imageData.width + x) * 4
  const center = {
    r: imageData.data[centerIndex],
    g: imageData.data[centerIndex + 1],
    b: imageData.data[centerIndex + 2],
  }
  if (!isNearBlack(center)) return false

  let nonBlackNeighbors = 0
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= imageData.width || ny >= imageData.height) continue
      const index = (ny * imageData.width + nx) * 4
      if (!isNearBlack({ r: imageData.data[index], g: imageData.data[index + 1], b: imageData.data[index + 2] })) {
        nonBlackNeighbors += 1
      }
    }
  }
  return nonBlackNeighbors >= 8
}

function UndoIcon() {
  return <img className="buttonIcon imageButtonIcon" src="/icons/back.png" alt="" aria-hidden="true" />
}

function RedoIcon() {
  return <img className="buttonIcon imageButtonIcon redoIcon" src="/icons/back.png" alt="" aria-hidden="true" />
}

function EyedropperIcon() {
  return <img className="buttonIcon imageButtonIcon" src="/icons/spoit.png" alt="" aria-hidden="true" />
}

function BrushIcon() {
  return (
    <svg className="buttonIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.2 12.1 17.4 3.9a2.6 2.6 0 0 1 3.7 3.7l-8.2 8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 13.5c-2 0-3.6 1.6-3.6 3.6 0 1.2-.4 1.7-1 2.1-.2.1-.2.4 0 .5 1 .6 2.6 1.3 4 1.3 2.5 0 4.6-2 4.6-4.5A2.9 2.9 0 0 0 7 13.5Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="buttonIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 7l.8 12.2c0 .9.8 1.6 1.7 1.6h6.9c.9 0 1.7-.7 1.7-1.6L18 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg className="buttonIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.9 3.2h2.2l.5 2.3c.6.2 1.1.4 1.6.7l2-1.2 1.6 1.6-1.2 2c.3.5.5 1 .7 1.6l2.3.5v2.2l-2.3.5c-.2.6-.4 1.1-.7 1.6l1.2 2-1.6 1.6-2-1.2c-.5.3-1 .5-1.6.7l-.5 2.3h-2.2l-.5-2.3c-.6-.2-1.1-.4-1.6-.7l-2 1.2-1.6-1.6 1.2-2c-.3-.5-.5-1-.7-1.6l-2.3-.5v-2.2l2.3-.5c.2-.6.4-1.1.7-1.6l-1.2-2L6.8 5l2 1.2c.5-.3 1-.5 1.6-.7l.5-2.3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function EditPencilIcon() {
  return <span className="editPencilIcon" aria-hidden="true" />
}

export default App
