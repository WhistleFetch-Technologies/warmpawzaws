import {
  WARMPAWZ_ARTICLE_DETAIL_BACK_KEY,
  WARMPAWZ_ARTICLES_LIST_BACK_KEY,
  consumeArticleDetailBack,
  handleArticleDetailBack,
  handleArticlesListBack,
  navigateToArticleFromHome,
  navigateToArticlesList,
  rememberArticlesListBack,
} from '../articles-back-nav';

describe('articles back navigation', () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  const router = { push, replace, back };

  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    back.mockClear();
    sessionStorage.clear();
  });

  it('navigateToArticlesList stores whats-new back target', () => {
    navigateToArticlesList(router, '/whats-new');
    expect(sessionStorage.getItem(WARMPAWZ_ARTICLES_LIST_BACK_KEY)).toBe('/whats-new');
    expect(push).toHaveBeenCalledWith('/articles');
  });

  it('handleArticlesListBack returns to whats-new when set', () => {
    rememberArticlesListBack('/whats-new');
    handleArticlesListBack(router);
    expect(push).toHaveBeenCalledWith('/whats-new');
    expect(sessionStorage.getItem(WARMPAWZ_ARTICLES_LIST_BACK_KEY)).toBeNull();
  });

  it('handleArticlesListBack defaults to home', () => {
    handleArticlesListBack(router);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('navigateToArticleFromHome marks detail back as home', () => {
    navigateToArticleFromHome(router, 'pet-tips');
    expect(sessionStorage.getItem(WARMPAWZ_ARTICLE_DETAIL_BACK_KEY)).toBe('/');
    expect(push).toHaveBeenCalledWith('/articles?slug=pet-tips');
  });

  it('handleArticleDetailBack with home intent goes to /', () => {
    navigateToArticleFromHome(router, 'x');
    handleArticleDetailBack(router);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('handleArticleDetailBack without intent uses browser back fallback', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/articles', search: '?slug=x', href: 'http://localhost/articles?slug=x' },
      writable: true,
      configurable: true,
    });
    handleArticleDetailBack(router);
    expect(back).toHaveBeenCalled();
    jest.runAllTimers();
    jest.useRealTimers();
  });
});
