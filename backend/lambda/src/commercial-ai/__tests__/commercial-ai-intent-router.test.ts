import { routeCommercialIntent } from '../intent-router';

describe('commercial-ai intent router', () => {
  it('routes off-topic to refuse', () => {
    expect(routeCommercialIntent('Write python code for AWS')).toBe('refuse');
  });

  it('routes diagnostic questions to investigate', () => {
    expect(routeCommercialIntent('Why is this campaign Critical?')).toBe('investigate');
    expect(routeCommercialIntent("Why didn't this coupon apply?")).toBe('investigate');
  });

  it('routes definition questions to explain', () => {
    expect(routeCommercialIntent('What is campaign funding?')).toBe('explain');
    expect(routeCommercialIntent('Explain stack rules')).toBe('explain');
  });

  it('investigates when entity context and this/current phrasing', () => {
    expect(
      routeCommercialIntent('What is wrong with this?', {
        entity: { type: 'campaign', id: 'abc', name: 'Flash Sale' },
      })
    ).toBe('investigate');
  });

  it('defaults ambiguous commercial prompts to explain', () => {
    expect(routeCommercialIntent('campaign budget')).toBe('explain');
  });
});
