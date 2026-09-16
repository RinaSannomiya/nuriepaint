import './App.css'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DEFAULT_SWATCHES, Palette } from './components/Palette'
import { IllustrationThumb } from './components/IllustrationThumb'
import { Sidebar } from './components/Sidebar'
import { Stage } from './components/Stage'
import { ILLUSTRATIONS, ILLUSTRATION_CATEGORIES, type IllustrationCategory, type IllustrationDef } from './illustrations/illustrations'
import { RasterLineArt, type RasterPaintCommand } from './illustrations/svgs/RasterLineArt'

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
  showPlayCatalog: boolean
  showQuizCatalog: boolean
  showCreatePage: boolean
  showSpreadPage: boolean
  showGalleryPage: boolean
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
type QuizCategoryProgress = {
  category: IllustrationCategory
  rate: number
  learned: IllustrationDef[]
  attemptedCount: number
  totalCount: number
}

const QUIZ_CATEGORY_IDS = new Set(['flags'])
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
const QUIZ_DUMMY_SWATCHES: PaletteSwatch[] = [
  { name: 'オレンジ', hex: '#ff9500' },
  { name: '水色', hex: '#5bc8f2' },
  { name: '紫', hex: '#af52de' },
  { name: 'ピンク', hex: '#ff7ab8' },
  { name: '茶色', hex: '#9b6330' },
]

function App() {
  const homeScrollRef = useRef<HTMLElement | null>(null)
  const savedPageReturnRef = useRef<ViewSnapshot | null>(null)
  const authIconEditorRef = useRef<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showPlayCatalog, setShowPlayCatalog] = useState(false)
  const [showQuizCatalog, setShowQuizCatalog] = useState(false)
  const [categoryReturnPage, setCategoryReturnPage] = useState<'play' | 'learn' | 'home'>('home')
  const [showCreatePage, setShowCreatePage] = useState(false)
  const [showSpreadPage, setShowSpreadPage] = useState(false)
  const [showGalleryPage, setShowGalleryPage] = useState(false)
  const [showSavedPage, setShowSavedPage] = useState(false)
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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'signupProfile' | 'signupComplete' | 'profile'>('signin')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(true)
  const [authName, setAuthName] = useState('')
  const [authProfile, setAuthProfile] = useState<UserProfile | null>(null)
  const [accountProfileEditing, setAccountProfileEditing] = useState(false)
  const [accountEmailEditing, setAccountEmailEditing] = useState(false)
  const [accountEmailValue, setAccountEmailValue] = useState('')
  const [accountEmailMessage, setAccountEmailMessage] = useState('')
  const [accountPasswordOpen, setAccountPasswordOpen] = useState(false)
  const [accountPasswordCurrent, setAccountPasswordCurrent] = useState('')
  const [accountPasswordNew, setAccountPasswordNew] = useState('')
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('')
  const [accountPasswordMessage, setAccountPasswordMessage] = useState('')
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
  const [uploadAgreeCopyright, setUploadAgreeCopyright] = useState(false)
  const [uploadAgreePrivacy, setUploadAgreePrivacy] = useState(false)
  const [uploadAgreeDecency, setUploadAgreeDecency] = useState(false)
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

  const allIllustrations = useMemo(() => [...ILLUSTRATIONS, ...libraryIllustrations], [libraryIllustrations])
  const libraryByIllustrationId = useMemo(() => {
    return new Map(libraryLinearts.map((lineart) => [`library-${lineart.id}`, lineart]))
  }, [libraryLinearts])
  const playCategories = useMemo(() => {
    return mergeLibraryLineartsIntoCategories(ILLUSTRATION_CATEGORIES, libraryLinearts)
  }, [libraryLinearts])
  const learnCategories = useMemo(() => {
    return buildLearnCategories(ILLUSTRATION_CATEGORIES, libraryLinearts)
  }, [libraryLinearts])
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
    return { ...QUIZ_CONFIGS, ...fallbackQuizConfigs, ...dynamicQuizConfigs }
  }, [dynamicQuizConfigs, fallbackQuizConfigs])

  const selectedDef = useMemo(() => {
    if (!selected) return null
    return allIllustrations.find((it) => it.id === selected) ?? null
  }, [allIllustrations, selected])

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null
    const categories = categoryReturnPage === 'learn' ? learnCategories : playCategories
    return categories.find((category) => category.id === selectedCategoryId) ?? null
  }, [categoryReturnPage, learnCategories, playCategories, selectedCategoryId])

  const categoryIllustrations = useMemo(() => {
    if (!selectedCategory) return []
    return selectedCategory.illustrationIds
      .map((id) => allIllustrations.find((it) => it.id === id))
      .filter((it): it is IllustrationDef => Boolean(it))
  }, [allIllustrations, selectedCategory])
  const selectedCategoryHasQuiz = useMemo(() => {
    return Boolean(selectedCategory?.illustrationIds.some((id) => quizConfigs[id]))
  }, [quizConfigs, selectedCategory])
  const displayedCategoryIllustrations = useMemo(() => {
    if (!quizSelectionArmed) return categoryIllustrations
    return categoryIllustrations.filter((it) => Boolean(quizConfigs[it.id]) || Boolean(it.referenceImage))
  }, [categoryIllustrations, quizConfigs, quizSelectionArmed])

  const quizCategories = useMemo(() => learnCategories, [learnCategories])
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
  const selectedQuizSwatches = useMemo(() => {
    if (!selected || !selectedQuiz) return null
    return shuffleQuizSwatches(selectedQuiz.swatches, `${selected}:quiz-palette`)
  }, [selected, selectedQuiz])
  const activeSwatches = quizMode && selectedQuizSwatches ? selectedQuizSwatches : customSwatches
  const learnedQuizIds = useMemo(() => new Set(quizAttempts.filter((attempt) => attempt.passed).map((attempt) => attempt.illustrationId)), [quizAttempts])
  const quizCategoryProgress = useMemo<QuizCategoryProgress[]>(() => {
    const attemptsByCategory = new Map<string, QuizAttempt[]>()
    for (const attempt of quizAttempts) {
      attemptsByCategory.set(attempt.categoryId, [...(attemptsByCategory.get(attempt.categoryId) ?? []), attempt])
    }

    return learnCategories
      .map((category) => {
        const quizIds = category.illustrationIds.filter((id) => quizConfigs[id])
        const attempts = attemptsByCategory.get(category.id) ?? []
        const attemptedIds = new Set(attempts.map((attempt) => attempt.illustrationId))
        const learned = quizIds
          .filter((id) => learnedQuizIds.has(id))
          .map((id) => allIllustrations.find((it) => it.id === id))
          .filter((it): it is IllustrationDef => Boolean(it))
        return {
          category,
          rate: quizIds.length ? Math.round((learned.length / quizIds.length) * 100) : 0,
          learned,
          attemptedCount: attemptedIds.size,
          totalCount: quizIds.length,
        }
      })
      .filter((progress) => progress.attemptedCount > 0)
  }, [allIllustrations, learnCategories, learnedQuizIds, quizAttempts, quizConfigs])
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
        title: category.title,
        items: uploadedLinearts.filter((item) => item.categoryId === category.id),
      }))
      .filter((section) => section.items.length > 0)
  }, [uploadedLinearts])

  const publicLineartSections = useMemo(() => {
    return ILLUSTRATION_CATEGORIES
      .map((category) => ({
        id: category.id,
        title: category.title,
        items: publicLinearts.filter((item) => item.categoryId === category.id),
      }))
      .filter((section) => section.items.length > 0)
  }, [publicLinearts])

  const savedGallerySections = useMemo(() => {
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

    if (galleryGroupMode === 'all') {
      return [
        {
          id: 'all',
          title: 'すべて',
          items: [...savedColorings].sort(itemSorter),
        },
      ]
    }

    const categorySections = ILLUSTRATION_CATEGORIES.map((category) => {
      const items = savedColorings
        .filter((item) => category.illustrationIds.includes(item.illustrationId))
        .sort(itemSorter)
      return { id: category.id, title: category.title, items }
    })
      .filter((section) => section.items.length > 0)
      .sort((left, right) => (categoryOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (categoryOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER))

    const unknownItems = savedColorings
      .filter((item) => !ILLUSTRATION_CATEGORIES.some((category) => category.illustrationIds.includes(item.illustrationId)))
      .sort(itemSorter)

    return unknownItems.length ? [...categorySections, { id: 'unknown', title: 'その他', items: unknownItems }] : categorySections
  }, [galleryGroupMode, gallerySortBasis, gallerySortDirection, savedColorings])

  const activeGallerySection = useMemo(() => {
    if (galleryGroupMode !== 'category') return savedGallerySections[0] ?? null
    return savedGallerySections.find((section) => section.id === activeGalleryCategoryId) ?? savedGallerySections[0] ?? null
  }, [activeGalleryCategoryId, galleryGroupMode, savedGallerySections])

  const refreshMe = useCallback(async () => {
    const res = await fetch('/api/me', { credentials: 'include' })
    if (!res.ok) return
    if (!isJsonResponse(res)) return
    const data = (await res.json()) as { user: AuthUser | null; profile?: UserProfile | null }
    setAuthUser(data.user)
    setAuthName(data.user?.name ?? '')
    setAuthProfile(data.profile ?? null)
    if (data.profile) {
      setAuthMotifId(data.profile.motifId)
      setAuthIconColor(data.profile.iconColor)
    }
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

  useEffect(() => {
    if (!authUser) return
    if (showCreatePage) void loadLinearts()
    if (showPlayCatalog || showQuizCatalog || showSpreadPage || showSavedPage || galleryOpen) void loadLibraryLinearts()
    if (showSpreadPage) void loadLinearts()
    if (showSavedPage) void loadGallery({ openModal: false })
  }, [authUser, galleryOpen, showCreatePage, showPlayCatalog, showQuizCatalog, showSavedPage, showSpreadPage])

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
  }, [selected, selectedCategoryId, showPlayCatalog, showQuizCatalog, showCreatePage, showSpreadPage, showGalleryPage, showSavedPage])

  function chooseIllustration(id: string) {
    const category = playCategories.find((it) => it.illustrationIds.includes(id))
    if (category) setSelectedCategoryId(category.id)
    const nextQuizConfig = quizConfigs[id]
    const nextQuiz = Boolean(quizSelectionArmed && nextQuizConfig)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setRestoreImage(null)
    setArtZoom(1)
    setEyedropper(false)
    setBrush(false)
    setSelected(id)
    setQuizResult(null)
    setQuizMode(nextQuiz)
    if (nextQuiz && nextQuizConfig) {
      setColor(shuffleQuizSwatches(nextQuizConfig.swatches, `${id}:quiz-palette`)[0]?.hex ?? nextQuizConfig.swatches[0].hex)
      resetIllustration(id)
    }
  }

  function goHome() {
    setSelected(null)
    setSelectedCategoryId(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setQuizSelectionArmed(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  function chooseCategory(id: string) {
    setCategoryReturnPage(showQuizCatalog ? 'learn' : showPlayCatalog ? 'play' : 'home')
    setSelected(null)
    setSelectedCategoryId(id)
    setQuizSelectionArmed(showQuizCatalog && Boolean(learnCategories.find((category) => category.id === id)))
    setShowPlayCatalog(false)
    setShowQuizCatalog(false)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setQuizMode(false)
    setQuizResult(null)
  }

  function backToCategorySelection() {
    setSelected(null)
    setSelectedCategoryId(null)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
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
    setShowPlayCatalog(snapshot.showPlayCatalog)
    setShowQuizCatalog(snapshot.showQuizCatalog)
    setShowCreatePage(snapshot.showCreatePage)
    setShowSpreadPage(snapshot.showSpreadPage)
    setShowGalleryPage(snapshot.showGalleryPage)
    setShowSavedPage(false)
    setQuizSelectionArmed(snapshot.quizSelectionArmed)
    setQuizMode(snapshot.quizMode)
    setQuizResult(null)
  }

  function captureCurrentView(): ViewSnapshot {
    return {
      selected,
      selectedCategoryId,
      showPlayCatalog,
      showQuizCatalog,
      showCreatePage,
      showSpreadPage,
      showGalleryPage,
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
    setStatus('答え合わせ中...')
    const result = await evaluateRasterQuiz(selectedDef.referenceImage, selectedDef.title, selectedQuiz.passingScore, selectedDef.rasterCrop).catch(() => null)
    if (!result) {
      setStatus('答え合わせできませんでした。')
      return
    }
    setQuizResult(result)
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

  function goToNextQuizChallenge() {
    if (selected) {
      const categoryId = learnCategories.find((category) => category.illustrationIds.includes(selected))?.id ?? selectedCategoryId
      if (categoryId) setSelectedCategoryId(categoryId)
    }
    setSelected(null)
    setShowPlayCatalog(false)
    setShowQuizCatalog(true)
    setShowCreatePage(false)
    setShowSpreadPage(false)
    setShowGalleryPage(false)
    setShowSavedPage(false)
    setQuizMode(false)
    setQuizSelectionArmed(true)
    setQuizResult(null)
  }

  async function submitAuth(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setStatus('処理中...')
    if (authMode === 'profile' || authMode === 'signupProfile') {
      const isSignupProfile = authMode === 'signupProfile'
      const wasEditingProfile = accountProfileEditing
      await saveProfile()
      await refreshMe()
      if (isSignupProfile) {
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
        ? { name: authName || authEmail.split('@')[0], email: authEmail, password: authPassword }
        : { email: authEmail, password: authPassword }
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setStatus('ログイン情報を確認してください。')
      return
    }
    await refreshMe()
    if (isSignup) {
      setAuthMode('signupProfile')
      setAccountProfileEditing(true)
      setAuthName('')
      setSignupPasswordConfirm('')
      setSignupConsent(false)
      setAuthPassword('')
      setStatus('')
      return
    }
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
    if (!res.ok || !isJsonResponse(res)) return
    const data = (await res.json()) as { profile: UserProfile | null }
    setAuthProfile(data.profile)
    if (authMode === 'profile') setAccountProfileEditing(false)
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
    if (galleryOpen) await loadGallery()
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
    setUploadAgreeCopyright(false)
    setUploadAgreePrivacy(false)
    setUploadAgreeDecency(false)
    setUploadPreviewOpen(true)
  }

  function closeUploadPreview() {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    if (uploadPreviewRefUrl) URL.revokeObjectURL(uploadPreviewRefUrl)
    setUploadPreviewUrl(null)
    setUploadPreviewRefUrl(null)
    setUploadPreviewOpen(false)
  }

  async function confirmUploadLineart() {
    if (!lineartFile) return
    setUploadPreviewOpen(false)
    setStatus('アップロード中...')
    const form = new FormData()
    form.set('title', lineartTitle || lineartFile.name.replace(/\.[^.]+$/, ''))
    form.set('image', lineartFile)
    form.set('categoryId', lineartCategoryId)
    form.set('isPublic', 'false')
    form.set('isLearning', String(lineartIsLearning))
    if (lineartIsLearning && lineartReferenceFile) form.set('referenceImage', lineartReferenceFile)
    const res = await fetch('/api/linearts', {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
    if (uploadPreviewRefUrl) URL.revokeObjectURL(uploadPreviewRefUrl)
    setUploadPreviewUrl(null)
    setUploadPreviewRefUrl(null)
    if (!res.ok || !isJsonResponse(res)) {
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
    if (illustrationId.startsWith('flag-')) return true
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

  function continueColoring(item: SavedColoring) {
    const illustration = allIllustrations.find((it) => it.id === item.illustrationId)
    if (!illustration) {
      setStatus('この塗り絵の元イラストが見つかりません。')
      return
    }
    const category = playCategories.find((it) => it.illustrationIds.includes(item.illustrationId))
    if (category) setSelectedCategoryId(category.id)
    const restoreSeq = Date.now()
    setRestoreImage(null)
    setSelected(item.illustrationId)
    setArtZoom(1)
    setEyedropper(false)
    setBrush(false)
    setShowSavedPage(false)
    setGalleryOpen(false)
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
    setAuthMotifId(authProfile?.motifId ?? authMotifId)
    setAuthIconColor(authProfile?.iconColor ?? authIconColor)
    setAuthIconEyedropper(false)
    setAccountProfileEditing(false)
    setAccountEmailEditing(false)
    setAccountEmailValue(authUser.email)
    setAccountEmailMessage('')
    setAccountPasswordOpen(false)
    setAccountPasswordCurrent('')
    setAccountPasswordNew('')
    setAccountPasswordConfirm('')
    setAccountPasswordMessage('')
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

  function startAfterSignup() {
    setAuthOpen(false)
    setAuthMode('profile')
    setAccountProfileEditing(false)
    setStatus('')
    openPlayCatalog()
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
    setAccountEmailMessage('変更中...')
    const res = await fetch('/api/auth/change-email', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newEmail: nextEmail }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setAccountEmailMessage('メールアドレスを変更できませんでした。')
      return
    }
    await refreshMe()
    setAccountEmailEditing(false)
    setAccountEmailMessage('メールアドレスを変更しました。')
  }

  async function submitAccountPasswordReset() {
    if (accountPasswordNew.length < 8) {
      setAccountPasswordMessage('新しいパスワードは8文字以上にしてください。')
      return
    }
    if (accountPasswordNew !== accountPasswordConfirm) {
      setAccountPasswordMessage('新しいパスワードが一致していません。')
      return
    }
    setAccountPasswordMessage('変更中...')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: accountPasswordCurrent,
        newPassword: accountPasswordNew,
        revokeOtherSessions: false,
      }),
    })
    if (!res.ok || !isJsonResponse(res)) {
      setAccountPasswordMessage('現在のパスワードを確認してください。')
      return
    }
    setAccountPasswordCurrent('')
    setAccountPasswordNew('')
    setAccountPasswordConfirm('')
    setAccountPasswordOpen(false)
    setAccountPasswordMessage('パスワードを変更しました。')
  }

  function runMobileMenuAction(action: () => void) {
    setMobileMenuOpen(false)
    action()
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
              {quizMode ? <span className="topQuizModeBadge">クイズモード</span> : null}
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
              <Sidebar selected={selected} illustrations={displayedCategoryIllustrations.length ? displayedCategoryIllustrations : undefined} learnedIds={learnedQuizIds} onSelect={chooseIllustration} onBackToCategories={backToCategorySelection} />
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
                <span style={{ background: color }} aria-hidden="true" />
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
        <main ref={homeScrollRef} className={`home ${selectedCategory ? 'categoryPage' : showSavedPage ? 'savedPage' : showGalleryPage ? 'galleryPage' : showSpreadPage ? 'spreadPage' : showCreatePage ? 'createPage' : showQuizCatalog ? 'quizCatalogPage' : showPlayCatalog ? 'playCatalogPage' : 'homePage'}`}>
          {!selectedCategory && !showQuizCatalog && !showPlayCatalog && !showCreatePage && !showSpreadPage && !showGalleryPage && !showSavedPage ? (
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
                    <button className="btn primaryAction" type="submit">チェック画面へ</button>
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
                          {ILLUSTRATION_CATEGORIES.map((category) => (
                            <option value={category.id} key={category.id}>{category.title}</option>
                          ))}
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
                    <button className="btn primaryAction uploadSubmitButton" type="submit">チェック画面へ</button>
                  </form>
                  <section className="lineartSection" aria-labelledby="my-linearts-title">
                    <div className="lineartSectionHead">
                      <h2 id="my-linearts-title">自分のぬりえ</h2>
                      <p>公開すると、ほかの人があそぶに追加できるようになります。</p>
                    </div>
                    {myLineartSections.length ? (() => {
                      const activeId = myLineartCategoryFilter && myLineartSections.some((s) => s.id === myLineartCategoryFilter)
                        ? myLineartCategoryFilter
                        : myLineartSections[0].id
                      const active = myLineartSections.find((s) => s.id === activeId) ?? myLineartSections[0]
                      return (
                        <>
                          <div className="galleryCategoryButtons" role="list" aria-label="自分のぬりえのカテゴリー">
                            {myLineartSections.map((section) => (
                              <button
                                className={`galleryCategoryButton ${activeId === section.id ? 'activeGalleryCategory' : ''}`}
                                type="button"
                                key={section.id}
                                onClick={() => setMyLineartCategoryFilter(section.id)}
                              >
                                <span>{section.title}</span>
                                <small>{section.items.length}</small>
                              </button>
                            ))}
                          </div>
                          <div className="publicGrid" aria-label={`自分のぬりえ - ${active.title}`}>
                            {active.items.map((item, idx) => (
                              <figure className="publicCard lineartDisplayCard" key={item.id} style={{ ['--card-accent' as never]: getLoopCardAccent(idx) }}>
                                <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: '自分のぬりえ', imageUrl: item.imageUrl, reportKind: 'ぬりえ', reportId: item.id })}>
                                  <img src={item.imageUrl} alt={item.title} />
                                </button>
                                <figcaption>
                                  <strong>{item.title}</strong>
                                  {item.isLearning ? <span>学習用ぬりえ</span> : null}
                                  <label className="lineartCategoryChanger">
                                    <select aria-label="カテゴリー" value={item.categoryId} onChange={(ev) => updateUploadedLineartCategory(item, ev.target.value)}>
                                      {ILLUSTRATION_CATEGORIES.map((category) => (
                                        <option value={category.id} key={category.id}>{category.title}</option>
                                      ))}
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
                        </>
                      )
                    })() : <p className="emptyInline">まだアップロードしたぬりえはありません。</p>}
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
                {publicLineartSections.length ? (() => {
                  const activeId = publicLineartCategoryFilter && publicLineartSections.some((s) => s.id === publicLineartCategoryFilter)
                    ? publicLineartCategoryFilter
                    : publicLineartSections[0].id
                  const active = publicLineartSections.find((s) => s.id === activeId) ?? publicLineartSections[0]
                  return (
                    <>
                      <div className="galleryCategoryButtons" role="list" aria-label="みんなのぬりえのカテゴリー">
                        {publicLineartSections.map((section) => (
                          <button
                            className={`galleryCategoryButton ${activeId === section.id ? 'activeGalleryCategory' : ''}`}
                            type="button"
                            key={section.id}
                            onClick={() => setPublicLineartCategoryFilter(section.id)}
                          >
                            <span>{section.title}</span>
                            <small>{section.items.length}</small>
                          </button>
                        ))}
                      </div>
                      <div className="publicGrid" aria-label={`みんなのぬりえ - ${active.title}`}>
                        {active.items.map((item, idx) => (
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
                                    {ILLUSTRATION_CATEGORIES.map((category) => (
                                      <option value={category.id} key={category.id}>{category.title}</option>
                                    ))}
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
                    </>
                  )
                })() : <p className="emptyInline">公開されているぬりえはまだありません。</p>}
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
                  {galleryGroupMode === 'category' ? (
                    <div className="galleryCategoryButtons pageGalleryCategories" role="list" aria-label="カテゴリーを選ぶ">
                      {savedGallerySections.map((section) => (
                        <button
                          className={`galleryCategoryButton ${activeGallerySection?.id === section.id ? 'activeGalleryCategory' : ''}`}
                          type="button"
                          key={section.id}
                          onClick={() => setActiveGalleryCategoryId(section.id)}
                        >
                          <span>{section.title}</span>
                          <small>{section.items.length}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <section className="publicGrid" aria-label="保存済み作品">
                    {activeGallerySection?.items.length ? activeGallerySection.items.map((item) => (
                      <figure className="publicCard" key={item.id}>
                        <button
                          className="publicImageButton"
                          type="button"
                          onClick={() => setImagePreview({ title: item.title, subtitle: 'マイギャラリー', imageUrl: item.imageUrl, illustrationId: item.illustrationId })}
                        >
                          <img src={item.imageUrl} alt={item.title} />
                        </button>
                        <figcaption>
                          <strong>{item.title}</strong>
                          <span>作成: {formatDateDisplay(item.createdAt)}</span>
                          {renderPublishToggle(item)}
                          <div className="cardActionRow">
                            <button className="downloadLink" type="button" onClick={() => continueColoring(item)}>
                              続きから
                            </button>
                            <button className="downloadLink savedDeleteLink" type="button" onClick={() => setDeleteTarget(item)}>
                              削除
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
                  <p>
                    ぬりえペイントがきっかけで、いままで知らなかったお子さんの配色センスを知ることができるかもしれません。
                  </p>
                  {lpTryRandomIllustration ? (
                    <div className="lpTryPreviewFrame" aria-hidden="true">
                      <div className="lpMiniPaper lpTryPreviewPaper">
                        <IllustrationThumb illustration={lpTryRandomIllustration} />
                      </div>
                    </div>
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
                {selectedCategory ? selectedCategory.title : showQuizCatalog ? 'まなぶ' : showPlayCatalog ? 'あそぶ' : 'カテゴリーを選ぶ'}
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
                {selectedCategoryHasQuiz ? renderQuizModeSwitch() : null}
              </div>
            ) : showQuizCatalog ? (
              <div className="introActions">
                {renderQuizModeSwitch()}
              </div>
            ) : null}
            </div>
          {selectedCategory ? (
            <section className="homeGrid" aria-label="イラスト一覧">
              {displayedCategoryIllustrations.map((it, idx) => (
                libraryByIllustrationId.has(it.id) ? (
                  <div className="homeCard libraryHomeCard" key={it.id} style={{ ['--stagger' as never]: `${Math.min(idx, 12)}` }}>
                    <button className="homeCardMain" type="button" onClick={() => chooseIllustration(it.id)}>
                      {learnedQuizIds.has(it.id) ? <span className="learnedBadge" aria-label="覚えた">✓</span> : null}
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
                    {learnedQuizIds.has(it.id) ? <span className="learnedBadge" aria-label="覚えた">✓</span> : null}
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
              {(showQuizCatalog ? quizCategories : showPlayCatalog ? playCategories : ILLUSTRATION_CATEGORIES).map((category, idx) => {
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
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="設定">
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
                          className={`swatch editableSwatch ${selectedSwatchIndex === index ? 'activeEditableSwatch' : ''}`}
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
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="アカウント">
          <form className="authPanel" onSubmit={submitAuth}>
            <div className="modalHead">
              <div>
                <div className="modalTitle">
                  {authMode === 'signup'
                    ? 'アカウント作成'
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
              <button className="btn iconButton quizResultCloseButton" type="button" onClick={() => setAuthOpen(false)} aria-label="閉じる" title="閉じる">
                <span aria-hidden="true" />
              </button>
            </div>
            <div className="authBody">
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
                          メールを変更する
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
                      }}
                    >
                      パスワードを変更する
                    </button>
                    {accountPasswordOpen ? (
                      <div
                        className="accountInlineForm accountPasswordForm"
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault()
                            void submitAccountPasswordReset()
                          }
                        }}
                      >
                        <label className="field">
                          <span>現在のパスワード</span>
                          <input value={accountPasswordCurrent} onChange={(ev) => setAccountPasswordCurrent(ev.target.value)} type="password" autoComplete="current-password" required />
                        </label>
                        <label className="field">
                          <span>新しいパスワード</span>
                          <input value={accountPasswordNew} onChange={(ev) => setAccountPasswordNew(ev.target.value)} type="password" autoComplete="new-password" minLength={8} required />
                        </label>
                        <label className="field">
                          <span>新しいパスワード（確認）</span>
                          <input value={accountPasswordConfirm} onChange={(ev) => setAccountPasswordConfirm(ev.target.value)} type="password" autoComplete="new-password" minLength={8} required />
                        </label>
                        <button className="btn primaryAction" type="button" onClick={submitAccountPasswordReset}>
                          変更する
                        </button>
                      </div>
                    ) : null}
                    {accountPasswordMessage ? <p className="accountSettingMessage">{accountPasswordMessage}</p> : null}
                  </section>
                </>
              ) : null}
              {(authMode === 'profile' && accountProfileEditing) || authMode === 'signupProfile' ? (
                <>
                  <label className="field accountNameField">
                    <span>なまえ</span>
                    <input value={authName} onChange={(ev) => setAuthName(ev.target.value)} autoComplete="name" required />
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
                          <span className="colorChip" style={{ background: authIconColor }} aria-label={`選択中の色: ${authIconColor}`} />
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
                <section className="accountQuizProgress" aria-labelledby="account-quiz-progress">
                  <h3 id="account-quiz-progress">クイズモードの成績</h3>
                  {quizCategoryProgress.length ? (
                    <div className="quizProgressList">
                      {quizCategoryProgress.map((progress) => (
                        <details className="quizProgressItem" key={progress.category.id}>
                          <summary>
                            <span>{progress.category.title}</span>
                            <strong>{progress.rate}%</strong>
                          </summary>
                          <p>
                            {progress.totalCount}このうち、{progress.learned.length}こ覚えました。
                          </p>
                          {progress.learned.length ? (
                            <div className="learnedMiniGrid">
                              {progress.learned.map((it) => (
                                <button
                                  className="learnedMiniCard"
                                  type="button"
                                  key={it.id}
                                  onClick={() => {
                                    setAuthOpen(false)
                                    chooseIllustration(it.id)
                                  }}
                                >
                                  <IllustrationThumb illustration={it} />
                                  <span>{it.title}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p>成功したぬりえはまだありません。</p>
                          )}
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p>クイズモードに挑戦すると、ここに達成率が表示されます。</p>
                  )}
                </section>
              ) : null}
              {authMode !== 'profile' && authMode !== 'signupProfile' && authMode !== 'signupComplete' ? (
                <>
                  <label className="field">
                    <span>メール</span>
                    <input value={authEmail} onChange={(ev) => setAuthEmail(ev.target.value)} type="email" autoComplete="email" required />
                  </label>
                  <label className="field">
                    <span>パスワード</span>
                    <input
                      value={authPassword}
                      onChange={(ev) => setAuthPassword(ev.target.value)}
                      type="password"
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={8}
                      required
                    />
                  </label>
                  {authMode === 'signup' ? (
                    <>
                      <label className="field">
                        <span>パスワード（確認）</span>
                        <input
                          value={signupPasswordConfirm}
                          onChange={(ev) => setSignupPasswordConfirm(ev.target.value)}
                          type="password"
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
              {authMode !== 'profile' && authMode !== 'signupProfile' && authMode !== 'signupComplete' ? (
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
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="マイギャラリー">
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
            <div className="galleryBody">
              {savedColorings.length ? (
                <>
                  {galleryGroupMode === 'category' ? (
                    <div className="galleryCategoryButtons" role="list" aria-label="カテゴリーを選ぶ">
                      {savedGallerySections.map((section) => (
                        <button
                          className={`galleryCategoryButton ${activeGallerySection?.id === section.id ? 'activeGalleryCategory' : ''}`}
                          type="button"
                          key={section.id}
                          onClick={() => setActiveGalleryCategoryId(section.id)}
                        >
                          <span>{section.title}</span>
                          <small>{section.items.length}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {activeGallerySection ? (
                    <section className="gallerySection" aria-label={activeGallerySection.title}>
                      {galleryGroupMode === 'category' ? <h3>{activeGallerySection.title}</h3> : null}
                    <div className="galleryGrid">
                      {activeGallerySection.items.map((item) => (
                        <figure className="savedCard" key={item.id}>
                          <button className="publicImageButton" type="button" onClick={() => setImagePreview({ title: item.title, subtitle: 'マイギャラリー', imageUrl: item.imageUrl, illustrationId: item.illustrationId })}>
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
                              <button className="btn savedDeleteButton" type="button" onClick={() => setDeleteTarget(item)}>
                                削除
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
            {imagePreview.illustrationId ? (
              <div className="imagePreviewActions imagePreviewCommunityActions">
                <button className="btn" type="button" onClick={() => viewCommunityForIllustration(imagePreview.illustrationId!)}>
                  みんなの作品もみてみる
                </button>
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
                {!uploadPreviewShowRef ? (
                  <button
                    className="btn uploadPreviewResetButton"
                    type="button"
                    onClick={() => setUploadPreviewCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type: 'reset' }))}
                  >
                    リセット
                  </button>
                ) : null}
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
                  />
                )}
              </div>
              {!uploadPreviewShowRef ? (
                <div className="uploadPreviewPaletteRow">
                  <button
                    className={`btn iconButton uploadPreviewBrushButton ${uploadPreviewBrush ? 'activeTool' : ''}`}
                    type="button"
                    onClick={() => setUploadPreviewBrush((value) => !value)}
                    aria-label="ブラシ"
                    title="ブラシ"
                  >
                    <BrushIcon />
                  </button>
                  <Palette value={uploadPreviewColor} onChange={setUploadPreviewColor} showSliders showSwatches swatches={customSwatches} />
                </div>
              ) : (
                <p className="uploadPreviewHint">
                  見本と線画を見比べて、配色がずれていないか確認してください。
                </p>
              )}
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
                onClick={confirmUploadLineart}
              >
                アップロードする
              </button>
            </div>
          </div>
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

function isJsonResponse(res: Response) {
  return res.headers.get('content-type')?.includes('application/json') ?? false
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

    for (const dummy of shuffleQuizSwatches(QUIZ_DUMMY_SWATCHES, `${referenceImage}:dummy-swatches`)) {
      if (swatches.length >= 10) break
      if (isConfusingQuizDummy(dummy.hex, swatches.map((swatch) => swatch.hex))) continue
      swatches.push(dummy)
    }

    return swatches.length >= 4 ? swatches : LEARNING_QUIZ_FALLBACK_SWATCHES
  } catch {
    return LEARNING_QUIZ_FALLBACK_SWATCHES
  }
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
      <path d="M17.5 3.5c1.1-1.1 2.9-1.1 4 0 1.1 1.1 1.1 2.9 0 4l-7.7 7.7-4-4Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M13.8 11.2c.5 1.6.1 3.4-1.2 4.7-1.6 1.6-5.4 2-7.8 2.1-.5 0-.9-.4-.8-.9.2-2.4.6-6.2 2.1-7.8 1.3-1.3 3.1-1.7 4.7-1.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="5.5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
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
