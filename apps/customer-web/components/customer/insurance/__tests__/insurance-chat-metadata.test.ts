import { parseInsuranceChatMetadata } from '../insurance-chat-metadata';

describe('parseInsuranceChatMetadata', () => {
  it('reads a form card object and a payment card stored as JSON text', () => {
    expect(parseInsuranceChatMetadata({
      card: 'form_request',
      applicationId: '22222222-2222-4222-8222-222222222222',
    })?.card).toBe('form_request');

    const payment = parseInsuranceChatMetadata(JSON.stringify({
      card: 'payment_link',
      applicationId: '22222222-2222-4222-8222-222222222222',
      url: 'https://pay.example/abc',
      amount: 249,
    }));
    expect(payment?.url).toBe('https://pay.example/abc');
    expect(payment?.amount).toBe(249);
  });

  it('ignores plain chat text', () => {
    expect(parseInsuranceChatMetadata('Information form')).toBeNull();
    expect(parseInsuranceChatMetadata('Payment link')).toBeNull();
    expect(parseInsuranceChatMetadata(null)).toBeNull();
  });
});
