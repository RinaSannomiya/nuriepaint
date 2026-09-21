import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export type CategoryDropdownOption = {
  id: string
  label: string
  count?: number
}

// ぬりえペイントの見た目に合わせた、ひらいて選ぶ「プルダウン」。
// ふつうの <select> は開いたリストの見た目を変えられないので、ボタン＋リストで作っている。
// マウス・タッチのほか、キーボード（↑↓ Home End Enter Space Esc）でも操作できる。
export function CategoryDropdown(props: {
  options: CategoryDropdownOption[]
  value: string | null
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}) {
  const { options, value, onChange } = props
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const baseId = useId()
  const listId = `${baseId}-list`

  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value))
  const selected = options[selectedIndex]

  // リストの外を押したら閉じる
  useEffect(() => {
    if (!open) return
    function handlePointerDown(ev: PointerEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // キーボードで動かしたとき、選択中の行がリストの見える範囲に入るようにする（ページ自体はスクロールさせない）
  useEffect(() => {
    if (!open) return
    const list = listRef.current
    const item = list?.children[activeIndex] as HTMLElement | undefined
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop
    } else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [activeIndex, open])

  if (!options.length || !selected) return null

  function openMenu() {
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (option) onChange(option.id)
    setOpen(false)
  }

  function handleKeyDown(ev: KeyboardEvent<HTMLButtonElement>) {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      const step = ev.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + step)))
    } else if (ev.key === 'Home' && open) {
      ev.preventDefault()
      setActiveIndex(0)
    } else if (ev.key === 'End' && open) {
      ev.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (ev.key === 'Escape' && open) {
      ev.preventDefault()
      setOpen(false)
    } else if (ev.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={`categoryDropdown ${open ? 'isOpen' : ''} ${props.className ?? ''}`} ref={rootRef}>
      <button
        className="categoryDropdownButton"
        type="button"
        role="combobox"
        aria-label={props.ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${baseId}-${activeIndex}` : undefined}
        onKeyDown={handleKeyDown}
        onClick={(ev) => {
          if (!open) {
            openMenu()
          } else if (ev.detail === 0) {
            // Enter / Space で押されたときは、いま色がついている行を選ぶ
            choose(activeIndex)
          } else {
            setOpen(false)
          }
        }}
      >
        <span className="categoryDropdownValue">{selected.label}</span>
        {selected.count != null ? <small className="categoryDropdownCount">{selected.count}</small> : null}
        <svg className="categoryDropdownChevron" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul
          className="categoryDropdownList"
          id={listId}
          role="listbox"
          aria-label={props.ariaLabel}
          ref={listRef}
          // リストを押してもボタンからフォーカスが外れないようにする
          onMouseDown={(ev) => ev.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${baseId}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              className={`categoryDropdownOption ${index === selectedIndex ? 'isSelected' : ''} ${index === activeIndex ? 'isActive' : ''}`}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span className="categoryDropdownOptionLabel">{option.label}</span>
              {option.count != null ? <small className="categoryDropdownCount">{option.count}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
