import { Button } from "@fluentui/react-components";
import { categories, findCategory, glyphs, searchApps, type Category } from "../catalog";
import { AppGrid } from "../components/AppCard";
import { EmptyState, PageHeader } from "../components/basics";
import { useApp } from "../state";

function CategorySection({ category }: { category: Category }) {
  const { navigate } = useApp();
  return (
    <section className="apps-section">
      <div className="apps-section-header">
        <h2 className="type-body-strong home-section-title">{category.name}</h2>
        <Button appearance="transparent" size="small" onClick={() => navigate({ name: "apps", category: category.id })}>
          See all
        </Button>
      </div>
      <AppGrid apps={category.apps} />
    </section>
  );
}

export function AppsPage({ category, query, suggested }: { category?: string; query?: string; suggested?: boolean }) {
  const { settings, installed, selected, setSelected } = useApp();

  if (query) {
    const results = searchApps(query);
    return (
      <div className="page padded-page">
        <PageHeader title={`Results for “${query.trim()}”`} />
        {results.length ? (
          <AppGrid apps={results} />
        ) : (
          <EmptyState glyph={glyphs.search} title="No apps found">
            <p className="type-body text-secondary">Try a different name, like “Steam” or “music”.</p>
          </EmptyState>
        )}
      </div>
    );
  }

  if (category) {
    const c = findCategory(category);
    if (!c) return null;
    const pickable = c.apps.filter((a) => a.recommended && !installed?.has(a.id.toLowerCase()));
    const allPicked = pickable.length > 0 && pickable.every((a) => selected.includes(a.id));
    return (
      <div className="page padded-page">
        <PageHeader
          title={c.name}
          description={c.description}
          actions={
            pickable.length > 0 && (
              <Button
                onClick={() =>
                  setSelected(
                    allPicked
                      ? selected.filter((id) => !pickable.some((a) => a.id === id))
                      : [...new Set([...selected, ...pickable.map((a) => a.id)])],
                  )
                }
              >
                {allPicked ? "Clear recommended" : "Select recommended"}
              </Button>
            )
          }
        />
        <AppGrid apps={c.apps} />
      </div>
    );
  }

  const shown = suggested ? categories.filter((c) => settings.interests.includes(c.id)) : categories;
  return (
    <div className="page padded-page">
      <PageHeader
        title={suggested ? "Suggested for you" : "All apps"}
        description={
          suggested
            ? "Based on what you picked. Popular apps are already selected; change anything you like, then select Install."
            : "Select the apps you want, then install them all at once."
        }
      />
      {shown.map((c) => (
        <CategorySection key={c.id} category={c} />
      ))}
    </div>
  );
}
