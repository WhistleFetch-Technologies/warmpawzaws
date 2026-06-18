import { goBackOrReplace } from '@/lib/go-back-or-replace';

export const WARMPAWZ_ARTICLES_LIST_BACK_KEY = 'warmpawz_articles_list_back';
export const WARMPAWZ_ARTICLE_DETAIL_BACK_KEY = 'warmpawz_article_detail_back';

export type ArticlesListBackHref = '/' | '/whats-new';
export type ArticleDetailBackHref = '/' | '/articles';

type ArticlesRouter = { push: (href: string) => void; back: () => void; replace: (href: string) => void };

export function rememberArticlesListBack(href: ArticlesListBackHref): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WARMPAWZ_ARTICLES_LIST_BACK_KEY, href);
}

export function peekArticlesListBack(): ArticlesListBackHref {
  if (typeof window === 'undefined') return '/';
  const raw = sessionStorage.getItem(WARMPAWZ_ARTICLES_LIST_BACK_KEY);
  return raw === '/whats-new' ? '/whats-new' : '/';
}

export function consumeArticlesListBack(): ArticlesListBackHref {
  const href = peekArticlesListBack();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(WARMPAWZ_ARTICLES_LIST_BACK_KEY);
  }
  return href;
}

export function rememberArticleDetailBack(href: ArticleDetailBackHref): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WARMPAWZ_ARTICLE_DETAIL_BACK_KEY, href);
}

export function consumeArticleDetailBack(): ArticleDetailBackHref | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(WARMPAWZ_ARTICLE_DETAIL_BACK_KEY);
  sessionStorage.removeItem(WARMPAWZ_ARTICLE_DETAIL_BACK_KEY);
  if (raw === '/' || raw === '/articles') return raw;
  return null;
}

/** Open the articles list; remember where Back on the list should return. */
export function navigateToArticlesList(router: ArticlesRouter, listBack: ArticlesListBackHref): void {
  rememberArticlesListBack(listBack);
  router.push('/articles');
}

/** Open article detail from the list — browser back returns to the list. */
export function navigateToArticleFromList(router: Pick<ArticlesRouter, 'push'>, slug: string): void {
  const ref = String(slug ?? '').trim();
  if (!ref) return;
  router.push(`/articles?slug=${encodeURIComponent(ref)}`);
}

/** Open article detail directly from home (skip list on back). */
export function navigateToArticleFromHome(router: Pick<ArticlesRouter, 'push'>, slug: string): void {
  const ref = String(slug ?? '').trim();
  if (!ref) return;
  rememberArticleDetailBack('/');
  router.push(`/articles?slug=${encodeURIComponent(ref)}`);
}

export function handleArticlesListBack(router: Pick<ArticlesRouter, 'push'>): void {
  const target = consumeArticlesListBack();
  router.push(target);
}

export function handleArticleDetailBack(router: ArticlesRouter): void {
  const explicit = consumeArticleDetailBack();
  if (explicit === '/') {
    router.push('/');
    return;
  }
  if (explicit === '/articles') {
    router.push('/articles');
    return;
  }
  goBackOrReplace(router, '/articles');
}
