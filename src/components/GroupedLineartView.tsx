import type { ReactNode } from 'react'
import { CATEGORY_GROUPS, ILLUSTRATION_CATEGORIES, findCategoryGroup } from '../illustrations/illustrations'
import { CategoryChips } from './CategoryChips'

export type LineartSection<T> = { id: string; title: string; items: T[] }

// ひろげるの「自分のぬりえ」「みんなのぬりえ」用。
// 小カテゴリーごとのぬりえの一覧（sections）を、大カテゴリーのカード → （小カテゴリーのチップ）→ ぬりえ、の形で見せる。
// filter は、いま開いている大カテゴリーのID（group-…＝そのなかの全部）か小カテゴリーのID。null なら大カテゴリーのカード一覧。
// ぬりえが入っている小カテゴリーだけがチップになる（自分のぬりえは、枚数が少なくても隠さない）。チップが1つ以下なら、チップの行は出さない。
export function GroupedLineartView<T extends { id: string; imageUrl: string }>(props: {
  sections: LineartSection<T>[]
  filter: string | null
  onFilterChange: (id: string | null) => void
  cardsLabel: string
  renderItems: (items: T[], title: string) => ReactNode
}) {
  const { sections, filter, onFilterChange } = props
  const groups = CATEGORY_GROUPS.map((group) => {
    const categories = group.categoryIds
      .map((id) => sections.find((section) => section.id === id))
      .filter((section): section is LineartSection<T> => Boolean(section))
    return { group, categories, items: categories.flatMap((section) => section.items) }
  }).filter((entry) => entry.categories.length > 0)

  // いま開いている大カテゴリー。小カテゴリーのぬりえがなくなった（カテゴリーを変えた）ときは、その大カテゴリーの全部に切り替える
  const activeGroupId = filter ? (findCategoryGroup(filter)?.id ?? filter) : null
  const active = groups.find((entry) => entry.group.id === activeGroupId) ?? null

  if (!active) {
    return (
      <section className="homeGrid categoryGrid" aria-label={props.cardsLabel}>
        {groups.map((entry) => {
          const previews = [
            ...entry.categories.map((section) => section.items[0]),
            ...entry.categories.flatMap((section) => section.items.slice(1)),
          ].slice(0, 4)
          return (
            <button
              key={entry.group.id}
              type="button"
              className="homeCard categoryCard"
              onClick={() => onFilterChange(entry.group.id)}
            >
              <div className="categoryThumb" aria-hidden="true">
                {previews.map((item) => (
                  <div className="thumbPaper" key={item.id}>
                    <img className="thumbImage" src={item.imageUrl} alt="" />
                  </div>
                ))}
              </div>
              <div className="homeMeta">
                <strong>{entry.group.title}</strong>
                <span>{entry.items.length}枚</span>
              </div>
            </button>
          )
        })}
      </section>
    )
  }

  const sub = active.categories.find((section) => section.id === filter) ?? null
  const shownItems = sub ? sub.items : active.items
  const shownTitle = sub ? sub.title : active.group.title
  return (
    <>
      <div className="introActions lineartCategoryActiveHead">
        <button className="btn categoryBackButton" type="button" onClick={() => onFilterChange(null)}>
          カテゴリー選択へ
        </button>
      </div>
      {active.categories.length >= 2 ? (
        <CategoryChips
          compact
          className="lineartCategoryChips"
          ariaLabel={`${active.group.title}をしぼりこむ`}
          activeId={sub ? sub.id : null}
          allNote={active.items.length}
          items={active.categories.map((section) => ({
            id: section.id,
            label: ILLUSTRATION_CATEGORIES.find((category) => category.id === section.id)?.title ?? section.title,
            note: section.items.length,
          }))}
          onChange={(id) => onFilterChange(id ?? active.group.id)}
        />
      ) : null}
      {props.renderItems(shownItems, shownTitle)}
    </>
  )
}
