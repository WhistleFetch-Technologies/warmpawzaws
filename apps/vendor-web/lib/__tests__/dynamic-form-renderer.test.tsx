import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FORM_FIELD_TYPES, type FormSchema } from '@warmpawz/shared-types';
import { DynamicFormRenderer } from '../../../../packages/ui/src/components/DynamicFormRenderer';

const schema: FormSchema = {
  sections: [
    {
      key: 'all',
      title: 'All fields',
      fields: FORM_FIELD_TYPES.map((type) => ({
        key: type,
        label: type,
        type,
        required: false,
        options: type === 'select' || type === 'radio' || type === 'multiselect' ? ['a', 'b'] : undefined,
      })),
    },
  ],
};

describe('DynamicFormRenderer', () => {
  it('renders every field type, a prefilled marker, and a field note', () => {
    const html = renderToStaticMarkup(
      createElement(DynamicFormRenderer, {
        schema,
        values: { text: 'Asha', checkbox: true },
        prefilled: { text: true },
        fieldNotes: { text: 'Check the spelling' },
      }),
    );
    for (const type of FORM_FIELD_TYPES) {
      expect(html).toContain(`data-field-type="${type}"`);
    }
    expect(html).toContain('data-prefilled="true"');
    expect(html).toContain('data-field-note="true"');
    expect(html).toContain('Check the spelling');
  });
});
