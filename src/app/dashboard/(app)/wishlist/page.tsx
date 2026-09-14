import Link from "next/link";
import Icon from "@/components/icons";
import { getContent, wishGroups } from "@/lib/content";
import { hostOf, wishBackground, wishImage } from "@/lib/wish";
import { SUBDOMAIN_LINKS } from "@/lib/site";
import { deleteWishCategory } from "../actions";

export const dynamic = "force-dynamic";

/**
 * The wishlist, by category.
 *
 * Each category has its own New, which opens the editor with that category
 * already chosen — the same shape as the Work tab.
 */
export default async function WishlistDashboard() {
  const content = await getContent();
  const groups = wishGroups(content);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-baseline justify-between gap-4">
        <a
          href={SUBDOMAIN_LINKS.wishlist}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          wishlist.odiwr.com
          <Icon name="material-symbols:arrow-outward-rounded" />
        </a>
        <Link
          href="/dashboard/wishlist/new"
          className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
        >
          New
          <Icon name="material-symbols:arrow-right-alt-rounded" />
        </Link>
      </div>

      {groups.length === 0 && <p className="text-foreground/30">Nothing yet.</p>}

      {groups.map(({ category, items }) => (
        <section key={category} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-foreground/40">{category}</h2>
            <Link
              href={`/dashboard/wishlist/new?category=${encodeURIComponent(category)}`}
              className="inline-flex items-center gap-1.5 text-foreground/50 transition-colors hover:text-accent"
            >
              New
              <Icon name="material-symbols:arrow-right-alt-rounded" />
            </Link>
          </div>

          {items.length === 0 ? (
            <form action={deleteWishCategory} className="flex items-baseline gap-3 py-2">
              <input type="hidden" name="category" value={category} />
              <span className="text-foreground/30">Nothing in this category.</span>
              <button
                type="submit"
                className="text-foreground/40 transition-colors hover:text-[#ff6b6b]"
              >
                Remove it
              </button>
            </form>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => {
                const src = wishImage(item);
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <span
                      className="wish-thumb"
                      style={
                        wishBackground(item)
                          ? { backgroundColor: wishBackground(item) }
                          : undefined
                      }
                    >
                      {src && (
                        // eslint-disable-next-line @next/next/no-img-element -- remote shop images
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={
                            item.imageScale && item.imageScale !== 100
                              ? { transform: `scale(${item.imageScale / 100})` }
                              : undefined
                          }
                        />
                      )}
                    </span>
                    <Link
                      href={`/dashboard/wishlist/${item.id}`}
                      className="truncate transition-colors hover:text-accent"
                    >
                      {item.title}
                    </Link>
                    <span className="ml-auto shrink-0 text-foreground/40">{hostOf(item.href)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
